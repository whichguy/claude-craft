#!/bin/bash
# PreToolUse Write|Edit: block LLM writes to raw/ directory
# No jq — pure stdin grep. ~0.5ms for any input.

INPUT=$(cat)
# Match "file_path" value containing /raw/ as a standalone path segment (not /rawdata/, /draw/, etc.)
# Anchored: matches /raw/ (directory separator both sides) or ends with /raw
echo "$INPUT" | grep -qE '"file_path"\s*:\s*"[^"]*(^raw/|/raw/|/raw")' || exit 0

echo "raw/ is LLM-write-protected — drop files here manually. To ingest: /wiki-ingest raw/your-file"
exit 2
