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
# Idempotency: re-running is safe; migrated pages are skipped automatically.

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

# ── Source list (for backref matching) ───────────────────────────────────────

# Build list of available source slugs from wiki/sources/*.md filenames (bash 3 compatible)
SOURCE_SLUGS=()
for f in "$SOURCES_DIR"/*.md; do
    [[ -f "$f" ]] && SOURCE_SLUGS+=("$(basename "$f" .md)")
done

# ── Entity list (for related matching) ───────────────────────────────────────

ENTITY_SLUGS=()
for f in "$ENTITIES_DIR"/*.md; do
    [[ -f "$f" ]] && ENTITY_SLUGS+=("$(basename "$f" .md)")
done

# ── Python3 helper: process one page ─────────────────────────────────────────
# Accepts: filepath, dry_run (0/1), source_slugs (colon-separated), entity_slugs
# Prints: "SKIP|MIGRATE|CREATE [path] [fields_added]"

PYTHON_HELPER='
import sys, re, subprocess, os

filepath = sys.argv[1]
dry_run = (sys.argv[2] == "1")
source_slugs = sys.argv[3].split(":") if sys.argv[3] else []
entity_slugs = sys.argv[4].split(":") if sys.argv[4] else []

content = open(filepath, encoding="utf-8").read()

# ── Parse frontmatter ─────────────────────────────────────────────────────────
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

# ── Idempotency check ─────────────────────────────────────────────────────────
if has_fm and has_field(fm_text, "confidence"):
    print(f"SKIP {filepath} already_migrated")
    sys.exit(0)

# ── Infer confidence ──────────────────────────────────────────────────────────
session_count = len(re.findall(r"- \*\*From Session", body))
bullet_count  = len(re.findall(r"- \*\*From ", body))
see_also_match = re.search(r"→ See also:(.*?)(?:\n|$)", body)
see_also_items = [x.strip() for x in see_also_match.group(1).split(",") if x.strip()] if see_also_match else []
wiki_count = len(re.findall(r"\[\[", content))
ref_count = len(see_also_items) + wiki_count

body_word_count = len(body.split())
if session_count >= 3 and ref_count >= 2:
    confidence = "high"
elif session_count >= 1 or bullet_count >= 1:
    confidence = "medium"
elif body_word_count > 100:
    # Well-documented page using headers rather than Session bullets; not speculative
    confidence = "medium"
else:
    confidence = "low"

# ── Infer sources ─────────────────────────────────────────────────────────────
from_bullets = re.findall(r"- \*\*From ([^:*\n]+)[\*:]", content)
sources_found = []
for raw in from_bullets:
    candidate = raw.strip().lower().replace(" ", "-").replace("/", "-")[:60]
    for slug in source_slugs:
        if slug == candidate or slug in candidate or candidate in slug:
            if slug not in sources_found:
                sources_found.append(slug)
sources_yaml = "[" + ", ".join(sources_found) + "]" if sources_found else "[]"

# ── Infer related ─────────────────────────────────────────────────────────────
related_candidates = []
# From → See also: line
for item in see_also_items:
    item = re.sub(r"[\[\]]", "", item).strip()
    if item:
        related_candidates.append(item)
# From [[wikilinks]]
for link in re.findall(r"\[\[([^\]]+)\]\]", content):
    if link not in related_candidates:
        related_candidates.append(link)
# Filter to known entity slugs
related_found = [r for r in related_candidates if r in entity_slugs][:6]
related_yaml = "[" + ", ".join(related_found) + "]" if related_found else "[]"

# ── Infer dates via git ───────────────────────────────────────────────────────
def git_date(args, filepath):
    try:
        result = subprocess.check_output(
            ["git", "log"] + args + ["--format=%cs", "--", filepath],
            cwd=os.path.dirname(os.path.abspath(filepath)),
            stderr=subprocess.DEVNULL
        ).decode().strip()
        lines = [l for l in result.splitlines() if l]
        return lines[-1] if lines else ""
    except Exception:
        return ""

created = (
    git_date(["--diff-filter=A", "--follow"], filepath) or
    git_date(["--follow"], filepath) or
    "2026-04-05"
)
last_updated = (
    has_field(fm_text, "last_updated") and
    re.search(r"^last_updated:\s*(.+)", fm_text, re.MULTILINE) and
    re.search(r"^last_updated:\s*(.+)", fm_text, re.MULTILINE).group(1).strip()
) or git_date(["-1"], filepath) or "2026-04-11"
last_verified = last_updated

# ── Determine which fields to add ────────────────────────────────────────────
to_add = {}
if not has_field(fm_text, "confidence"):    to_add["confidence"] = confidence
if not has_field(fm_text, "last_verified"): to_add["last_verified"] = last_verified
if not has_field(fm_text, "created"):       to_add["created"] = created
if not has_field(fm_text, "last_updated"):  to_add["last_updated"] = last_updated
if not has_field(fm_text, "sources"):       to_add["sources"] = sources_yaml
if not has_field(fm_text, "related"):       to_add["related"] = related_yaml

fields_str = " ".join(to_add.keys())

# ── Build new frontmatter ─────────────────────────────────────────────────────
if has_fm:
    # Insert new fields before the closing ---
    new_fm_text = fm_text
    new_lines = "\n".join(f"{k}: {v}" for k, v in to_add.items())
    new_fm_text = fm_text.rstrip("\n") + "\n" + new_lines + "\n"
    new_content = f"---\n{new_fm_text}---\n{body}"
    action = "MIGRATE"
else:
    # No frontmatter — create minimal block from heading
    heading_match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
    name = heading_match.group(1).strip() if heading_match else os.path.splitext(os.path.basename(filepath))[0]
    # Detect type from path
    ftype = "source" if "/sources/" in filepath else "entity"
    fm_lines = [
        f"name: {name}",
        f"type: {ftype}",
        "description: \"\"",
        "tags: []",
        f"confidence: {confidence}",
        f"last_verified: {last_verified}",
        f"created: {created}",
        f"last_updated: {last_updated}",
        f"sources: {sources_yaml}",
        f"related: {related_yaml}",
    ]
    new_fm_text = "\n".join(fm_lines) + "\n"
    new_content = f"---\n{new_fm_text}---\n{content}"
    action = "CREATE"
    fields_str = "name type description tags confidence last_verified created last_updated sources related"

# ── Write or dry-run ──────────────────────────────────────────────────────────
if not dry_run:
    open(filepath, "w", encoding="utf-8").write(new_content)

print(f"{action} {filepath} [{fields_str}]")
'

# ── Backup ────────────────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == "false" ]]; then
    echo "📦 Creating backup tarball..."
    tar -czf "$BACKUP_PATH" -C "$WIKI_DIR" entities/ sources/ 2>/dev/null || {
        echo "Warning: Backup failed — proceeding anyway (git history is the primary rollback)" >&2
    }
    echo "   Backup: $BACKUP_PATH"
fi

# ── Main loop ─────────────────────────────────────────────────────────────────

SOURCE_SLUGS_STR=$(IFS=':'; echo "${SOURCE_SLUGS[*]}")
ENTITY_SLUGS_STR=$(IFS=':'; echo "${ENTITY_SLUGS[*]}")

SKIP_COUNT=0
MIGRATE_COUNT=0
CREATE_COUNT=0
REPORT_LINES=()
SEDIMENT_PAGES=()

if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    echo "╔═══════════════════════════════════════════╗"
    echo "║  wiki-migrate-to-v2.sh  [DRY RUN]        ║"
    echo "╚═══════════════════════════════════════════╝"
    echo ""
fi

process_pages() {
    local dir="$1"
    for f in "$dir"/*.md; do
        [[ -f "$f" ]] || continue

        # Check sediment (>8 "From Session" bullets)
        session_count=$(grep -c "^\- \*\*From Session" "$f" 2>/dev/null || true)
        if (( session_count > 8 )); then
            SEDIMENT_PAGES+=("$(basename "$f") (${session_count} From Session bullets)")
        fi

        # Run Python3 helper
        result=$(python3 -c "$PYTHON_HELPER" "$f" "$([ "$DRY_RUN" == "true" ] && echo 1 || echo 0)" "$SOURCE_SLUGS_STR" "$ENTITY_SLUGS_STR" 2>/dev/null) || {
            echo "  ⚠️  Error processing: $(basename "$f")" >&2
            continue
        }

        action="${result%% *}"
        rest="${result#* }"

        case "$action" in
            SKIP)
                SKIP_COUNT=$((SKIP_COUNT + 1))
                if [[ "$DRY_RUN" == "true" ]]; then
                    echo "  -- $(basename "$f") -- already migrated"
                fi
                REPORT_LINES+=("| $(basename "$f") | SKIP | already had confidence field |")
                ;;
            MIGRATE)
                MIGRATE_COUNT=$((MIGRATE_COUNT + 1))
                fields="${rest#* }"  # "[field1 field2 ...]"
                if [[ "$DRY_RUN" == "true" ]]; then
                    echo "  ++ $(basename "$f") -- adding: ${fields//[\[\]]/}"
                fi
                REPORT_LINES+=("| $(basename "$f") | MIGRATE | added ${fields//[\[\]]/} |")
                ;;
            CREATE)
                CREATE_COUNT=$((CREATE_COUNT + 1))
                if [[ "$DRY_RUN" == "true" ]]; then
                    echo "  ** $(basename "$f") -- no frontmatter, creating full block"
                fi
                REPORT_LINES+=("| $(basename "$f") | CREATE | no prior frontmatter -- full block created |")
                ;;
        esac
    done
}

process_pages "$ENTITIES_DIR"
process_pages "$SOURCES_DIR"

TOTAL=$((SKIP_COUNT + MIGRATE_COUNT + CREATE_COUNT))

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  wiki-migrate-to-v2.sh  Results          ║"
if [[ "$DRY_RUN" == "true" ]]; then
echo "║  Mode: DRY RUN (no files written)        ║"
else
echo "║  Mode: LIVE                               ║"
fi
echo "╚═══════════════════════════════════════════╝"
printf "  %-12s %d pages processed\n" "Total:" "$TOTAL"
printf "  %-12s %d already migrated (skipped)\n" "Skipped:" "$SKIP_COUNT"
printf "  %-12s %d frontmatter fields added\n" "Migrated:" "$MIGRATE_COUNT"
printf "  %-12s %d full frontmatter blocks created\n" "Created:" "$CREATE_COUNT"

if [[ ${#SEDIMENT_PAGES[@]} -gt 0 ]]; then
    echo ""
    echo "  ⚠️  Sediment review (>8 'From Session' bullets):"
    for p in "${SEDIMENT_PAGES[@]}"; do
        echo "    - $p"
    done
fi

if [[ "$DRY_RUN" == "false" ]] && [[ $MIGRATE_COUNT -gt 0 || $CREATE_COUNT -gt 0 ]]; then
    echo ""
    echo "  Backup:  $BACKUP_PATH"
    echo "  Report:  $REPORT_PATH"
fi

# ── Write audit report ────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == "false" ]]; then
    {
        echo "# Wiki v2 Migration Report — $TODAY"
        echo ""
        echo "Run at: $TIMESTAMP"
        echo "Mode: LIVE"
        echo ""
        echo "## Summary"
        echo ""
        echo "- Total pages processed: $TOTAL"
        echo "- Skipped (already migrated): $SKIP_COUNT"
        echo "- Migrated (fields added): $MIGRATE_COUNT"
        echo "- Created (full frontmatter): $CREATE_COUNT"
        echo ""
        if [[ ${#SEDIMENT_PAGES[@]} -gt 0 ]]; then
            echo "## Pages Requiring Manual Review (Sediment: >8 From Session bullets)"
            echo ""
            for p in "${SEDIMENT_PAGES[@]}"; do
                echo "- $p"
            done
            echo ""
            echo "Decision note: Review each page above and add a ## Contradictions section if needed."
            echo ""
        fi
        echo "## Page-by-Page Results"
        echo ""
        echo "| Page | Action | Notes |"
        echo "|------|--------|-------|"
        for line in "${REPORT_LINES[@]}"; do
            echo "$line"
        done
        echo ""
        echo "## Rollback"
        echo ""
        echo "Primary: \`git revert <migration-commit>\`"
        echo "Secondary: Extract backup tarball: \`tar -xzf $BACKUP_PATH -C $WIKI_DIR\`"
    } > "$REPORT_PATH"
    echo ""
    echo "  ✓ Audit report written: $REPORT_PATH"
fi

if [[ "$DRY_RUN" == "false" && $TOTAL -gt 0 ]]; then
    echo ""
    echo "  Next: /wiki-lint to verify 0 missing v2 frontmatter pages"
fi
