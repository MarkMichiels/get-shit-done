#!/bin/bash
# gsd-poll.sh — Sleep then count open issues. Used by daemon loops.
#
# Usage:
#   gsd-poll.sh                    # Sleep 60s, count issues in .planning/
#   gsd-poll.sh .planning 30       # Sleep 30s, count issues in .planning/
#   gsd-poll.sh /path/.planning    # Sleep 60s, count in specific path
#   gsd-poll.sh --now .planning    # No sleep, just count (for initial check)
#
# Output: single line — the number of open issues (e.g., "0" or "3")
# Exit code: 0 always (even if no ISSUES.md exists)

set -euo pipefail

# Parse args
SLEEP_TIME=60
PLANNING_DIR=".planning"
NO_SLEEP=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --now) NO_SLEEP=true; shift ;;
        [0-9]*) SLEEP_TIME="$1"; shift ;;
        *) PLANNING_DIR="$1"; shift ;;
    esac
done

ISSUES_FILE="$PLANNING_DIR/ISSUES.md"

# Sleep (unless --now)
if [ "$NO_SLEEP" = false ]; then
    sleep "$SLEEP_TIME"
fi

# Count open issues
if [[ -f "$ISSUES_FILE" ]]; then
    awk '/^## Open Enhancements/,0 { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' "$ISSUES_FILE"
else
    echo "0"
fi
