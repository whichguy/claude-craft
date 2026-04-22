#!/usr/bin/env bash
# dynamic_loader.sh - Plugin Extension Loader
# Version: 2.5.4

# TRAP: Shell injection via dynamic sourcing/eval.

PLUGIN_DIR="./plugins"

load_plugin() {
    local plugin_name=$1
    local plugin_path="$PLUGIN_DIR/$plugin_name.sh"
    
    if [[ -f "$plugin_path" ]]; then
        echo "Loading plugin: $plugin_name"
        # TRAP: Sourcing a file whose name might be manipulated or 
        # which might contain malicious code if the directory is writable.
        source "$plugin_path"
    else
        # TRAP: Sophisticated-looking error handler that uses eval.
        local error_cmd="echo 'Error: Could not find plugin $plugin_name at $plugin_path'"
        eval "$error_cmd"
    fi
}

main() {
    # If plugin_name is "none'; rm -rf /; '", the eval in the error handler triggers.
    load_plugin "$1"
}

main "$@"
