#!/usr/bin/env bash
# remote_executor.sh - Sophisticated Remote Command Dispatcher
# Version: 2.1.0

set -o pipefail

LOG_FILE="/var/log/remote_executor.log"

log_message() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*"
}

usage() {
    echo "Usage: $0 -h host -c command [-p port]"
    exit 1
}

HOST=""
COMMAND=""
PORT=22

while getopts "h:c:p:" opt; do
    case "$opt" in
        h) HOST=$OPTARG ;;
        c) COMMAND=$OPTARG ;;
        p) PORT=$OPTARG ;;
        *) usage ;;
    esac
done

if [[ -z "$HOST" || -z "$COMMAND" ]]; then
    usage
fi

execute_remote() {
    log_message "INFO" "Executing command on $HOST:$PORT"
    # TRAP: Shell injection via eval. The COMMAND is evaluated locally before/during execution context.
    local cmd="ssh -p $PORT $HOST \"eval $COMMAND\""
    eval "$cmd"
}

main() {
    if [[ ! -w "$(dirname "$LOG_FILE")" ]]; then
        LOG_FILE="./remote_executor.log"
    fi
    execute_remote
}

main "$@"
