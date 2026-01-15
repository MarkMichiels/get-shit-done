---
name: gsd:publish-version
description: Automate version releases with changelog generation
---

<objective>
Publish a new GSD version with automated changelog generation from commits.

Analyzes commits since last tag, generates changelog entry, bumps version, and creates release commit with tag.
</objective>

<arguments>
**Optional bump type:**
- `patch` - Bug fixes (x.y.Z)
- `minor` - New features (x.Y.0)
- `major` - Breaking changes (X.0.0)

If omitted, auto-detects from commit types:
- `feat:` → minor
- `fix:` → patch
- `BREAKING:` or `!:` → major
</arguments>

<execution_context>
@~/.claude/get-shit-done/workflows/publish-version.md
</execution_context>

<usage>
```bash
# Auto-detect version bump from commits
/gsd:publish-version

# Force specific bump type
/gsd:publish-version patch
/gsd:publish-version minor
/gsd:publish-version major
```
</usage>

<process>
1. Parse optional bump type argument
2. Load and execute publish-version.md workflow
3. Pass bump type if specified (workflow uses auto-detect if not provided)
</process>
