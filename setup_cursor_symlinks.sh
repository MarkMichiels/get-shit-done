#!/bin/bash
# =============================================================================
# setup_cursor_symlinks.sh - GSD Cursor IDE Symlinks (Local Development)
# =============================================================================
#
# PURPOSE:
#   Creates a folder symlink: .cursor/commands/gsd/ -> commands/gsd/
#   This makes GSD commands available in Cursor IDE when developing GSD itself.
#
# NOTE:
#   This is for LOCAL Cursor IDE development only.
#   For Claude Code, use mark-private/setup_claude_commands.sh instead.
#
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMANDS_SOURCE="$SCRIPT_DIR/commands/gsd"
CURSOR_COMMANDS_DIR="$SCRIPT_DIR/.cursor/commands"
GSD_LINK="$CURSOR_COMMANDS_DIR/gsd"

echo "Setting up Cursor IDE symlinks for GSD development..."

# Verify source exists
if [ ! -d "$COMMANDS_SOURCE" ]; then
    echo "ERROR: Commands source not found: $COMMANDS_SOURCE"
    exit 1
fi

# Create parent directory
mkdir -p "$CURSOR_COMMANDS_DIR"

# Check if already correctly linked
if [ -L "$GSD_LINK" ]; then
    current=$(readlink "$GSD_LINK")
    if [ "$current" == "$COMMANDS_SOURCE" ]; then
        echo "✓ Already linked: .cursor/commands/gsd/ -> commands/gsd/"
        exit 0
    fi
    rm "$GSD_LINK"
fi

# Remove if it's a real directory
if [ -d "$GSD_LINK" ]; then
    echo "Removing old directory: .cursor/commands/gsd/"
    rm -rf "$GSD_LINK"
fi

# Create folder symlink
ln -s "$COMMANDS_SOURCE" "$GSD_LINK"
echo "✓ Linked: .cursor/commands/gsd/ -> commands/gsd/"

count=$(ls "$GSD_LINK"/*.md 2>/dev/null | wc -l)
echo "  $count commands available as /gsd:*"
