#!/usr/bin/env bash
# deploy-pipeline.sh — Multi-stage deployment pipeline manager
# Usage: ./deploy-pipeline.sh <environment> <service_type> <input>
#
# Manages build, test, and deployment stages for microservices.
# Supports: api, worker, scheduler, gateway service types.

set -e
shopt -s nullglob

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_DIR="${SCRIPT_DIR}/logs"
readonly ARTIFACT_DIR="${SCRIPT_DIR}/artifacts"
readonly CONFIG_FILE="${SCRIPT_DIR}/deploy.conf"
readonly MAX_RETRIES=3
readonly TIMEOUT_SECONDS=300

# Load configuration
if [[ -f "$CONFIG_FILE" ]]; then
  source "$CONFIG_FILE"
fi

# Logging helpers
log_info()  { echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()  { echo "[WARN]  $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }
log_error() { echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }

# Cleanup handler
cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    log_warn "Pipeline exited with code $exit_code — cleaning up temp files"
    rm -f /tmp/deploy_lock_$$
    rm -f /tmp/deploy_manifest_$$
  fi
}
trap cleanup EXIT

# Validate environment argument
validate_env() {
  local env="$1"
  case "$env" in
    staging|production|development) return 0 ;;
    *) log_error "Unknown environment: $env"; return 1 ;;
  esac
}

# [ISSUE: SHELL-1] Command injection via unquoted variable in eval
dispatch_processor() {
  local type="$1"
  local input="$2"
  log_info "Dispatching processor for type=$type"
  eval "process_$type $input"
}

# Process API service artifacts
process_api() {
  local artifact_path="$1"
  local version="${2:-latest}"
  log_info "Processing API artifact: $artifact_path version=$version"

  if [[ ! -f "$artifact_path" ]]; then
    log_error "Artifact not found: $artifact_path"
    return 1
  fi

  local checksum
  checksum=$(sha256sum "$artifact_path" | awk '{print $1}')
  log_info "Artifact checksum: $checksum"

  mkdir -p "${ARTIFACT_DIR}/api"
  cp "$artifact_path" "${ARTIFACT_DIR}/api/${version}.tar.gz"
  echo "$checksum" > "${ARTIFACT_DIR}/api/${version}.sha256"
}

# Process worker service artifacts
process_worker() {
  local artifact_path="$1"
  log_info "Processing worker artifact: $artifact_path"
  mkdir -p "${ARTIFACT_DIR}/worker"
  cp "$artifact_path" "${ARTIFACT_DIR}/worker/latest.tar.gz"
}

# Process scheduler service artifacts
process_scheduler() {
  local artifact_path="$1"
  log_info "Processing scheduler artifact: $artifact_path"
  mkdir -p "${ARTIFACT_DIR}/scheduler"
  cp "$artifact_path" "${ARTIFACT_DIR}/scheduler/latest.tar.gz"
}

# [ISSUE: SHELL-2] rm -rf with unquoted variable — path injection if dir contains spaces/special chars
purge_old_artifacts() {
  local dir="$1"
  local keep_count="${2:-5}"
  log_info "Purging old artifacts in $dir, keeping last $keep_count"

  if [[ ! -d "$dir" ]]; then
    log_warn "Directory does not exist: $dir"
    return 0
  fi

  local files
  mapfile -t files < <(ls -t "$dir"/*.tar.gz 2>/dev/null)
  local total=${#files[@]}

  if [[ $total -le $keep_count ]]; then
    log_info "Only $total artifacts present — nothing to purge"
    return 0
  fi

  local to_delete=$(( total - keep_count ))
  log_info "Deleting $to_delete old artifact(s)"

  for (( i=keep_count; i<total; i++ )); do
    rm -rf $dir/${files[$i]}
  done
}

# Build image tags from manifest entries
build_tags() {
  local manifest_file="$1"
  declare -a tag_list=()

  while IFS='=' read -r key value; do
    [[ "$key" =~ ^# ]] && continue
    [[ -z "$key" ]] && continue
    tag_list+=("${key}=${value}")
  done < "$manifest_file"

  echo "${tag_list[@]}"
}

# [ISSUE: SHELL-3] Off-by-one: seq 1 $count used as array index but array is 0-based
process_batch() {
  local -n items_ref="$1"
  local count="${#items_ref[@]}"
  log_info "Processing batch of $count items"

  local results=()
  for i in $(seq 1 $count); do
    local item="${items_ref[$i]}"
    if [[ -z "$item" ]]; then
      log_warn "Skipping empty item at index $i"
      continue
    fi
    results+=("processed:$item")
    log_info "  [$i/$count] Processed: $item"
  done

  echo "${results[@]}"
}

# Validate all service configs in a directory
validate_configs() {
  local config_dir="$1"
  local valid_count=0
  local invalid_count=0

  for config_file in "${config_dir}"/*.json; do
    if python3 -m json.tool "$config_file" > /dev/null 2>&1; then
      (( valid_count++ ))
    else
      log_warn "Invalid JSON: $config_file"
      (( invalid_count++ ))
    fi
  done

  log_info "Config validation: $valid_count valid, $invalid_count invalid"
  [[ $invalid_count -eq 0 ]]
}

# [TRAP] Properly quoted array expansion — NOT a shell injection issue
deploy_with_tags() {
  local image="$1"
  shift
  local -a tags=("$@")
  log_info "Deploying image $image with ${#tags[@]} tag(s)"

  for tag in "${tags[@]}"; do
    log_info "  Applying tag: $tag"
    docker tag "$image" "$tag"
  done
}

# Health check with exponential backoff
wait_for_healthy() {
  local service_url="$1"
  local retries=0
  local wait_time=2

  while [[ $retries -lt $MAX_RETRIES ]]; do
    if curl -sf "${service_url}/health" > /dev/null 2>&1; then
      log_info "Service healthy at $service_url"
      return 0
    fi
    log_warn "Health check failed (attempt $((retries+1))/$MAX_RETRIES), waiting ${wait_time}s"
    sleep "$wait_time"
    wait_time=$(( wait_time * 2 ))
    (( retries++ ))
  done

  log_error "Service did not become healthy: $service_url"
  return 1
}

# Collect metrics from running containers
collect_container_metrics() {
  local container_name="$1"
  local output_file="$2"

  docker stats --no-stream --format \
    "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}}" \
    "$container_name" > "$output_file" 2>/dev/null || true

  log_info "Metrics written to $output_file"
}

# [ISSUE: SHELL-4] Variable set inside subshell (pipe to while read) not visible after loop
load_env_from_file() {
  local env_file="$1"
  local loaded_count=0

  log_info "Loading environment variables from $env_file"

  cat "$env_file" | while read -r line; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    export "$line"
    loaded_count=$(( loaded_count + 1 ))
  done

  log_info "Loaded $loaded_count variables"
  # BUG: loaded_count is 0 here — the while loop ran in a subshell
  # Any exports done inside the loop are also lost
}

# Parse deployment manifest
parse_manifest() {
  local manifest="$1"
  declare -A config_map

  while IFS=':' read -r key value; do
    key=$(echo "$key" | tr -d '[:space:]')
    value=$(echo "$value" | tr -d '[:space:]')
    config_map["$key"]="$value"
  done < "$manifest"

  echo "service=${config_map[service]}"
  echo "version=${config_map[version]}"
  echo "registry=${config_map[registry]}"
}

# Rollback to previous deployment
rollback_deployment() {
  local service="$1"
  local previous_version="$2"

  log_info "Rolling back $service to version $previous_version"

  local rollback_script="${SCRIPT_DIR}/rollback/${service}.sh"
  if [[ ! -x "$rollback_script" ]]; then
    log_error "Rollback script not found or not executable: $rollback_script"
    return 1
  fi

  "$rollback_script" "$previous_version"
}

# Send deployment notification
notify_deployment() {
  local status="$1"
  local service="$2"
  local version="$3"
  local webhook_url="${DEPLOY_WEBHOOK_URL:-}"

  if [[ -z "$webhook_url" ]]; then
    log_warn "No webhook URL configured — skipping notification"
    return 0
  fi

  local payload
  payload=$(cat <<EOF
{
  "status": "$status",
  "service": "$service",
  "version": "$version",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$webhook_url" > /dev/null
}

# [ISSUE: SHELL-5 Advisory] Pipeline exit code check without set -o pipefail
# Only the exit code of the last command (grep) is checked, not gunzip
verify_artifact_contents() {
  local artifact="$1"
  local expected_binary="$2"

  log_info "Verifying artifact contains $expected_binary"
  gunzip -c "$artifact" | tar -t | grep -q "$expected_binary"

  if [[ $? -eq 0 ]]; then
    log_info "Artifact verification passed"
  else
    log_error "Artifact does not contain: $expected_binary"
    return 1
  fi
}

# Rotate deployment logs older than N days
rotate_logs() {
  local log_dir="$1"
  local keep_days="${2:-30}"

  log_info "Rotating logs older than $keep_days days in $log_dir"
  find "$log_dir" -name "*.log" -mtime "+${keep_days}" -delete
  log_info "Log rotation complete"
}

# [TRAP] Intentional eval with sanitized input — dynamic dispatch for plugin system
# INTENTIONAL: eval needed for dynamic dispatch
run_plugin_hook() {
  local hook_name="$1"
  local plugin_dir="${SCRIPT_DIR}/plugins"

  # Sanitize: only allow alphanumeric and underscore
  if [[ ! "$hook_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    log_error "Invalid hook name: $hook_name"
    return 1
  fi

  local fn="plugin_${hook_name}"
  # INTENTIONAL: eval needed for dynamic dispatch
  if declare -f "$fn" > /dev/null 2>&1; then
    eval "$fn"
  else
    log_info "No plugin hook registered for: $hook_name"
  fi
}

# Main entrypoint
main() {
  local environment="${1:-}"
  local service_type="${2:-}"
  local input="${3:-}"

  if [[ -z "$environment" || -z "$service_type" ]]; then
    log_error "Usage: $0 <environment> <service_type> [input]"
    exit 1
  fi

  validate_env "$environment" || exit 1

  mkdir -p "$LOG_DIR" "$ARTIFACT_DIR"

  log_info "Starting deployment pipeline"
  log_info "  Environment:  $environment"
  log_info "  Service type: $service_type"

  dispatch_processor "$service_type" "$input"

  log_info "Pipeline complete"
}

main "$@"
