#!/usr/bin/env bash
# system_checker.sh - Health Monitoring System
# Version: 3.0.5

# TRAP: Missing set -e. If any command fails, the script continues blindly.
# This can lead to false positives in monitoring reports.

CHECK_LOG="/var/log/sys_check.log"

check_disk() {
    echo "Checking disk space..."
    df -h | grep "/dev/sda1" || return 1
}

check_services() {
    echo "Checking core services..."
    systemctl is-active --quiet nginx || echo "Nginx is DOWN"
    systemctl is-active --quiet postgresql || echo "Postgres is DOWN"
}

generate_report() {
    # If check_disk failed above, we still reach here.
    echo "System Check Report - $(date)" > /tmp/report.txt
    echo "All checks completed successfully." >> /tmp/report.txt
    mv /tmp/report.txt $CHECK_LOG
}

main() {
    check_disk
    check_services
    generate_report
    echo "Monitoring cycle finished."
}

main
