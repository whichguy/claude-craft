#!/usr/bin/env bash
# wiki-migrate-to-v2.sh — Migrate wiki entity/source pages to SCHEMA v2 frontmatter.
# Adds: confidence, last_verified, created, last_updated, sources, related.
# Idempotency: skips pages that already have `confidence:` in frontmatter.
# Body content is never modified — insertions only; diffs are reviewable and squashable.
#
# Usage:
#   ./tools/wiki-migrate-to-v2.sh [--dry-run] [--wiki-dir PATH]
#
# Options:
#   --dry-run     Print proposed changes to stdout without writing files.
#   --wiki-dir    Path to wiki directory (default: auto-discovered via wiki/log.md).
#
# Output:
#   wiki/maintenance/migrate-v2-YYYY-MM-DD.md   — audit trail
#   wiki/maintenance/pre-v2-backup-YYYY-MM-DD.tar.gz — rollback safety net
#   wiki/maintenance/.migrate.lock               — concurrency guard (auto-released)
#
# Rollback:   git revert <migration-commit>
# Idempotency: re-running is safe; migrated pages (with confidence: field) are skipped.

set -eo pipefail
shopt -s nullglob

# ── Config ────────────────────────────────────────────────────────────────────

DRY_RUN=false
WIKI_DIR_ARG=""
TODAY=$(date '+%Y-%m-%d')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --wiki-dir) WIKI_DIR_ARG="$2"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

# ── Find repo and wiki root ───────────────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [[ -n "$WIKI_DIR_ARG" ]]; then
    WIKI_DIR="$WIKI_DIR_ARG"
elif [[ -f "$REPO_ROOT/wiki/log.md" ]]; then
    WIKI_DIR="$REPO_ROOT/wiki"
else
    echo "Error: No wiki found. Pass --wiki-dir or run from a repo with wiki/log.md." >&2
    exit 1
fi

ENTITIES_DIR="$WIKI_DIR/entities"
SOURCES_DIR="$WIKI_DIR/sources"
MAINTENANCE_DIR="$WIKI_DIR/maintenance"
LOCK_FILE="$MAINTENANCE_DIR/.migrate.lock"
REPORT_PATH="$MAINTENANCE_DIR/migrate-v2-${TODAY}.md"
BACKUP_PATH="$MAINTENANCE_DIR/pre-v2-backup-${TODAY}.tar.gz"

# ── Lock acquisition ──────────────────────────────────────────────────────────

cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

if [[ -f "$LOCK_FILE" ]]; then
    echo "Error: Migration already running (lock: $LOCK_FILE). If stale, delete it manually." >&2
    exit 1
fi

if [[ "$DRY_RUN" == "false" ]]; then
    echo "$$" > "$LOCK_FILE"
fi

# ── Source list (for backref matching) — bash 3 compatible ───────────────────

SOURCE_SLUGS=()
for f in "$SOURCES_DIR"/*.md; do
    [[ -f "$f" ]] && SOURCE_SLUGS+=("$(basename "$f" .md)")
done

ENTITY_SLUGS=()
for f in "$ENTITIES_DIR"/*.md; do
    [[ -f "$f" ]] && ENTITY_SLUGS+=("$(basename "$f" .md)")
done

# ── Python3 per-page processor ────────────────────────────────────────────────
# Args: filepath dry_run(0|1) source_slugs(colon-sep) entity_slugs(colon-sep)
# Stdout: "SKIP|MIGRATE|CREATE <path> [<fields>]"

PYTHON_HELPER='
import sys, re, subprocess, os

filepath = sys.argv[1]
dry_run = (sys.argv[2] == "1")
source_slugs = sys.argv[3].split(":") if sys.argv[3] else []
entity_slugs = sys.argv[4].split(":") if sys.argv[4] else []

content = open(filepath, encoding="utf-8").read()
fm_pattern = re.compile(r"^---\n(.*?)^---\n", re.DOTALL | re.MULTILINE)
fm_match = fm_pattern.match(content)

if fm_match:
    fm_text = fm_match.group(1)
    body = content[fm_match.end():]
    has_fm = True
else:
    fm_text = ""
    body = content
    has_fm = False

def has_field(fm, field):
    return bool(re.search(r"^" + re.escape(field) + r":", fm, re.MULTILINE))

# Idempotency
if has_fm and has_field(fm_text, "confidence"):
    print("SKIP {} already_migrated".format(filepath))
    sys.exit(0)

# Confidence heuristic
session_count = len(re.findall(r"- \*\*From Session", body))
bullet_count  = len(re.findall(r"- \*\*From ", body))
see_also_match = re.search(r"see also:(.*?)(?:\n|$)", body, re.IGNORECASE)
see_also_items = [x.strip() for x in see_also_match.group(1).split(",") if x.strip()] if see_also_match else []
wiki_count = len(re.findall(r"\[\[", content))
ref_count = len(see_also_items) + wiki_count
body_word_count = len(body.split())

if session_count >= 3 and ref_count >= 2:
    confidence = "high"
elif session_count >= 1 or bullet_count >= 1:
    confidence = "medium"
elif body_word_count > 100:
    confidence = "medium"
else:
    confidence = "low"

# Sources: match From bullets against known source slugs
from_bullets = re.findall(r"- \*\*From ([^:*\n]+)[\*:]", content)
sources_found = []
for raw in from_bullets:
    candidate = raw.strip().lower().replace(" ", "-").replace("/", "-")[:60]
    for slug in source_slugs:
        if slug == candidate or slug in candidate or candidate in slug:
            if slug not in sources_found:
                sources_found.append(slug)
sources_yaml = "[" + ", ".join(sources_found) + "]" if sources_found else "[]"

# Related: extract from See also + wikilinks, filter to known entity slugs
related_candidates = []
for item in see_also_items:
    item = re.sub(r"[\[\]]", "", item).strip()
    if item:
        related_candidates.append(item)
for link in re.findall(r"\[\[([^\]]+)\]\]", content):
    if link not in related_candidates:
        related_candidates.append(link)
related_found = [r for r in related_candidates if r in entity_slugs][:6]
related_yaml = "[" + ", ".join(related_found) + "]" if related_found else "[]"

# Dates via git
def git_date(args, filepath):
    try:
        out = subprocess.check_output(
            ["git", "log"] + args + ["--format=%cs", "--", filepath],
            cwd=os.path.dirname(os.path.abspath(filepath)),
            stderr=subprocess.DEVNULL
        ).decode().strip()
        lines = [l for l in out.splitlines() if l]
        return lines[-1] if lines else ""
    except Exception:
        return ""

created = git_date(["--diff-filter=A", "--follow"], filepath) or git_date(["--follow"], filepath) or "2026-04-05"
existing_lu = re.search(r"^last_updated:\s*(.+)", fm_text, re.MULTILINE)
last_updated = existing_lu.group(1).strip() if existing_lu else (git_date(["-1"], filepath) or "2026-04-11")
last_verified = last_updated

to_add = {}
if not has_field(fm_text, "confidence"):    to_add["confidence"] = confidence
if not has_field(fm_text, "last_verified"): to_add["last_verified"] = last_verified
if not has_field(fm_text, "created"):       to_add["created"] = created
if not has_field(fm_text, "last_updated"):  to_add["last_updated"] = last_updated
if not has_field(fm_text, "sources"):       to_add["sources"] = sources_yaml
if not has_field(fm_text, "related"):       to_add["related"] = related_yaml

fields_str = " ".join(to_add.keys()) if to_add else "(none)"

if has_fm:
    new_lines = "\n".join("{}: {}".format(k, v) for k, v in to_add.items())
    new_fm_text = fm_text.rstrip("\n") + ("\n" + new_lines if new_lines else "") + "\n"
    new_content = "---\n" + new_fm_text + "---\n" + body
    action = "MIGRATE"
else:
    heading_match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
    name = heading_match.group(1).strip() if heading_match else os.path.splitext(os.path.basename(filepath))[0]
    ftype = "source" if "/sources/" in filepath else "entity"
    fm_lines = [
        "name: {}".format(name),
        "type: {}".format(ftype),
        "description: \"\"",
        "tags: []",
        "confidence: {}".format(confidence),
        "last_verified: {}".format(last_verified),
        "created: {}".format(created),
        "last_updated: {}".format(last_updated),
        "sources: {}".format(sources_yaml),
        "related: {}".format(related_yaml),
    ]
    new_content = "---\n" + "\n".join(fm_lines) + "\n---\n" + content
    action = "CREATE"
    fields_str = "name type description tags confidence last_verified created last_updated sources related"

if not dry_run:
    with open(filepath, "w", encoding="utf-8") as fh:
        fh.write(new_content)

print("{} {} [{}]".format(action, filepath, fields_str))
'

# ── Backup (live mode only) ───────────────────────────────────────────────────

if [[ "$DRY_RUN" == "false" ]]; then
    echo "Backing up wiki content..."
    tar -czf "$BACKUP_PATH" -C "$WIKI_DIR" entities/ sources/ 2>/dev/null || \
        echo "Warning: Backup failed — git history is the primary rollback" >&2
    echo "  Backup: $BACKUP_PATH"
fi

# ── Main loop ─────────────────────────────────────────────────────────────────

SOURCE_SLUGS_STR=$(IFS=':'; echo "${SOURCE_SLUGS[*]}")
ENTITY_SLUGS_STR=$(IFS=':'; echo "${ENTITY_SLUGS[*]}")
DRY_FLAG="$([ "$DRY_RUN" == "true" ] && echo 1 || echo 0)"

SKIP_COUNT=0; MIGRATE_COUNT=0; CREATE_COUNT=0
REPORT_LINES=()
SEDIMENT_PAGES=()

# Pre-run corpus state snapshot (disambiguates SKIP output on re-runs)
PREMIGRATED=$(grep -rL "^confidence:" "$ENTITIES_DIR"/*.md "$SOURCES_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Pre-run: $PREMIGRATED pages lacking confidence field"

[[ "$DRY_RUN" == "true" ]] && echo "" && echo "=== wiki-migrate-to-v2.sh [DRY RUN] ===" && echo ""

for f in "$ENTITIES_DIR"/*.md "$SOURCES_DIR"/*.md; do
    [[ -f "$f" ]] || continue

    # Sediment detection
    sc=$(grep -c "^\- \*\*From Session" "$f" 2>/dev/null || true)
    (( sc > 8 )) && SEDIMENT_PAGES+=("$(basename "$f") (${sc} bullets)")

    # Process page
    result=$(python3 -c "$PYTHON_HELPER" "$f" "$DRY_FLAG" "$SOURCE_SLUGS_STR" "$ENTITY_SLUGS_STR" 2>/dev/null) || {
        echo "  WARNING: Error processing $(basename "$f")" >&2
        continue
    }

    action="${result%% *}"
    rest="${result#* }"

    case "$action" in
        SKIP)
            SKIP_COUNT=$((SKIP_COUNT + 1))
            [[ "$DRY_RUN" == "true" ]] && echo "  -- $(basename "$f") (already migrated)"
            REPORT_LINES+=("| $(basename "$f") | SKIP | already had confidence field |")
            ;;
        MIGRATE)
            MIGRATE_COUNT=$((MIGRATE_COUNT + 1))
            fields="${rest#* }"
            [[ "$DRY_RUN" == "true" ]] && echo "  ++ $(basename "$f") [${fields//[\[\]]/}]"
            REPORT_LINES+=("| $(basename "$f") | MIGRATE | added ${fields//[\[\]]/} |")
            ;;
        CREATE)
            CREATE_COUNT=$((CREATE_COUNT + 1))
            [[ "$DRY_RUN" == "true" ]] && echo "  ** $(basename "$f") (no prior frontmatter)"
            REPORT_LINES+=("| $(basename "$f") | CREATE | full block created |")
            ;;
    esac
done

TOTAL=$((SKIP_COUNT + MIGRATE_COUNT + CREATE_COUNT))

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=== wiki-migrate-to-v2.sh Results ==="
[[ "$DRY_RUN" == "true" ]] && echo "Mode: DRY RUN" || echo "Mode: LIVE"
printf "  Total     %d pages\n" "$TOTAL"
printf "  Skipped   %d (already migrated)\n" "$SKIP_COUNT"
printf "  Migrated  %d (fields added)\n" "$MIGRATE_COUNT"
printf "  Created   %d (full blocks)\n" "$CREATE_COUNT"

if [[ ${#SEDIMENT_PAGES[@]} -gt 0 ]]; then
    echo ""
    echo "  Sediment (>8 From Session bullets) — manual review:"
    for p in "${SEDIMENT_PAGES[@]}"; do echo "    - $p"; done
fi

# ── Audit report ──────────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == "false" ]]; then
    {
        echo "# Wiki v2 Migration Report -- $TODAY"
        echo "Run at: $TIMESTAMP | Total: $TOTAL | Skipped: $SKIP_COUNT | Migrated: $MIGRATE_COUNT | Created: $CREATE_COUNT"
        echo ""
        if [[ ${#SEDIMENT_PAGES[@]} -gt 0 ]]; then
            echo "## Manual Review (sediment)"
            for p in "${SEDIMENT_PAGES[@]}"; do echo "- $p"; done
            echo ""
        fi
        echo "## Page Results"
        echo "| Page | Action | Notes |"
        echo "|------|--------|-------|"
        for line in "${REPORT_LINES[@]}"; do echo "$line"; done
        echo ""
        echo "Rollback: git revert <migration-commit> OR tar -xzf $BACKUP_PATH -C $WIKI_DIR"
    } > "$REPORT_PATH"
    echo ""
    echo "  Report: $REPORT_PATH"
    [[ $TOTAL -gt 0 ]] && echo "  Next: /wiki-lint to verify 0 missing v2 frontmatter pages"
fi
