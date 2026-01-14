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
   - Automatically runs `node bin/install.js --global`
   - Installs the new version to `~/.claude/`
3. **If no GSD files were changed**: does nothing

## What Gets Installed?

The hook installs to the **global** location (`~/.claude/`), so all projects get the new version.

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

## Troubleshooting

**Hook not working:**
- Check if hook is executable: `ls -la .git/hooks/post-commit`
- Check if git hooks are enabled: `git config core.hooksPath`
- Test manually: `bash .git/hooks/post-commit`

**Install fails:**
- Check if Node.js is installed: `node --version`
- Check if you're in the correct directory (get-shit-done repo root)
- Run manually: `node bin/install.js --global`

