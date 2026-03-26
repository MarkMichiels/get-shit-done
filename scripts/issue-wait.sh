#!/bin/bash
# issue-wait.sh — Block until new issues are signaled, then return
#
# Called by build-all after completing all phases. Blocks the Claude session
# until a debug session or test runner signals new issues via issue-signal.sh.
#
# Usage:
#   issue-wait.sh                          # Watch current .planning/, default timeout
#   issue-wait.sh /path/to/.planning       # Watch specific project
#   issue-wait.sh .planning 600            # Custom timeout (seconds, default 600 = 10min)
#
# Returns:
#   "ISSUES_READY|<count>|<signaled_by>"   — new issues signaled
#   "TIMEOUT"                               — no signal within timeout
#
# Protocol:
#   - Watches .build-all-inbox.json for creation/modification
#   - Uses inotifywait if available, falls back to polling (2s interval)
#   - On signal: outputs structured result, does NOT clear the inbox
#     (build-all clears it after reading ISSUES.md)

set -euo pipefail

PLANNING_DIR="${1:-.planning}"
TIMEOUT="${2:-600}"
INBOX_FILE="$PLANNING_DIR/.build-all-inbox.json"

# If inbox already exists (leftover from before), clear it first
if [[ -f "$INBOX_FILE" ]]; then
    rm -f "$INBOX_FILE"
fi

echo "Watching for new issues... (timeout: ${TIMEOUT}s)" >&2
echo "Signal with: bash scripts/issue-signal.sh $PLANNING_DIR" >&2

# Try inotifywait first (instant, no CPU usage)
if command -v inotifywait &>/dev/null; then
    # Watch for the inbox file to be created or modified
    if inotifywait -t "$TIMEOUT" -e create -e modify "$PLANNING_DIR" \
        --include '.build-all-inbox.json' 2>/dev/null; then
        # Small delay to ensure file is fully written
        sleep 0.2
        if [[ -f "$INBOX_FILE" ]]; then
            COUNT=$(python3 -c "import json; d=json.load(open('$INBOX_FILE')); print(d.get('issue_count',0))" 2>/dev/null || echo "?")
            BY=$(python3 -c "import json; d=json.load(open('$INBOX_FILE')); print(d.get('signaled_by','unknown'))" 2>/dev/null || echo "unknown")
            echo "ISSUES_READY|$COUNT|$BY"
            exit 0
        fi
    fi
    echo "TIMEOUT"
    exit 0
fi

# Fallback: polling (works everywhere)
ELAPSED=0
INTERVAL=2

while [[ $ELAPSED -lt $TIMEOUT ]]; do
    if [[ -f "$INBOX_FILE" ]]; then
        COUNT=$(python3 -c "import json; d=json.load(open('$INBOX_FILE')); print(d.get('issue_count',0))" 2>/dev/null || echo "?")
        BY=$(python3 -c "import json; d=json.load(open('$INBOX_FILE')); print(d.get('signaled_by','unknown'))" 2>/dev/null || echo "unknown")
        echo "ISSUES_READY|$COUNT|$BY"
        exit 0
    fi
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo "TIMEOUT"
