#!/bin/bash
# issue-signal.sh — Signal that new issues are ready for build-all to pick up
#
# Called by debug sessions, test runners, or manual users AFTER writing
# issues to ISSUES.md. This is the "go" signal — build-all watches for it.
#
# Usage:
#   issue-signal.sh                      # Signal from current .planning/
#   issue-signal.sh /path/to/.planning   # Signal a specific project
#   issue-signal.sh --reset              # Clear the signal (build-all does this after pickup)
#
# Protocol:
#   - Issues are written to ISSUES.md (data, can take multiple steps)
#   - This script writes .build-all-inbox.json (atomic signal)
#   - build-all watches .build-all-inbox.json via issue-wait.sh
#   - After pickup, build-all calls issue-signal.sh --reset

set -euo pipefail

PLANNING_DIR="${1:-.planning}"
INBOX_FILE="$PLANNING_DIR/.build-all-inbox.json"

# Handle --reset
if [[ "${1:-}" == "--reset" ]]; then
    PLANNING_DIR="${2:-.planning}"
    INBOX_FILE="$PLANNING_DIR/.build-all-inbox.json"
    rm -f "$INBOX_FILE"
    echo "Inbox cleared: $INBOX_FILE"
    exit 0
fi

# Count open issues in ISSUES.md
ISSUES_FILE="$PLANNING_DIR/ISSUES.md"
if [[ -f "$ISSUES_FILE" ]]; then
    ISSUE_COUNT=$(awk '/^## Open Enhancements/,0 { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' "$ISSUES_FILE")
else
    ISSUE_COUNT=0
fi

# Write atomic signal
mkdir -p "$PLANNING_DIR"
cat > "$INBOX_FILE" <<EOF
{
  "signal": "issues_ready",
  "issue_count": $ISSUE_COUNT,
  "signaled_at": "$(date -Iseconds)",
  "signaled_by": "${CLAUDE_SESSION_NAME:-manual}"
}
EOF

echo "Signaled: $ISSUE_COUNT issues ready for build-all"
echo "File: $INBOX_FILE"
