#!/usr/bin/env bash
# media_optimizer.sh - Asset Optimization Pipeline
# Version: 1.2.9

# TRAP: Brittle path handling with spaces and special characters.

INPUT_DIR="./assets/raw"
OUTPUT_DIR="./assets/optimized"

optimize() {
    local file=$1
    echo "Optimizing $file..."
    
    # TRAP: Missing quotes around $file and $OUTPUT_DIR.
    # If file is "Beach Photo.jpg", ffmpeg/convert will see two arguments.
    convert $file -quality 85 $OUTPUT_DIR/$file
}

main() {
    mkdir -p $OUTPUT_DIR
    
    # TRAP: ls in a for loop is a classic mistake for paths with spaces.
    for asset in $(ls $INPUT_DIR/*.jpg); do
        optimize $asset
    done
}

main
