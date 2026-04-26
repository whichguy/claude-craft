#!/bin/bash

# safe_deploy_cleanup.sh - Robust cleanup of old deployment artifacts.
# This script is designed to be run in CI/CD pipelines to prune outdated builds.

set -euo pipefail
IFS=$'\n\t'

# Configuration
BASE_ARTIFACT_DIR="/var/lib/deployments/artifacts"
MAX_AGE_DAYS=30
LOG_FILE="/var/log/deploy_cleanup.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

cleanup_artifacts() {
    local project_name="$1"
    local target_dir="${BASE_ARTIFACT_DIR}/${project_name}"

    # Validation: Ensure we don't operate outside the base directory
    if [[ ! "$target_dir" =~ ^${BASE_ARTIFACT_DIR}/ ]]; then
        log "ERROR: Invalid project name '$project_name'. Path traversal detected."
        return 1
    fi

    if [[ ! -d "$target_dir" ]]; then
        log "INFO: No artifacts found for project '$project_name'. Skipping."
        return 0
    fi

    log "Starting cleanup for project: $project_name"

    # Find and remove files older than MAX_AGE_DAYS.
    # We use -print0 and xargs -0 to safely handle filenames with spaces or special characters.
    # We also use -- to prevent argument injection in the rm command.
    find "$target_dir" -type f -mtime +"$MAX_AGE_DAYS" -print0 | xargs -0 -r rm -f --

    # Clean up empty directories, but keep the project root.
    find "$target_dir" -mindepth 1 -type d -empty -delete

    log "Cleanup completed for $project_name."
}

# Main execution loop
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <project_name1> [project_name2 ...]"
    exit 1
fi

for project in "$@"; do
    cleanup_artifacts "$project"
done
