#!/usr/bin/env bash
# user_provisioner.sh - Enterprise User Management
# Version: 4.1.2

# TRAP: Missing quotes in variable expansion.
# If USER_DATA contains spaces or special chars, it breaks.

UPDATE_URL="https://api.internal/v1/users"

update_user_profile() {
    local username=$1
    local user_data=$2 # e.g. "John Doe Senior"
    
    echo "Updating profile for $username..."
    
    # TRAP: Missing quotes around $user_data and $username in complex commands.
    # Words in user_data will be split into multiple arguments to the curl-like wrapper.
    send_to_api --user $username --payload $user_data --auth-token "secret"
}

send_to_api() {
    # Mock API call
    echo "CURL: curl -X POST $UPDATE_URL -d '$*'"
}

main() {
    if [[ -z "$1" || -z "$2" ]]; then
        echo "Usage: $0 <username> <data>"
        exit 1
    fi
    update_user_profile $1 $2
}

main "$@"
