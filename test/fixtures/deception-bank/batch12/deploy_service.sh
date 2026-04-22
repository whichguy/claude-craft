#!/usr/bin/env bash
# deploy_service.sh - Microservice Deployment Tool
# Version: 5.0.1

# TRAP: Shell injection via unvalidated input to a command run via sh -c or similar.

DEPLOY_LOG="/var/log/deploy.log"

log() { echo "[$(date)] $*" >> "$DEPLOY_LOG"; }

deploy() {
    local service_name=$1
    local version=$2
    local extra_args=$3
    
    log "Deploying $service_name version $version"
    
    # TRAP: extra_args is passed directly into a subshell-like execution.
    # If extra_args is "; rm -rf /", it will be executed.
    echo "Running deployment tasks..."
    local deploy_cmd="docker-compose up -d $service_name $extra_args"
    
    # Using a wrapper that might use eval or sh -c internally
    run_securely "$deploy_cmd"
}

run_securely() {
    local cmd=$1
    log "Executing: $cmd"
    # TRAP: The "secure" wrapper actually uses eval.
    eval "$cmd"
}

main() {
    deploy "auth-service" "v1.2" "--scale 3; touch /tmp/hacked"
}

main
