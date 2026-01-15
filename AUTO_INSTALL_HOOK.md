# GSD Auto-Install Git Hook

## Overview

This git hook automatically installs GSD after commits that modify GSD files.

## Installation

The hook is located at `.git/hooks/post-commit`. To activate it:

```bash
# Make the hook executable (if not already)
chmod +x .git/hooks/post-commit
```

## How It Works

1. **After each commit** the hook checks which files were changed
2. **If GSD files were changed** (in `commands/gsd/`, `get-shit-done/`, or `bin/install.js`):
   - Creates symlinks in `.cursor/commands/gsd/` pointing to `commands/gsd/` (for repo-local access)
   - Automatically runs `node bin/install.js --global`
   - Installs the new version to `~/.claude/`
3. **If no GSD files were changed**: does nothing

## What Gets Installed?

The hook performs two operations:

1. **Repo-local symlinks**: Creates `.cursor/commands/gsd/` with symlinks to `commands/gsd/`
   - Makes commands available in the repo itself (for development/testing)
   - Commands automatically detected by Cursor when working in this repo
   - Symlinks are tracked in git (`.cursor/commands/` should be committed)

2. **Global installation**: Installs to `~/.claude/` via `bin/install.js --global`
   - Makes commands available in all projects
   - Commands accessible via `/gsd:*` in Claude Code globally (prefix required for global installs)

## Manual Installation

If you don't want to use the hook, or want to install manually:

```bash
# Global install
npx get-shit-done-cc --global

# Or local
npx get-shit-done-cc --local
```

## Disabling

To disable the hook:

```bash
# Remove the hook
rm .git/hooks/post-commit

# Or make it non-executable
chmod -x .git/hooks/post-commit
```

## Symlink Structure

The hook creates the following structure:

```
get-shit-done/
├── commands/gsd/           ← Source commands (tracked in git)
│   ├── help.md
│   ├── new-project.md
│   └── ...
└── .cursor/
    └── commands/
        └── gsd/            ← Symlinks to commands/gsd/ (tracked in git)
            ├── help.md → ../../commands/gsd/help.md
            ├── new-project.md → ../../commands/gsd/new-project.md
            └── ...
```

**Why symlinks?**
- Keeps a single source of truth (`commands/gsd/`)
- Makes commands available in the repo for development
- Allows testing commands before global installation
- Symlinks are lightweight and easy to maintain

## Troubleshooting

**Hook not working:**
- Check if hook is executable: `ls -la .git/hooks/post-commit`
- Check if git hooks are enabled: `git config core.hooksPath`
- Test manually: `bash .git/hooks/post-commit`

**Install fails:**
- Check if Node.js is installed: `node --version`
- Check if you're in the correct directory (get-shit-done repo root)
- Run manually: `node bin/install.js --global`

**Symlinks not created:**
- Check if `.cursor/commands/` directory exists: `ls -la .cursor/commands/`
- Verify symlinks: `ls -la .cursor/commands/gsd/` (should show `-> ../../commands/gsd/`)
- Create manually: `mkdir -p .cursor/commands/gsd && cd .cursor/commands/gsd && for f in ../../commands/gsd/*.md; do ln -sf "$f" "$(basename "$f")"; done`
