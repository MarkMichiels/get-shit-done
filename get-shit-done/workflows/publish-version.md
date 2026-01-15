# Publish Version Workflow

Automate GSD version releases with changelog generation from commits.

<process>

<step name="check_prerequisites">
Verify repository state before publishing:

```bash
# Check for uncommitted changes
git status --porcelain
```

**If uncommitted changes exist:**
```
❌ Cannot publish with uncommitted changes.

Please commit or stash changes first:
- `git status` to see changes
- `git stash` to temporarily stash
- `git commit` to commit changes
```
STOP here.

```bash
# Get current branch
git rev-parse --abbrev-ref HEAD
```

**If not on main/master:**
```
⚠️  Publishing from branch: {branch}

Typically you publish from main. Continue anyway?
```
Wait for confirmation in interactive mode. YOLO mode continues.
</step>

<step name="get_last_version">
Get current version and last tag:

```bash
# Current version from package.json
grep '"version"' package.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+'

# Last git tag
git describe --tags --abbrev=0 2>/dev/null || echo "none"

# Commits since last tag (or all if no tag)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null)
if [ -n "$LAST_TAG" ]; then
  git log ${LAST_TAG}..HEAD --oneline
else
  git log --oneline -20
fi
```

Store current version and commit list for analysis.
</step>

<step name="analyze_commits">
Categorize commits by conventional commit type:

**Parse commit messages:**
- `feat:` → Added section
- `fix:` → Fixed section
- `docs:` → Documentation (usually not in changelog)
- `refactor:` → Changed section
- `perf:` → Changed section (performance)
- `test:` → Usually not in changelog
- `chore:` → Usually not in changelog
- `BREAKING:` or `!:` → Breaking Changes section

**Build changelog entry:**

```markdown
## [{new_version}] - {date}

### Added
- {feat commits, reworded as user-facing changes}

### Changed
- {refactor/perf commits that affect user experience}

### Fixed
- {fix commits, reworded as user-facing fixes}

### Breaking Changes
- {commits with BREAKING or ! in type}
```

Only include sections that have content.
</step>

<step name="determine_version_bump">
Determine version bump from commit types:

**Automatic detection:**
- `BREAKING` or `!` present → major bump
- Any `feat:` present → minor bump
- Only `fix:`, `docs:`, etc. → patch bump

**If bump type argument provided:**
Use specified bump type (patch/minor/major) regardless of commits.

**Calculate new version:**
```bash
# Parse current version
CURRENT=$(grep '"version"' package.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
MAJOR=$(echo $CURRENT | cut -d. -f1)
MINOR=$(echo $CURRENT | cut -d. -f2)
PATCH=$(echo $CURRENT | cut -d. -f3)

# Apply bump
case $BUMP_TYPE in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
esac
```
</step>

<step name="draft_changelog">
Present changelog draft for review:

```
## Changelog Draft

Version: {current} → {new_version}
Bump type: {patch/minor/major} ({reason})

---

## [{new_version}] - {YYYY-MM-DD}

### Added
- {generated entries}

### Changed
- {generated entries}

### Fixed
- {generated entries}

---

Edit this draft? (yes/no/abort)
```

<if mode="interactive">
Wait for user response:
- `yes` → Use AskUserQuestion to collect edits
- `no` → Proceed with draft as-is
- `abort` → Exit without publishing
</if>

<if mode="yolo">
Proceed with draft automatically.
Brief notification: "Using generated changelog for {new_version}"
</if>
</step>

<step name="update_files">
Update CHANGELOG.md and package.json:

**1. Update CHANGELOG.md:**

Insert new version section after `## [Unreleased]` line:
- Add empty line after [Unreleased]
- Add new version section
- Add link reference at bottom

**2. Update package.json:**

Replace version string:
```bash
sed -i 's/"version": "[^"]*"/"version": "{new_version}"/' package.json
```

**3. Add link reference to CHANGELOG.md:**

Find the `[Unreleased]:` link line and:
- Update it to point to new comparison: `[Unreleased]: .../compare/v{new_version}...HEAD`
- Add new version link: `[{new_version}]: .../releases/tag/v{new_version}`

</step>

<step name="commit_and_tag">
Create release commit and tag:

```bash
# Stage files
git add CHANGELOG.md package.json

# Commit
git commit -m "{new_version}

Release version {new_version}

Co-Authored-By: Claude <noreply@anthropic.com>"

# Create tag
git tag -a "v{new_version}" -m "Version {new_version}"
```

Confirm: "Created commit and tag v{new_version}"
</step>

<step name="push_confirmation">
Confirm before pushing:

```
📦 Ready to publish v{new_version}

Commit: {commit_hash}
Tag: v{new_version}

This will:
1. Push commit to origin/{branch}
2. Push tag v{new_version}

Proceed with push?
```

<if mode="interactive">
Wait for confirmation.
</if>

<if mode="yolo">
Auto-confirm after brief notification.
</if>

**On confirmation:**
```bash
git push origin {branch}
git push origin v{new_version}
```

**On abort:**
```
Push cancelled. The commit and tag remain local.

To undo: git reset --soft HEAD~1 && git tag -d v{new_version}
To push later: git push && git push --tags
```
</step>

<step name="completion">
Display completion summary:

```
✅ Published v{new_version}

- CHANGELOG.md updated
- package.json bumped to {new_version}
- Commit: {commit_hash}
- Tag: v{new_version}
- Pushed to origin/{branch}

Next steps:
- npm publish (if publishing to npm)
- Create GitHub release (optional)
```
</step>

</process>

<success_criteria>
- [ ] No uncommitted changes before starting
- [ ] Commits analyzed and categorized
- [ ] Version bump determined (auto or manual)
- [ ] Changelog entry generated and reviewed
- [ ] CHANGELOG.md updated with new version section
- [ ] package.json version bumped
- [ ] Commit created with version as message
- [ ] Tag created: v{version}
- [ ] Changes pushed to remote
</success_criteria>
