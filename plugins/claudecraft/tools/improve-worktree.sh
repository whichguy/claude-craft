#!/usr/bin/env bash
# improve-worktree.sh — portable git lifecycle for continuous improve runs
# (Claude / Grok / Codex / any harness that can shell out).
#
# Model: isolate dirty work in a **detached-HEAD worktree** (git cannot check out the
# same branch in two worktrees). Commits during the run live only on that detached tip.
# reintegrate: S11a rebase onto launch tip; S11b merge tip → launch/source (default).
#
# Run JSON state machine (field "state"):
#   created → bootstrapped? → reintegrating → reintegrated | reintegrate_failed → destroyed
# reintegrate_status:
#   null | conflict | worktree_dirty | launch_dirty | ok
# Transitions:
#   create → created; carry → bootstrapped|created; reintegrate → reintegrating → …;
#   destroy → destroyed
#
# Subcommands:
#   create       Detached worktree at launch tip; write run state under .git/
#   carry        Carry launch WIP into worktree as bootstrap commit
#   status       Print run JSON + --- summary --- (mid_rebase, suggested_next, …)
#   reintegrate  S11a rebase; S11b merge tip→launch (default)
#   destroy      Remove worktree (refuses unmerged tip or failed reintegrate unless --force)
#   recover      Reintegrate then destroy unless keep_worktree
#
# Exit codes:
#   0  success (incl. idempotent already-complete / already-destroyed)
#   1  usage / bad args
#   2  not a git repository
#   3  worktree create failed
#   4  carry failed
#   5  reintegrate rebase/merge conflict (or mid-rebase unfinished)
#   6  reintegrate other failure (missing wt, destroyed run, dirty trees, …)
#   7  destroy failed / refused
#   8  missing/invalid run state
#   9  single-flight: another improve worktree already active
#
# Operator messages: structured key=value lines (status= ok|error, command=, next=, …).
# Side effects: plain git(1); override GIT_CMD for tests. JSON via python3.
# Canonical state: <repo>/.git/improve-runs/<slug>.json
#
set -euo pipefail

GIT_CMD="${GIT_CMD:-git}"
VERSION=3

usage() {
  cat <<'EOF' >&2
Usage:
  improve-worktree.sh create --repo <path> [--slug <s>] [--base <ref>] [--keep-worktree]
                             [--merge-to-launch | --no-merge-to-launch]
  improve-worktree.sh carry  --run-json <path> | --repo <path> [--slug <s>]
  improve-worktree.sh status --run-json <path> | --repo <path> [--slug <s>]
  improve-worktree.sh reintegrate --run-json <path> | --repo <path> [--slug <s>]
                                  [--merge-to-launch | --no-merge-to-launch]
  improve-worktree.sh destroy --run-json <path> | --repo <path> [--slug <s>] [--force]
  improve-worktree.sh recover --run-json <path> | --repo <path> [--slug <s>] [--keep-worktree]
                              [--merge-to-launch | --no-merge-to-launch]

Canonical state: <repo>/.git/improve-runs/<slug>.json
status prints full JSON then a --- summary --- block (suggested_next, mid_rebase, …).

Defaults:
  - Detached HEAD worktree (no permanent improve/* branch).
  - merge_to_launch=true (S11b merges tip into launch branch from create).
  - Opt out: --no-merge-to-launch
EOF
}

die() { local code="$1"; shift; printf '%s\n' "$*" >&2; exit "$code"; }

emit_kv() { printf '%s=%s\n' "$1" "$2"; }

# JSON/python may print True/False; CLI and tests use true/false. Treat both as truthy.
is_true() {
  case "${1:-}" in True|true|TRUE|1|yes|YES) return 0 ;; *) return 1 ;; esac
}

# Operator one-liner for status/resume (mirrors improve-next-auto HINTS; no extra deps).
resume_hint_for() {
  case "${1:-}" in
    cycle) printf '%s\n' "Run improve-loop cycle in active tree; re-run status after" ;;
    reintegrate) printf '%s\n' "improve-worktree.sh reintegrate --repo <repo> --slug <slug>" ;;
    destroy) printf '%s\n' "improve-worktree.sh destroy --repo <repo> --slug <slug>" ;;
    done) printf '%s\n' "No automatic steps left; tip on launch or worktree kept on purpose" ;;
    # Do not peer-promote destroy --force: tip may be the only copy of the work.
    blocked:open-pr) printf '%s\n' "Tip not on launch: open PR from worktree tip, or reintegrate --merge-to-launch (check tip_on_launch / merge_to_launch)" ;;
    blocked:rebase-continue) printf '%s\n' "In worktree: resolve, git add, git rebase --continue; then reintegrate/recover" ;;
    blocked:worktree-dirty) printf '%s\n' "Commit or stash worktree changes before reintegrate/destroy" ;;
    blocked:worktree-missing) printf '%s\n' "Worktree path gone; create a new run or recover from tip if known" ;;
    blocked:launch-dirty) printf '%s\n' "Commit/stash tracked launch changes, then reintegrate" ;;
    destroy-or-recover) printf '%s\n' "destroy or recover the active improve worktree, then create again" ;;
    *) printf '%s\n' "Re-run status; see suggested_next=$1" ;;
  esac
}

# die_status <code> <command> <phase|none> <next> <human message...>
# Prints structured error lines to stderr. Uses RUN_JSON/SLUG/STATE when set.
die_status() {
  local code="$1" cmd="$2" phase="$3" next="$4"
  shift 4
  local msg="$*"
  local st="${STATE:-unknown}" rs="none" slug="${SLUG:-none}"
  if [[ -n "${RUN_JSON:-}" && -f "${RUN_JSON}" ]]; then
    st="$(json_get "$RUN_JSON" "d.get('state') or 'unknown'" 2>/dev/null || echo "$st")"
    rs="$(json_get "$RUN_JSON" "d.get('reintegrate_status')" 2>/dev/null || true)"
    if [[ -z "$rs" || "$rs" == "None" || "$rs" == "null" ]]; then rs=none; fi
    slug="$(json_get "$RUN_JSON" "d.get('slug') or 'none'" 2>/dev/null || echo "$slug")"
  fi
  {
    printf '%s\n' "$msg"
    emit_kv status error
    emit_kv command "$cmd"
    emit_kv slug "$slug"
    emit_kv state "$st"
    emit_kv reintegrate_status "$rs"
    emit_kv phase "${phase:-none}"
    emit_kv next "$next"
    emit_kv exit_class "$code"
    emit_kv resume_hint "$(resume_hint_for "$next")"
  } >&2
  exit "$code"
}

ok_status() {
  # ok_status <command> <phase|none> <next> <optional note>
  local cmd="$1" phase="$2" next="$3" note="${4:-}"
  local st="${STATE:-unknown}" rs="none" slug="${SLUG:-none}"
  if [[ -n "${RUN_JSON:-}" && -f "${RUN_JSON}" ]]; then
    st="$(json_get "$RUN_JSON" "d.get('state') or 'unknown'" 2>/dev/null || echo "$st")"
    rs="$(json_get "$RUN_JSON" "d.get('reintegrate_status')" 2>/dev/null || true)"
    if [[ -z "$rs" || "$rs" == "None" || "$rs" == "null" ]]; then rs=none; fi
    slug="$(json_get "$RUN_JSON" "d.get('slug') or 'none'" 2>/dev/null || echo "$slug")"
  fi
  emit_kv status ok
  emit_kv command "$cmd"
  emit_kv slug "$slug"
  emit_kv state "$st"
  emit_kv reintegrate_status "$rs"
  emit_kv phase "${phase:-none}"
  emit_kv next "$next"
  emit_kv resume_hint "$(resume_hint_for "$next")"
  [[ -n "$note" ]] && emit_kv note "$note"
}

record_last_error() {
  local code="$1" phase="$2" msg="$3"
  [[ -n "${RUN_JSON:-}" && -f "${RUN_JSON}" ]] || return 0
  python3 -c "
import json,sys,os
from datetime import datetime
path, code, phase, msg = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
with open(path) as f:
    d=json.load(f)
d['last_error']={
  'code': code,
  'phase': phase,
  'message': msg[:500],
  'at': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
}
tmp=path+'.tmp'
with open(tmp,'w') as f:
    json.dump(d,f,indent=2,sort_keys=True)
    f.write('\n')
os.replace(tmp,path)
" "$RUN_JSON" "$code" "$phase" "$msg"
}

mid_rebase_p() {
  local wt="$1"
  [[ -d "$wt" ]] || return 1
  local m a
  m="$(git_c "$wt" rev-parse --git-path rebase-merge 2>/dev/null || true)"
  a="$(git_c "$wt" rev-parse --git-path rebase-apply 2>/dev/null || true)"
  [[ -n "$m" && -d "$m" ]] || [[ -n "$a" && -d "$a" ]]
}

launch_tracked_dirty_p() {
  local launch="$1"
  git_c "$launch" status --porcelain --untracked-files=no | grep -q .
}

# True if tip commit is already reachable from launch branch (S11b merged or equivalent).
tip_on_launch_p() {
  local launch="$1" tip="$2" branch="$3"
  [[ -n "$tip" && "$tip" != "none" ]] || return 1
  git_c "$launch" merge-base --is-ancestor "$tip" "$branch" 2>/dev/null
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die 1 "missing required command: $1"
}

git_c() {
  local dir="$1"; shift
  "$GIT_CMD" -C "$dir" "$@"
}

abs_path() {
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

json_get() {
  local file="$1" expr="$2"
  python3 -c "
import json,sys
with open(sys.argv[1]) as f:
    d=json.load(f)
print($expr)
" "$file"
}

json_write() {
  local file="$1" payload="$2"
  python3 -c "
import json,sys,os
path=sys.argv[1]
data=json.loads(sys.argv[2])
os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
tmp=path+'.tmp'
with open(tmp,'w') as f:
    json.dump(data,f,indent=2,sort_keys=True)
    f.write('\n')
os.replace(tmp,path)
" "$file" "$payload"
}

json_merge() {
  local file="$1" patch="$2"
  python3 -c "
import json,sys,os
path=sys.argv[1]
patch=json.loads(sys.argv[2])
with open(path) as f:
    d=json.load(f)
d.update(patch)
tmp=path+'.tmp'
with open(tmp,'w') as f:
    json.dump(d,f,indent=2,sort_keys=True)
    f.write('\n')
os.replace(tmp,path)
" "$file" "$patch"
}

require_git_repo() {
  local dir="$1"
  git_c "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die 2 "not a git repository: $dir"
  git_c "$dir" rev-parse --show-toplevel
}

default_slug() {
  python3 -c 'import time,random; print("%s%04x" % (time.strftime("%Y%m%d-%H%M%S"), random.randint(0,0xffff)))'
}

index_dir_for() {
  printf '%s\n' "$1/.git/improve-runs"
}

sync_index() { :; }

resolve_run_json() {
  if [[ -n "${RUN_JSON_ARG:-}" ]]; then
    RUN_JSON="$(abs_path "$RUN_JSON_ARG")"
    [[ -f "$RUN_JSON" ]] || die 8 "run state JSON not found: $RUN_JSON"
    return
  fi
  [[ -n "${REPO_ARG:-}" ]] || die 1 "need --run-json or --repo"
  local repo index_dir
  repo="$(require_git_repo "$(abs_path "$REPO_ARG")")"
  index_dir="$(index_dir_for "$repo")"
  local index_path=""
  if [[ -n "${SLUG_ARG:-}" ]]; then
    index_path="$index_dir/${SLUG_ARG}.json"
    [[ -f "$index_path" ]] || die 8 "no run state for slug: $SLUG_ARG ($index_path)"
  else
    index_path="$(ls -t "$index_dir"/*.json 2>/dev/null | head -1 || true)"
    [[ -n "$index_path" ]] || die 8 "no IMPROVE_RUN state under $index_dir"
  fi
  RUN_JSON="$(abs_path "$index_path")"
}

load_run() {
  resolve_run_json
  REPO="$(json_get "$RUN_JSON" "d['repo']")"
  LAUNCH_PATH="$(json_get "$RUN_JSON" "d['launch_path']")"
  LAUNCH_BRANCH="$(json_get "$RUN_JSON" "d['launch_branch']")"
  IMPROVE_BRANCH="$(json_get "$RUN_JSON" "d.get('improve_branch') or ''")"
  WORKTREE_PATH="$(json_get "$RUN_JSON" "d['worktree_path']")"
  SLUG="$(json_get "$RUN_JSON" "d['slug']")"
  KEEP_WORKTREE="$(json_get "$RUN_JSON" "d.get('keep_worktree', False)")"
  MERGE_TO_LAUNCH="$(json_get "$RUN_JSON" "d.get('merge_to_launch', True)")"
  STATE="$(json_get "$RUN_JSON" "d.get('state','')")"
  ISOLATION="$(json_get "$RUN_JSON" "d.get('isolation', 'detached')")"
  REINTEGRATE_STATUS="$(json_get "$RUN_JSON" "d.get('reintegrate_status')" 2>/dev/null || true)"
  if [[ -z "${REINTEGRATE_STATUS:-}" || "$REINTEGRATE_STATUS" == "None" || "$REINTEGRATE_STATUS" == "null" ]]; then
    REINTEGRATE_STATUS=""
  fi
}

active_improve_worktrees() {
  local repo="$1"
  git_c "$repo" worktree list --porcelain | python3 -c '
import sys
paths=[]
cur=None
for line in sys.stdin:
    line=line.rstrip("\n")
    if line.startswith("worktree "):
        if cur and "/.claude/worktrees/improve-" in cur.replace("\\", "/"):
            paths.append(cur)
        cur=line[len("worktree "):]
    elif line=="":
        if cur and "/.claude/worktrees/improve-" in cur.replace("\\", "/"):
            paths.append(cur)
        cur=None
if cur and "/.claude/worktrees/improve-" in cur.replace("\\", "/"):
    paths.append(cur)
print("\n".join(paths))
'
}

suggested_next_from_run() {
  # Heuristic from run state + live git (not full Driver snapshot).
  # Align with recover/destroy: tip ancestry beats create-time merge_to_launch alone.
  local st rs wt launch merge keep tip
  st="${STATE:-}"
  rs="${REINTEGRATE_STATUS:-}"
  wt="${WORKTREE_PATH:-}"
  launch="${LAUNCH_PATH:-}"
  merge="${MERGE_TO_LAUNCH:-True}"
  keep="${KEEP_WORKTREE:-False}"

  if [[ "$st" == "destroyed" ]]; then
    printf '%s\n' "done"
    return
  fi
  if [[ -d "$wt" ]] && mid_rebase_p "$wt"; then
    printf '%s\n' "blocked:rebase-continue"
    return
  fi
  if [[ -d "$wt" && -n "$(git_c "$wt" status --porcelain 2>/dev/null || true)" ]]; then
    printf '%s\n' "blocked:worktree-dirty"
    return
  fi
  if [[ ! -d "$wt" && "$st" != "destroyed" && "$st" != "reintegrated" ]]; then
    if [[ "$rs" != "ok" ]]; then
      printf '%s\n' "blocked:worktree-missing"
      return
    fi
  fi
  if [[ -d "$wt" && "$rs" != "ok" ]]; then
    if is_true "$merge" && launch_tracked_dirty_p "$launch" 2>/dev/null; then
      printf '%s\n' "blocked:launch-dirty"
      return
    fi
    printf '%s\n' "reintegrate"
    return
  fi
  if [[ -d "$wt" && "$rs" == "ok" ]]; then
    tip="$(git_c "$wt" rev-parse HEAD 2>/dev/null || echo none)"
    if tip_on_launch_p "$launch" "$tip" "${LAUNCH_BRANCH:-}"; then
      if is_true "$keep"; then
        printf '%s\n' "done"
        return
      fi
      printf '%s\n' "destroy"
      return
    fi
    # Tip still unmerged: open-pr when merge off; reintegrate when merge on (S11b still needed)
    # keep_worktree still surfaces open-pr so operators know tip is not on launch
    if is_true "$keep"; then
      printf '%s\n' "blocked:open-pr"
      return
    fi
    if is_true "$merge"; then
      printf '%s\n' "reintegrate"
      return
    fi
    printf '%s\n' "blocked:open-pr"
    return
  fi
  if [[ "$rs" == "ok" && ! -d "$wt" ]]; then
    printf '%s\n' "done"
    return
  fi
  printf '%s\n' "cycle"
}

cmd_create() {
  need_cmd python3
  [[ -n "${REPO_ARG:-}" ]] || die 1 "create requires --repo"
  local repo launch_path launch_branch launch_head base slug wt_path index_dir run_json
  repo="$(require_git_repo "$(abs_path "$REPO_ARG")")"
  launch_path="$repo"
  launch_branch="$(git_c "$repo" rev-parse --abbrev-ref HEAD)"
  [[ "$launch_branch" != "HEAD" ]] || die 3 "detached HEAD not supported for create; checkout a branch first"
  launch_head="$(git_c "$repo" rev-parse HEAD)"
  base="${BASE_ARG:-$launch_head}"
  slug="${SLUG_ARG:-$(default_slug)}"
  wt_path="$repo/.claude/worktrees/improve-${slug}"
  index_dir="$(index_dir_for "$repo")"

  local active
  active="$(active_improve_worktrees "$repo" || true)"
  if [[ -n "$active" ]]; then
    {
      printf 'create refused: another improve worktree already active for repo:\n%s\n' "$active"
      printf 'destroy or recover the existing slug first, then create again\n'
      emit_kv status error
      emit_kv command create
      emit_kv slug "${slug:-none}"
      emit_kv state none
      emit_kv reintegrate_status none
      emit_kv phase create
      emit_kv next destroy-or-recover
      emit_kv exit_class 9
      emit_kv resume_hint "$(resume_hint_for destroy-or-recover)"
    } >&2
    exit 9
  fi

  if [[ -e "$wt_path" ]]; then
    die 3 "worktree path already exists: $wt_path (remove or choose another --slug)"
  fi

  mkdir -p "$(dirname "$wt_path")" "$index_dir"

  if ! git_c "$repo" worktree add --detach "$wt_path" "$base"; then
    die 3 "git worktree add --detach failed for $wt_path"
  fi

  # Keep improve worktrees out of launch porcelain / carry untracked (local exclude only).
  # --git-path is relative to repo; resolve under absolute git-dir so cwd cannot mis-write.
  local excl git_dir
  git_dir="$(git_c "$repo" rev-parse --absolute-git-dir 2>/dev/null || true)"
  if [[ -n "$git_dir" ]]; then
    excl="$git_dir/info/exclude"
    mkdir -p "$(dirname "$excl")"
    if ! grep -qxF '.claude/worktrees/' "$excl" 2>/dev/null; then
      printf '%s\n' '.claude/worktrees/' >>"$excl"
    fi
  fi

  local keep_py merge_py
  keep_py="False"; [[ "${KEEP_WORKTREE:-0}" == "1" ]] && keep_py="True"
  merge_py="False"; [[ "${MERGE_TO_LAUNCH:-0}" == "1" ]] && merge_py="True"

  local payload
  payload="$(python3 -c "
import json,sys
print(json.dumps({
  'version': int(sys.argv[7]),
  'repo': sys.argv[1],
  'launch_path': sys.argv[2],
  'launch_branch': sys.argv[3],
  'launch_head': sys.argv[4],
  'isolation': 'detached',
  'improve_branch': '',
  'worktree_path': sys.argv[5],
  'slug': sys.argv[6],
  'keep_worktree': $keep_py,
  'merge_to_launch': $merge_py,
  'state': 'created',
  'started_at': __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'reintegrate_status': None,
}, sort_keys=True))
" "$repo" "$launch_path" "$launch_branch" "$launch_head" "$wt_path" "$slug" "$VERSION")"

  run_json="$index_dir/${slug}.json"
  json_write "$run_json" "$payload"
  RUN_JSON="$run_json"
  SLUG="$slug"
  STATE=created

  printf 'created worktree=%s isolation=detached launch_branch=%s run_json=%s\n' \
    "$wt_path" "$launch_branch" "$run_json"
  ok_status create create "carry-or-cycle" "detached worktree ready"
}

cmd_carry() {
  need_cmd python3
  load_run
  local launch="$LAUNCH_PATH" wt="$WORKTREE_PATH"
  if [[ ! -d "$wt" ]]; then
    record_last_error 4 carry "worktree missing: $wt"
    die_status 4 carry none fix-or-recreate "carry failed: worktree missing: $wt"
  fi

  if [[ -z "$(git_c "$launch" status --porcelain)" ]]; then
    printf 'carry: launch clean, nothing to do\n'
    json_merge "$RUN_JSON" '{"state":"created"}'
    STATE=created
    sync_index
    ok_status carry carry cycle "launch was clean"
    return 0
  fi

  local tmp
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/improve-carry.XXXXXX")"
  trap 'rm -rf "$tmp"' RETURN

  git_c "$launch" diff HEAD >"$tmp/tracked.patch" || true

  python3 -c "
import os,sys,tarfile,subprocess
launch, out, git = sys.argv[1], sys.argv[2], sys.argv[3]
raw=subprocess.check_output([git,'-C',launch,'ls-files','--others','--exclude-standard','-z'])
paths=[]
for p in raw.split(b'\\0'):
    if not p:
        continue
    s=p.decode()
    # Never carry the improve worktree tree back into itself
    norm=s.replace('\\\\','/').lstrip('./')
    if norm=='.claude/worktrees' or norm.startswith('.claude/worktrees/'):
        continue
    paths.append(s)
if not paths:
    sys.exit(0)
with tarfile.open(out,'w') as tar:
    for p in paths:
        fp=os.path.join(launch,p)
        if os.path.isfile(fp):
            tar.add(fp, arcname=p)
" "$launch" "$tmp/untracked.tar" "$GIT_CMD" || true

  if [[ -s "$tmp/tracked.patch" ]]; then
    if ! git_c "$wt" apply --whitespace=nowarn "$tmp/tracked.patch"; then
      record_last_error 4 carry "failed to apply tracked WIP patch"
      die_status 4 carry none fix-patch "carry failed: could not apply tracked WIP into worktree"
    fi
  fi

  if [[ -f "$tmp/untracked.tar" ]]; then
    tar -xf "$tmp/untracked.tar" -C "$wt"
  fi

  git_c "$wt" add -A
  if [[ -z "$(git_c "$wt" status --porcelain)" ]]; then
    printf 'carry: nothing to carry (no transferable WIP after filtering improve worktrees)\n'
    json_merge "$RUN_JSON" '{"state":"created"}'
    STATE=created
    sync_index
    ok_status carry carry cycle "nothing to carry"
    return 0
  fi

  if ! git_c "$wt" \
      -c user.email="${GIT_AUTHOR_EMAIL:-improve@local}" \
      -c user.name="${GIT_AUTHOR_NAME:-improve-worktree}" \
      commit --no-verify -m "improve-loop: bootstrap — carry WIP from launch"; then
    record_last_error 4 carry "bootstrap commit failed"
    die_status 4 carry none fix-commit "carry failed: bootstrap commit failed"
  fi
  printf 'carry: bootstrap commit on detached tip (will land on %s at reintegrate)\n' \
    "$LAUNCH_BRANCH"

  # Drain launch WIP only after WT bootstrap exists so S11b can merge without launch_dirty.
  # Never wipe launch if apply/commit failed (those paths die_status above). Leave gitignored
  # files (e.g. .env) on launch — they were not carried.
  printf 'carry: draining launch WIP to match HEAD (tracked restore + untracked clean)\n'
  if git_c "$launch" rev-parse --verify HEAD >/dev/null 2>&1; then
    # Restores tracked/staged modifications; does not touch untracked or ignored.
    if ! git_c "$launch" restore --source=HEAD --staged --worktree -- . 2>/dev/null; then
      git_c "$launch" reset --hard HEAD >/dev/null 2>&1 || true
      git_c "$launch" checkout -- . >/dev/null 2>&1 || true
    fi
  fi
  # Remove non-ignored untracked files/dirs; keep improve worktree parent intact.
  git_c "$launch" clean -fd \
    -e '.claude/worktrees' \
    -e '.claude/worktrees/**' \
    >/dev/null 2>&1 || true

  local residual
  residual="$(git_c "$launch" status --porcelain --untracked-files=normal 2>/dev/null \
    | grep -v '\.claude/worktrees' || true)"
  if [[ -n "$residual" ]]; then
    printf 'carry: warning: launch still shows residual porcelain after drain:\n%s\n' "$residual"
  fi

  json_merge "$RUN_JSON" '{"state":"bootstrapped"}'
  STATE=bootstrapped
  sync_index
  ok_status carry carry cycle "WIP carried into worktree; launch drained"
}

cmd_status() {
  load_run
  cat "$RUN_JSON"
  printf '\n--- summary ---\n'
  local rs="${REINTEGRATE_STATUS:-none}"
  [[ -z "$rs" ]] && rs=none
  local wt_ex=no mid=no launch_dirty=no tip_on=no tip_sha=none
  [[ -d "$WORKTREE_PATH" ]] && wt_ex=yes
  if [[ "$wt_ex" == "yes" ]] && mid_rebase_p "$WORKTREE_PATH"; then mid=yes; fi
  if launch_tracked_dirty_p "$LAUNCH_PATH" 2>/dev/null; then launch_dirty=yes; fi
  if [[ "$wt_ex" == "yes" ]]; then
    tip_sha="$(git_c "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo none)"
    if tip_on_launch_p "$LAUNCH_PATH" "$tip_sha" "$LAUNCH_BRANCH"; then tip_on=yes; fi
  fi
  local merge=false keep=false
  is_true "$MERGE_TO_LAUNCH" && merge=true
  is_true "$KEEP_WORKTREE" && keep=true
  local sugg hint_line
  sugg="$(suggested_next_from_run)"
  hint_line="$(resume_hint_for "$sugg")"

  emit_kv slug "$SLUG"
  emit_kv state "${STATE:-unknown}"
  emit_kv reintegrate_status "$rs"
  emit_kv worktree_exists "$wt_ex"
  emit_kv worktree_path "$WORKTREE_PATH"
  emit_kv worktree_tip "$tip_sha"
  emit_kv tip_on_launch "$tip_on"
  emit_kv launch_branch "$LAUNCH_BRANCH"
  emit_kv mid_rebase "$mid"
  emit_kv launch_tracked_dirty "$launch_dirty"
  emit_kv merge_to_launch "$merge"
  emit_kv keep_worktree "$keep"
  emit_kv suggested_next "$sugg"
  emit_kv resume_hint "$hint_line"
  emit_kv hint "For full Driver facts use improve-next-auto.js; re-run status after each lifecycle step"
  if [[ "$wt_ex" == "yes" ]]; then
    printf 'worktree_git_status:\n'
    git_c "$WORKTREE_PATH" status -sb || true
  fi
}

cmd_reintegrate() {
  need_cmd python3
  load_run
  local launch="$LAUNCH_PATH" wt="$WORKTREE_PATH"

  if [[ "$STATE" == "destroyed" ]]; then
    record_last_error 6 reintegrate "run already destroyed"
    die_status 6 reintegrate none create-new-run \
      "reintegrate refused: run state=destroyed (slug=$SLUG); create a new improve worktree"
  fi

  local do_merge="$MERGE_TO_LAUNCH"
  if [[ "${MERGE_OVERRIDE:-}" == "on" ]]; then
    do_merge="true"
  elif [[ "${MERGE_OVERRIDE:-}" == "off" ]]; then
    do_merge="false"
  fi

  if [[ ! -d "$wt" ]]; then
    record_last_error 6 reintegrate "worktree missing: $wt"
    die_status 6 reintegrate none blocked:worktree-missing \
      "reintegrate failed: worktree missing: $wt (run state=$STATE)"
  fi

  git_c "$launch" rev-parse --verify "$LAUNCH_BRANCH" >/dev/null 2>&1 \
    || {
      record_last_error 6 reintegrate "launch branch missing: $LAUNCH_BRANCH"
      die_status 6 reintegrate none fix-launch-branch \
        "reintegrate failed: launch branch missing: $LAUNCH_BRANCH"
    }

  local merge_ref launch_tip skip_s11a=false
  merge_ref="$(git_c "$wt" rev-parse HEAD)"
  launch_tip="$(git_c "$launch" rev-parse "$LAUNCH_BRANCH")"

  # Idempotent when tip already on launch (S11b done). If status=ok but tip not on launch
  # and do_merge (e.g. prior no-merge S11a-only, now --merge-to-launch):
  #   - S11b only when tip already includes current launch tip (S11a would be no-op)
  #   - else re-run S11a (launch advanced and/or tip needs rebase) then S11b
  # Never skip S11a solely because reintegrate_status=ok — that left concurrent
  # launch edits as S11b conflicts on the launch checkout instead of in the worktree.
  if [[ "${REINTEGRATE_STATUS:-}" == "ok" ]]; then
    if tip_on_launch_p "$launch" "$merge_ref" "$LAUNCH_BRANCH"; then
      printf 'reintegrate: already complete (tip on launch; reintegrate_status=ok state=%s)\n' "$STATE"
      local next_done=destroy
      is_true "$KEEP_WORKTREE" && next_done=done
      ok_status reintegrate none "$next_done" "already-complete"
      return 0
    fi
    if ! is_true "$do_merge"; then
      printf 'reintegrate: already complete (S11a done, merge_to_launch=false; tip %s not on launch)\n' "$merge_ref"
      ok_status reintegrate S11a blocked:open-pr "already-complete; tip not on launch"
      return 0
    fi
    if git_c "$launch" merge-base --is-ancestor "$launch_tip" "$merge_ref" 2>/dev/null; then
      printf 'reintegrate: prior S11a ok; tip already includes launch tip %s — S11b only (merge override or delayed merge)\n' \
        "${launch_tip:0:12}"
      skip_s11a=true
    else
      printf 'reintegrate: prior S11a ok but tip does not include current launch tip — re-running S11a then S11b\n'
      skip_s11a=false
    fi
  fi

  json_merge "$RUN_JSON" '{"state":"reintegrating"}'
  STATE=reintegrating

  if [[ "$skip_s11a" != "true" ]]; then
    if mid_rebase_p "$wt"; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"conflict"}'
      STATE=reintegrate_failed
      REINTEGRATE_STATUS=conflict
      record_last_error 5 S11a "rebase already in progress"
      sync_index
      die_status 5 reintegrate S11a blocked:rebase-continue \
        "reintegrate blocked: rebase already in progress in worktree
finish with: git -C $wt rebase --continue   # or: git -C $wt rebase --abort
then: improve-worktree.sh reintegrate --repo $REPO --slug $SLUG
(or: improve-worktree.sh recover --repo $REPO --slug $SLUG)"
    fi

    if [[ -n "$(git_c "$wt" status --porcelain)" ]]; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"worktree_dirty"}'
      STATE=reintegrate_failed
      REINTEGRATE_STATUS=worktree_dirty
      record_last_error 6 S11a "worktree dirty"
      sync_index
      die_status 6 reintegrate S11a blocked:worktree-dirty \
        "reintegrate refused: worktree has uncommitted changes; commit or stash first: $wt
(only IMPROVE_LOOP.md dirty → commit: improve-loop: driver — next_auto reintegrate)"
    fi

    # S11a
    if ! git_c "$wt" \
        -c user.email="${GIT_AUTHOR_EMAIL:-improve@local}" \
        -c user.name="${GIT_AUTHOR_NAME:-improve-worktree}" \
        rebase "$launch_tip"; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"conflict"}'
      STATE=reintegrate_failed
      REINTEGRATE_STATUS=conflict
      record_last_error 5 S11a "conflict rebasing onto $LAUNCH_BRANCH"
      sync_index
      die_status 5 reintegrate S11a blocked:rebase-continue \
        "reintegrate S11a conflict: rebasing worktree onto $LAUNCH_BRANCH tip failed
in $wt: resolve conflicts, git add, git rebase --continue
then re-run reintegrate (or git rebase --abort to cancel; or recover after continue)"
    fi
    merge_ref="$(git_c "$wt" rev-parse HEAD)"
  fi

  local s11b=skipped

  if is_true "$do_merge"; then
    if launch_tracked_dirty_p "$launch"; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"launch_dirty"}'
      STATE=reintegrate_failed
      REINTEGRATE_STATUS=launch_dirty
      record_last_error 6 S11b "launch tracked dirty"
      sync_index
      die_status 6 reintegrate S11b blocked:launch-dirty \
        "reintegrate S11b refused: launch has tracked changes on $LAUNCH_BRANCH
commit or stash on launch, then re-run reintegrate (worktree kept; S11a already applied): $wt"
    fi
    if ! git_c "$launch" \
        -c user.email="${GIT_AUTHOR_EMAIL:-improve@local}" \
        -c user.name="${GIT_AUTHOR_NAME:-improve-worktree}" \
        merge --no-edit "$merge_ref"; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"conflict"}'
      STATE=reintegrate_failed
      REINTEGRATE_STATUS=conflict
      record_last_error 5 S11b "conflict merging tip into $LAUNCH_BRANCH"
      sync_index
      die_status 5 reintegrate S11b fix-merge-on-launch \
        "reintegrate S11b conflict: merging worktree tip into $LAUNCH_BRANCH failed
resolve on launch checkout, or inspect tip $merge_ref; worktree kept: $wt"
    fi
    s11b=merged
    # Persist effective merge: CLI --merge-to-launch override must stick for destroy/recover
    json_merge "$RUN_JSON" "{\"worktree_tip\":\"$merge_ref\",\"last_s11b\":\"merged\",\"merge_to_launch\":true}"
    MERGE_TO_LAUNCH="true"
    printf 'reintegrate: S11b merged worktree tip into source branch %s (ref %s)\n' \
      "$LAUNCH_BRANCH" "$merge_ref"
  else
    s11b=skipped
    json_merge "$RUN_JSON" "{\"worktree_tip\":\"$merge_ref\",\"last_s11b\":\"skipped\",\"merge_to_launch\":false}"
    MERGE_TO_LAUNCH="false"
    printf 'reintegrate: S11a rebased onto %s; S11b=skipped (merge_to_launch=false) tip=%s\n' \
      "$LAUNCH_BRANCH" "$merge_ref"
  fi

  json_merge "$RUN_JSON" '{"state":"reintegrated","reintegrate_status":"ok"}'
  STATE=reintegrated
  REINTEGRATE_STATUS=ok
  sync_index
  printf 'reintegrate: ok worktree=%s launch_branch=%s S11a=rebase S11b=%s\n' \
    "$wt" "$LAUNCH_BRANCH" "$s11b"
  local next=destroy
  local phase_ok="S11a+S11b"
  if [[ "$s11b" == "skipped" ]]; then
    next="blocked:open-pr"
    phase_ok="S11a"
  elif is_true "$KEEP_WORKTREE"; then
    next=done
  fi
  ok_status reintegrate "$phase_ok" "$next" "reintegrate_status=ok"
}

cmd_destroy() {
  need_cmd python3
  load_run
  local force="${FORCE:-0}"
  local status="${REINTEGRATE_STATUS:-}"
  local state="$STATE"

  if [[ "$state" == "destroyed" && ! -d "$WORKTREE_PATH" ]]; then
    printf 'destroy: already destroyed (slug=%s)\n' "$SLUG"
    ok_status destroy none done "already-destroyed"
    return 0
  fi

  local mid=no
  [[ -d "$WORKTREE_PATH" ]] && mid_rebase_p "$WORKTREE_PATH" && mid=yes

  if [[ "$force" != "1" ]]; then
    if [[ "$status" == "conflict" || "$status" == "launch_dirty" || "$status" == "worktree_dirty" \
       || "$state" == "reintegrate_failed" || "$mid" == "yes" ]]; then
      die_status 7 destroy none fix-or-force \
        "destroy refused: reintegrate not clean (reintegrate_status=${status:-none} state=$state mid_rebase=$mid)
fix conflicts / dirty trees, or pass --force to remove worktree anyway
slug=$SLUG worktree=$WORKTREE_PATH"
    fi
    # Uncommitted dirt (even when tip is on launch) would be lost by worktree remove.
    if [[ -d "$WORKTREE_PATH" && -n "$(git_c "$WORKTREE_PATH" status --porcelain 2>/dev/null || true)" ]]; then
      record_last_error 7 destroy "refuse destroy: worktree dirty"
      die_status 7 destroy none blocked:worktree-dirty \
        "destroy refused: worktree has uncommitted changes (would be discarded)
commit/stash first, or pass --force to discard
slug=$SLUG worktree=$WORKTREE_PATH"
    fi
    # Always refuse when tip is not on launch — including state=created (never reintegrated).
    # Detached improve commits live only on the worktree tip until S11b; destroy would drop the only copy.
    # After S11b (or recover --merge-to-launch), tip is reachable from launch → allow default destroy.
    if [[ -d "$WORKTREE_PATH" ]]; then
      local tip_sha
      tip_sha="$(git_c "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo none)"
      if ! tip_on_launch_p "$LAUNCH_PATH" "$tip_sha" "$LAUNCH_BRANCH"; then
        record_last_error 7 destroy "refuse destroy: tip not on launch branch"
        die_status 7 destroy none blocked:open-pr \
          "destroy refused: worktree tip is not on launch branch $LAUNCH_BRANCH (only copy may be worktree)
reintegrate (optionally --merge-to-launch), open a PR from tip, or pass --force to discard
slug=$SLUG worktree=$WORKTREE_PATH tip=$tip_sha state=$state reintegrate_status=${status:-none}"
      fi
    fi
  fi

  if [[ -d "$WORKTREE_PATH" ]]; then
    if ! git_c "$REPO" worktree remove --force "$WORKTREE_PATH"; then
      record_last_error 7 destroy "worktree remove failed"
      die_status 7 destroy none retry-or-manual \
        "destroy failed: git worktree remove failed for $WORKTREE_PATH"
    fi
  fi

  if [[ "${DELETE_BRANCH:-0}" == "1" && -n "${IMPROVE_BRANCH// }" ]]; then
    git_c "$REPO" branch -D "$IMPROVE_BRANCH" 2>/dev/null || true
  fi

  json_merge "$RUN_JSON" '{"state":"destroyed"}' 2>/dev/null || true
  STATE=destroyed
  sync_index
  printf 'destroy: removed worktree (source branch %s not modified by destroy)\n' "$LAUNCH_BRANCH"
  ok_status destroy none done "worktree removed"
}

cmd_recover() {
  load_run
  if [[ "${KEEP_WORKTREE_FLAG:-}" == "1" ]]; then
    KEEP_WORKTREE="True"
  fi
  local status="${REINTEGRATE_STATUS:-}" state="$STATE"

  if [[ "$state" == "destroyed" ]]; then
    printf 'recover: already destroyed\n'
    ok_status recover none done "already-destroyed"
    return 0
  fi

  if [[ -d "$WORKTREE_PATH" ]] && mid_rebase_p "$WORKTREE_PATH"; then
    record_last_error 5 recover "mid-rebase"
    die_status 5 recover S11a blocked:rebase-continue \
      "recover blocked: mid-rebase in worktree $WORKTREE_PATH
finish: git -C $WORKTREE_PATH rebase --continue  (or --abort)
then: improve-worktree.sh recover --repo $REPO --slug $SLUG"
  fi

  # Re-run reintegrate when not ok, or when --merge-to-launch and tip still not on launch
  # (prior create --no-merge may have left reintegrate_status=ok after S11a-only).
  local need_reint=false
  if [[ "$status" != "ok" ]]; then
    need_reint=true
  elif [[ "${MERGE_OVERRIDE:-}" == "on" && -d "$WORKTREE_PATH" ]]; then
    local tip0
    tip0="$(git_c "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo none)"
    if ! tip_on_launch_p "$LAUNCH_PATH" "$tip0" "$LAUNCH_BRANCH"; then
      need_reint=true
      printf 'recover: reintegrate_status=ok but tip still unmerged; --merge-to-launch set — running S11b\n'
    fi
  fi
  if [[ "$need_reint" == "true" ]]; then
    printf 'recover: running reintegrate (reintegrate_status=%s MERGE_OVERRIDE=%s)\n' \
      "${status:-none}" "${MERGE_OVERRIDE:-}"
    cmd_reintegrate || return $?
  else
    local tip_skip="none"
    [[ -d "$WORKTREE_PATH" ]] && tip_skip="$(git_c "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo none)"
    if [[ -d "$WORKTREE_PATH" ]] && tip_on_launch_p "$LAUNCH_PATH" "$tip_skip" "$LAUNCH_BRANCH"; then
      printf 'recover: reintegrate already complete (tip on launch); skipping reintegrate\n'
    else
      printf 'recover: reintegrate already complete (S11a ok; merge not requested this run); skipping reintegrate\n'
    fi
  fi

  load_run
  if is_true "$KEEP_WORKTREE" || [[ "${KEEP_WORKTREE_FLAG:-0}" == "1" ]]; then
    local tip_k="none"
    [[ -d "$WORKTREE_PATH" ]] && tip_k="$(git_c "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo none)"
    if [[ -d "$WORKTREE_PATH" ]] && ! tip_on_launch_p "$LAUNCH_PATH" "$tip_k" "$LAUNCH_BRANCH"; then
      printf 'recover: keeping worktree (--keep-worktree); tip %s still unmerged on %s\n' \
        "$tip_k" "$LAUNCH_BRANCH"
      printf 'recover: next=blocked:open-pr — open a PR or reintegrate --merge-to-launch (destroy --force only if discarding tip)\n'
      ok_status recover none blocked:open-pr "kept worktree; tip not on launch"
      return 0
    fi
    printf 'recover: reintegrated; keeping worktree (--keep-worktree)\n'
    ok_status recover none done "kept worktree"
    return 0
  fi

  # Decide keep vs destroy from **effective** tip location, not create-time JSON alone.
  # After recover --merge-to-launch, reintegrate persists merge_to_launch=true and tip is on launch.
  local tip="none"
  [[ -d "$WORKTREE_PATH" ]] && tip="$(git_c "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo none)"
  if [[ -d "$WORKTREE_PATH" ]] && ! tip_on_launch_p "$LAUNCH_PATH" "$tip" "$LAUNCH_BRANCH"; then
    printf 'recover: reintegrate ok but tip %s is not on launch %s — keeping worktree\n' \
      "$tip" "$LAUNCH_BRANCH"
    printf 'recover: open a PR/branch from the tip, or reintegrate --merge-to-launch (destroy --force only if discarding tip)\n'
    ok_status recover none blocked:open-pr "kept worktree; tip not on launch"
    return 0
  fi

  # Do NOT FORCE=1: must honor destroy's uncommitted-dirt guard (P2 safety).
  # Tip is on launch, so default destroy is allowed when porcelain is clean.
  printf 'recover: tip on launch — destroying worktree\n'
  cmd_destroy
}

# ── argv ────────────────────────────────────────────────────────────
SUB="${1:-}"
[[ -n "$SUB" ]] || { usage; exit 1; }
shift || true

REPO_ARG=""
RUN_JSON_ARG=""
SLUG_ARG=""
BASE_ARG=""
KEEP_WORKTREE=0
KEEP_WORKTREE_FLAG=0
MERGE_TO_LAUNCH=1
MERGE_OVERRIDE=""
FORCE=0
DELETE_BRANCH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_ARG="${2:-}"; shift 2 ;;
    --run-json) RUN_JSON_ARG="${2:-}"; shift 2 ;;
    --slug) SLUG_ARG="${2:-}"; shift 2 ;;
    --base) BASE_ARG="${2:-}"; shift 2 ;;
    --keep-worktree) KEEP_WORKTREE=1; KEEP_WORKTREE_FLAG=1; shift ;;
    --merge-to-launch) MERGE_TO_LAUNCH=1; MERGE_OVERRIDE=on; shift ;;
    --no-merge-to-launch) MERGE_TO_LAUNCH=0; MERGE_OVERRIDE=off; shift ;;
    --force) FORCE=1; shift ;;
    --delete-branch) DELETE_BRANCH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die 1 "unknown arg: $1" ;;
  esac
done

case "$SUB" in
  create) cmd_create ;;
  carry) cmd_carry ;;
  status) cmd_status ;;
  reintegrate) cmd_reintegrate ;;
  destroy) cmd_destroy ;;
  recover) cmd_recover ;;
  *) usage; die 1 "unknown subcommand: $SUB" ;;
esac
