#!/usr/bin/env bash
# improve-worktree.sh — portable git lifecycle for continuous improve runs
# (Claude / Grok / Codex / any harness that can shell out).
#
# Subcommands:
#   create       Create improve/<slug> branch + worktree; write run state under .git/
#   carry        Carry launch WIP (tracked + untracked, exclude-standard) into worktree
#                as bootstrap commit "improve-loop: bootstrap — carry WIP from launch"
#   status       Print run state JSON (from --repo/--slug or --run-json)
#   reintegrate  S11: merge launch tip → worktree; optionally merge improve → launch
#   destroy      S12: remove worktree (refuses after failed reintegrate unless --force)
#   recover      Idempotent reintegrate + optional destroy from run state
#
# Exit codes (distinct failure classes):
#   0  success
#   1  usage / bad args
#   2  not a git repository
#   3  worktree create failed
#   4  carry failed
#   5  reintegrate merge conflict
#   6  reintegrate other failure
#   7  destroy failed / refused
#   8  missing/invalid run state
#   9  single-flight: another improve worktree already active for repo
#
# Side effects are plain git(1); override GIT_CMD for tests (default: git).
# JSON via python3. Canonical state: <repo>/.git/improve-runs/<slug>.json
#
set -euo pipefail

GIT_CMD="${GIT_CMD:-git}"
VERSION=1

usage() {
  cat <<'EOF' >&2
Usage:
  improve-worktree.sh create --repo <path> [--slug <s>] [--base <ref>] [--keep-worktree] [--merge-to-launch]
  improve-worktree.sh carry  --run-json <path> | --repo <path>
  improve-worktree.sh status --run-json <path> | --repo <path> [--slug <s>]
  improve-worktree.sh reintegrate --run-json <path> | --repo <path> [--slug <s>] [--merge-to-launch]
  improve-worktree.sh destroy --run-json <path> | --repo <path> [--slug <s>] [--force] [--delete-branch]
  improve-worktree.sh recover --run-json <path> | --repo <path> [--slug <s>] [--keep-worktree] [--merge-to-launch]

Canonical state: <repo>/.git/improve-runs/<slug>.json
(Does not dirty the working tree. --run-json may point at that file.)
EOF
}

die() { local code="$1"; shift; printf '%s\n' "$*" >&2; exit "$code"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die 1 "missing required command: $1"
}

git_c() {
  local dir="$1"; shift
  "$GIT_CMD" -C "$dir" "$@"
}

abs_path() {
  # portable realpath
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

json_get() {
  # json_get <file> <python_expr_on_obj>  e.g. json_get f "d.get('slug')"
  local file="$1" expr="$2"
  python3 -c "
import json,sys
with open(sys.argv[1]) as f:
    d=json.load(f)
print($expr)
" "$file"
}

json_write() {
  # json_write <file> <json-string>
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
  # json_merge <file> <json-patch-object-string>
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
  # short unique slug
  python3 -c 'import time,random; print("%s%04x" % (time.strftime("%Y%m%d-%H%M%S"), random.randint(0,0xffff)))'
}

index_dir_for() {
  # Keep index inside .git so launch `git status` stays clean
  printf '%s\n' "$1/.git/improve-runs"
}

sync_index() {
  # Canonical RUN_JSON is already under .git/improve-runs; nothing to copy.
  :
}

resolve_run_json() {
  # sets RUN_JSON (prefer worktree copy) and optionally INDEX_JSON
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
  IMPROVE_BRANCH="$(json_get "$RUN_JSON" "d['improve_branch']")"
  WORKTREE_PATH="$(json_get "$RUN_JSON" "d['worktree_path']")"
  SLUG="$(json_get "$RUN_JSON" "d['slug']")"
  KEEP_WORKTREE="$(json_get "$RUN_JSON" "d.get('keep_worktree', False)")"
  MERGE_TO_LAUNCH="$(json_get "$RUN_JSON" "d.get('merge_to_launch', False)")"
  STATE="$(json_get "$RUN_JSON" "d.get('state','')")"
}

active_improve_worktrees() {
  # Only match our managed worktrees: .../.claude/worktrees/improve-<slug>
  # (do NOT match arbitrary paths whose basename starts with improve-, e.g. temp dirs)
  local repo="$1"
  git_c "$repo" worktree list --porcelain | python3 -c '
import sys
paths=[]
cur=None
for line in sys.stdin:
    line=line.rstrip("\n")
    if line.startswith("worktree "):
        cur=line[len("worktree "):]
    elif line.startswith("branch ") and cur:
        br=line[len("branch "):].replace("refs/heads/", "")
        managed = "/.claude/worktrees/improve-" in cur.replace("\\", "/")
        if managed or br.startswith("improve/"):
            # still require managed path when branch matches, to avoid false positives
            if managed:
                paths.append(cur)
        cur=None
    elif line=="":
        cur=None
print("\n".join(paths))
'
}

cmd_create() {
  need_cmd python3
  [[ -n "${REPO_ARG:-}" ]] || die 1 "create requires --repo"
  local repo launch_path launch_branch launch_head base slug wt_path index_dir run_json improve_branch
  repo="$(require_git_repo "$(abs_path "$REPO_ARG")")"
  launch_path="$repo"
  launch_branch="$(git_c "$repo" rev-parse --abbrev-ref HEAD)"
  [[ "$launch_branch" != "HEAD" ]] || die 3 "detached HEAD not supported for create; checkout a branch"
  launch_head="$(git_c "$repo" rev-parse HEAD)"
  base="${BASE_ARG:-$launch_head}"
  slug="${SLUG_ARG:-$(default_slug)}"
  improve_branch="improve/${slug}"
  wt_path="$repo/.claude/worktrees/improve-${slug}"
  index_dir="$(index_dir_for "$repo")"

  # single-flight: refuse if another improve worktree is linked
  local active
  active="$(active_improve_worktrees "$repo" || true)"
  if [[ -n "$active" ]]; then
    die 9 "another improve worktree already active for repo:
$active
(destroy/recover first, or pass a unique cleanup)"
  fi

  if [[ -e "$wt_path" ]]; then
    die 3 "worktree path already exists: $wt_path"
  fi

  mkdir -p "$(dirname "$wt_path")" "$index_dir"

  if git_c "$repo" show-ref --verify --quiet "refs/heads/${improve_branch}"; then
    die 3 "branch already exists: $improve_branch"
  fi

  if ! git_c "$repo" worktree add -b "$improve_branch" "$wt_path" "$base"; then
    die 3 "git worktree add failed"
  fi

  local keep_py merge_py
  keep_py="False"; [[ "${KEEP_WORKTREE:-0}" == "1" ]] && keep_py="True"
  merge_py="False"; [[ "${MERGE_TO_LAUNCH:-0}" == "1" ]] && merge_py="True"

  local payload
  payload="$(python3 -c "
import json,sys
print(json.dumps({
  'version': int(sys.argv[8]),
  'repo': sys.argv[1],
  'launch_path': sys.argv[2],
  'launch_branch': sys.argv[3],
  'launch_head': sys.argv[4],
  'improve_branch': sys.argv[5],
  'worktree_path': sys.argv[6],
  'slug': sys.argv[7],
  'keep_worktree': $keep_py,
  'merge_to_launch': $merge_py,
  'state': 'created',
  'started_at': __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'reintegrate_status': None,
}, sort_keys=True))
" "$repo" "$launch_path" "$launch_branch" "$launch_head" "$improve_branch" "$wt_path" "$slug" "$VERSION")"

  # Canonical state lives only under .git/improve-runs (never dirties launch or worktree)
  run_json="$index_dir/${slug}.json"
  json_write "$run_json" "$payload"

  printf 'created worktree=%s branch=%s run_json=%s\n' "$wt_path" "$improve_branch" "$run_json"
}

cmd_carry() {
  need_cmd python3
  load_run
  local launch="$LAUNCH_PATH" wt="$WORKTREE_PATH"
  [[ -d "$wt" ]] || die 4 "worktree missing: $wt"

  # If launch is clean, nothing to carry
  if [[ -z "$(git_c "$launch" status --porcelain)" ]]; then
    printf 'carry: launch clean, nothing to do\n'
    json_merge "$RUN_JSON" '{"state":"created"}'
    # sync index
  sync_index
    return 0
  fi

  # Build patch of tracked changes relative to HEAD
  local tmp
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/improve-carry.XXXXXX")"
  trap 'rm -rf "$tmp"' RETURN

  # Combined tracked diff (includes staged+unstaged vs HEAD)
  git_c "$launch" diff HEAD >"$tmp/tracked.patch" || true

  # Untracked (exclude-standard) → tar via python (handles spaces; no grep -z pipefail trap)
  python3 -c "
import os,sys,tarfile,subprocess
launch, out, git = sys.argv[1], sys.argv[2], sys.argv[3]
raw=subprocess.check_output([git,'-C',launch,'ls-files','--others','--exclude-standard','-z'])
paths=[p.decode() for p in raw.split(b'\\0') if p]
if not paths:
    sys.exit(0)
with tarfile.open(out,'w') as tar:
    for p in paths:
        fp=os.path.join(launch,p)
        if os.path.isfile(fp):
            tar.add(fp, arcname=p)
" "$launch" "$tmp/untracked.tar" "$GIT_CMD" || true

  # Apply tracked patch in worktree
  if [[ -s "$tmp/tracked.patch" ]]; then
    if ! git_c "$wt" apply --whitespace=nowarn "$tmp/tracked.patch"; then
      die 4 "failed to apply tracked WIP patch into worktree"
    fi
  fi

  # Extract untracked
  if [[ -f "$tmp/untracked.tar" ]]; then
    tar -xf "$tmp/untracked.tar" -C "$wt"
  fi

  # Bootstrap commit so improve-loop Phase 0 sees a clean tree
  git_c "$wt" add -A
  if [[ -z "$(git_c "$wt" status --porcelain)" ]]; then
    printf 'carry: nothing staged after apply\n'
  else
    if ! git_c "$wt" \
        -c user.email="${GIT_AUTHOR_EMAIL:-improve@local}" \
        -c user.name="${GIT_AUTHOR_NAME:-improve-worktree}" \
        commit --no-verify -m "improve-loop: bootstrap — carry WIP from launch"; then
      die 4 "bootstrap commit failed"
    fi
    printf 'carry: bootstrap commit created on %s\n' "$IMPROVE_BRANCH"
  fi

  json_merge "$RUN_JSON" '{"state":"bootstrapped"}'
  sync_index
}

cmd_status() {
  load_run
  cat "$RUN_JSON"
  printf '\n'
  if [[ -d "$WORKTREE_PATH" ]]; then
    printf 'worktree_exists=yes\n'
    git_c "$WORKTREE_PATH" status -sb || true
  else
    printf 'worktree_exists=no\n'
  fi
}

cmd_reintegrate() {
  need_cmd python3
  load_run
  local launch="$LAUNCH_PATH" wt="$WORKTREE_PATH"
  [[ -d "$wt" ]] || die 6 "worktree missing: $wt (cannot reintegrate)"

  json_merge "$RUN_JSON" '{"state":"reintegrating"}'

  # Ensure launch branch still exists
  git_c "$launch" rev-parse --verify "$LAUNCH_BRANCH" >/dev/null 2>&1 \
    || die 6 "launch branch missing: $LAUNCH_BRANCH"

  # S11a: merge launch tip into worktree (absorb base movement)
  # fetch local: merge from launch path's branch tip
  local launch_tip
  launch_tip="$(git_c "$launch" rev-parse "$LAUNCH_BRANCH")"

  # In worktree, merge that commit
  if ! git_c "$wt" \
      -c user.email="${GIT_AUTHOR_EMAIL:-improve@local}" \
      -c user.name="${GIT_AUTHOR_NAME:-improve-worktree}" \
      merge --no-edit "$launch_tip"; then
    json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"conflict"}'
  sync_index
    die 5 "conflict merging launch tip into worktree; worktree kept for debug: $wt"
  fi

  # S11b: merge improve branch into launch (default when merge_to_launch true, or --merge-to-launch)
  local do_merge="$MERGE_TO_LAUNCH"
  [[ "${MERGE_TO_LAUNCH_FLAG:-0}" == "1" ]] && do_merge="True"

  if [[ "$do_merge" == "True" || "$do_merge" == "true" ]]; then
    # Block only on tracked changes. Untracked paths (e.g. .claude/worktrees parent)
    # are expected while an improve worktree is linked.
    if git_c "$launch" status --porcelain --untracked-files=no | grep -q .; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"launch_dirty"}'
      die 6 "launch tree has tracked changes; commit/stash before merge-to-launch (worktree kept): $wt"
    fi
    if ! git_c "$launch" \
        -c user.email="${GIT_AUTHOR_EMAIL:-improve@local}" \
        -c user.name="${GIT_AUTHOR_NAME:-improve-worktree}" \
        merge --no-edit "$IMPROVE_BRANCH"; then
      json_merge "$RUN_JSON" '{"state":"reintegrate_failed","reintegrate_status":"conflict"}'
  sync_index
      die 5 "conflict merging $IMPROVE_BRANCH into $LAUNCH_BRANCH; resolve manually; worktree kept: $wt"
    fi
    printf 'reintegrate: merged %s into %s\n' "$IMPROVE_BRANCH" "$LAUNCH_BRANCH"
  else
    printf 'reintegrate: launch tip merged into worktree; improve branch %s ready (merge_to_launch=false — open PR or re-run with --merge-to-launch)\n' "$IMPROVE_BRANCH"
  fi

  json_merge "$RUN_JSON" '{"state":"reintegrated","reintegrate_status":"ok"}'
  sync_index
  printf 'reintegrate: ok worktree=%s\n' "$wt"
}

cmd_destroy() {
  need_cmd python3
  load_run
  local force="${FORCE:-0}"
  local status
  status="$(json_get "$RUN_JSON" "d.get('reintegrate_status')")"
  local state
  state="$(json_get "$RUN_JSON" "d.get('state')")"

  if [[ "$status" != "ok" && "$force" != "1" ]]; then
    # also allow destroy if never started reintegrate and user forces keep false after abandon?
    if [[ "$state" == "reintegrate_failed" || "$status" == "conflict" || "$status" == "launch_dirty" ]]; then
      die 7 "refusing destroy: reintegrate not ok (status=$status state=$state); pass --force or fix conflicts"
    fi
  fi

  if [[ -d "$WORKTREE_PATH" ]]; then
    if ! git_c "$REPO" worktree remove --force "$WORKTREE_PATH"; then
      die 7 "git worktree remove failed for $WORKTREE_PATH"
    fi
  fi

  if [[ "${DELETE_BRANCH:-0}" == "1" ]]; then
    git_c "$REPO" branch -D "$IMPROVE_BRANCH" 2>/dev/null || true
  fi

  json_merge "$RUN_JSON" '{"state":"destroyed"}' 2>/dev/null || true
  # run json may live inside removed worktree — update index only
  sync_index
  printf 'destroy: removed worktree (branch %s kept unless --delete-branch)\n' "$IMPROVE_BRANCH"
}

cmd_recover() {
  # reintegrate then destroy unless keep_worktree
  load_run
  if [[ "${KEEP_WORKTREE_FLAG:-}" == "1" ]]; then
    KEEP_WORKTREE="True"
  fi
  # if already reintegrated ok and worktree gone, noop
  local status state
  status="$(json_get "$RUN_JSON" "d.get('reintegrate_status')")"
  state="$(json_get "$RUN_JSON" "d.get('state')")"
  if [[ "$state" == "destroyed" ]]; then
    printf 'recover: already destroyed\n'
    return 0
  fi
  if [[ "$status" != "ok" ]]; then
    cmd_reintegrate || return $?
  fi
  # reload after reintegrate
  load_run
  if [[ "$KEEP_WORKTREE" == "True" || "$KEEP_WORKTREE" == "true" || "${KEEP_WORKTREE_FLAG:-0}" == "1" ]]; then
    printf 'recover: reintegrated; keeping worktree (--keep-worktree)\n'
    return 0
  fi
  FORCE=1 cmd_destroy
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
MERGE_TO_LAUNCH=0
MERGE_TO_LAUNCH_FLAG=0
FORCE=0
DELETE_BRANCH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_ARG="${2:-}"; shift 2 ;;
    --run-json) RUN_JSON_ARG="${2:-}"; shift 2 ;;
    --slug) SLUG_ARG="${2:-}"; shift 2 ;;
    --base) BASE_ARG="${2:-}"; shift 2 ;;
    --keep-worktree) KEEP_WORKTREE=1; KEEP_WORKTREE_FLAG=1; shift ;;
    --merge-to-launch) MERGE_TO_LAUNCH=1; MERGE_TO_LAUNCH_FLAG=1; shift ;;
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
