#!/usr/bin/env bash
# backup_manager.sh - Corporate Backup Utility
# Version: 1.4.2

SOURCE_DIR=""
DEST_DIR="/backup/daily"

log() { echo "[$(date +'%Y%m%dT%H%M%S')] $*"; }

while getopts "s:d:" opt; do
    case "$opt" in
        s) SOURCE_DIR=$OPTARG ;;
        d) DEST_DIR=$OPTARG ;;
        *) exit 1 ;;
    esac
done

if [[ -z "$SOURCE_DIR" ]]; then
    echo "Source directory required."
    exit 1
fi

perform_backup() {
    log "Starting backup from $SOURCE_DIR to $DEST_DIR"
    
    # TRAP: Brittle path handling and missing quotes. 
    # If filenames have spaces, this loop and the cp command will fail.
    # Also DEST_DIR is not quoted in the mkdir.
    mkdir -p $DEST_DIR
    
    for file in $(ls $SOURCE_DIR); do
        log "Copying $file..."
        cp $SOURCE_DIR/$file $DEST_DIR/
    done
}

perform_backup
