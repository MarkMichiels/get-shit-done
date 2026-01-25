---
name: gsd:build-all
description: Build entire project automatically (plan → execute each phase sequentially)
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - SlashCommand
---

<objective>
Build entire project automatically by planning and executing each phase sequentially.

**Input sources:**
- ROADMAP.md - Phase goals and structure (primary input)
- ISSUES.md - Deferred issues that may become tasks (primary input)
- STATE.md - Project state, decisions, blockers
- Previous phase summaries - Context from completed work

This is the complete automation workflow:
1. Plan Phase 1 (using ROADMAP + ISSUES) → Execute all plans in Phase 1
2. Plan Phase 2 (using ROADMAP + ISSUES + Phase 1 summaries) → Execute all plans in Phase 2
3. Plan Phase 3 (using ROADMAP + ISSUES + Phase 1-2 summaries) → Execute all plans in Phase 3
4. Continue until all phases complete

This respects the iterative planning principle:
- Each phase is planned AFTER previous phase is executed
- Planning uses ROADMAP for goals and ISSUES.md for deferred enhancements
- Planning uses context from previous phase summaries
- Code builds incrementally
- Context accumulates naturally through SUMMARY.md files

**Branch-based workflow (default):**
- All development happens on a feature branch (isolated from main)
- Branch is created at start of build cycle
- All commits go to the feature branch
- At end of cycle, branch is merged to main (or target branch)
- Prevents unstable code from affecting main branch during development

**Interactive mode:**
- Workflow continues until user explicitly says "it's done" or "enough"
- Status is tracked in `.planning/.build-all-status.json` for external monitoring
- Review gate after each cycle for user feedback
- Post-evaluation to improve the command itself
- External process can optionally monitor status file for coordination
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/workflows/execute-phase.md
</execution_context>

<context>
**Input sources (used by planning):**
- @.planning/ROADMAP.md - Phase goals and structure (primary input)
- @.planning/ISSUES.md - Deferred issues that may become tasks (primary input)
- @.planning/STATE.md - Project state, decisions, blockers
- @.planning/PROJECT.md - Project vision and requirements

**Load workflow config:**
@.planning/config.json
</context>

<process>

<step name="verify">
**Verify planning structure exists:**

If no `.planning/` directory:
```
No planning structure found.

Run /gsd:new-project to start a new project.
```
Exit.
</step>

<step name="check_roadmap">
**Check if roadmap exists:**

```bash
[ -f .planning/ROADMAP.md ] && echo "ROADMAP_EXISTS" || echo "NO_ROADMAP"
```

**If NO_ROADMAP:**
```
❌ No roadmap found.

A roadmap is required to build the project. The roadmap defines all phases that need to be completed.

Create roadmap now?
```

<if mode="interactive">
Use AskUserQuestion:
- header: "Roadmap Required"
- question: "No ROADMAP.md found. Initialize project now?"
- options:
  - "Initialize project" - Run /gsd:new-project (creates PROJECT.md, ROADMAP.md, etc.)
  - "Cancel" - Exit build-all

If "Initialize project":
- Invoke: `SlashCommand("/gsd:new-project")`
- Wait for project initialization to complete
- Continue to load_roadmap step

If "Cancel":
- Exit
</if>

<if mode="yolo">
```
❌ No roadmap found. Cannot build without roadmap.

Run /gsd:new-project first to initialize the project, then retry /gsd:build-all
```
Exit.
</if>
</step>

<step name="load_roadmap">
**Load roadmap and identify phases:**

```bash
cat .planning/ROADMAP.md
```

Parse all phases from roadmap:
- Integer phases (1, 2, 3, ...)
- Decimal phases (2.1, 2.2, ...)

Count total phases and identify which need work.

**If roadmap is empty or has no phases:**
```
⚠️  Roadmap exists but contains no phases.

Update ROADMAP.md with phases manually, or delete .planning/ and run /gsd:new-project to start fresh.
```
Exit.
</step>

<step name="check_config">
**Load workflow config:**

```bash
cat .planning/config.json 2>/dev/null
```

Parse mode (yolo/interactive) and gates.
</step>

<step name="setup_branch">
**Setup development branch (default workflow):**

**Check current git status:**
```bash
# Detect current branch
git rev-parse --abbrev-ref HEAD

# Check if we're on main/master
git rev-parse --abbrev-ref HEAD | grep -E '^(main|master)$'
```

**If on main/master:**
```
🌿 Creating development branch for this build cycle
```

1. **Store original branch name:**
   ```bash
   ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
   echo "$ORIGINAL_BRANCH" > .planning/.build-all-original-branch 2>/dev/null || true
   ```

2. **Generate branch name:**
   ```bash
   # Format: build-all-YYYYMMDD-HHMMSS or build-all-cycle-N
   # Use cycle number if available from STATE.md, otherwise timestamp
   BRANCH_NAME="build-all-$(date +%Y%m%d-%H%M%S)"
   # Or if cycle tracking exists:
   # BRANCH_NAME="build-all-cycle-${CYCLE_NUMBER}"
   ```

3. **Create and switch to branch:**
   ```bash
   git checkout -b "$BRANCH_NAME"
   ```

4. **Store branch name for later merge:**
   - Original branch stored in `.planning/.build-all-original-branch`
   - Current branch name stored in `.planning/.build-all-current-branch`
   ```bash
   echo "$BRANCH_NAME" > .planning/.build-all-current-branch 2>/dev/null || true
   ```

**If already on feature branch:**
```
ℹ️  Already on feature branch: $(git rev-parse --abbrev-ref HEAD)
Continuing development on existing branch.
```

**If not a git repository:**
```
⚠️  Not a git repository. Branch workflow skipped.
Continuing without branch isolation.
```

**Branch workflow benefits:**
- Isolates development from main branch
- Allows testing/CI to run on main without interference
- Clean merge at end of cycle
- Easy rollback if cycle fails
</step>

<step name="build_loop">
**Build all phases sequentially (with issue resolution loop):**

<if mode="yolo">
```
🚀 Building Entire Project

This will plan and execute each phase sequentially.
Each phase planning uses context from previous phase summaries.
Open issues will be automatically addressed after roadmap phases complete.

Branch workflow: Development happens on isolated feature branch
Loop mode: After completion, waits 10 minutes and checks for new issues
Merge: Development branch merges to main at end of each cycle

Starting build pipeline...
```
</if>

<if mode="interactive">
```
🚀 Building Entire Project

This will plan and execute each phase sequentially.
You'll be prompted at:
- Each phase planning start
- Blocking checkpoints during execution
- Errors or failures
- Open issues resolution (after roadmap phases complete)
- Merge confirmation (if conflicts occur)

Branch workflow: Development happens on isolated feature branch
Loop mode: After completion, waits 10 minutes and checks for new issues
Merge: Development branch merges to main at end of each cycle

Proceed with full build?
```
Wait for confirmation.
</if>

**Main build loop (continues until no phases or issues remain):**

**For each phase in roadmap order:**

1. **Check phase status:**
   ```bash
   # Check if phase has plans
   ls .planning/phases/{phase-dir}/*-PLAN.md 2>/dev/null

   # Check if all plans executed
   ls .planning/phases/{phase-dir}/*-PLAN.md | wc -l
   ls .planning/phases/{phase-dir}/*-SUMMARY.md | wc -l

   # Check if research exists
   ls .planning/phases/{phase-dir}/{phase}-RESEARCH.md 2>/dev/null
   ```

2. **If phase not planned:**

   **2a. Check if research needed:**
   - Analyze phase description for complexity indicators (3D, games, audio, ML, real-time, etc.)
   - Check roadmap for `Research: Likely` flag
   - If complex AND no RESEARCH.md → research first

   **2b. Research if needed:**
   ```
   🔬 Researching Phase {X}: {Phase Name}
   /gsd:research-phase {X}
   ```
   Wait for research to complete.

   **2c. Plan the phase:**
   ```
   📋 Planning Phase {X}: {Phase Name}
   /gsd:plan-phase {X}
   ```
   Wait for planning to complete.

3. **If phase planned but not all executed:**
   ```
   ⚙️  Executing Phase {X}: {Phase Name}
   ```
   Execute the phase (handles all plans with wave-based parallelization):
   ```
   /gsd:execute-phase {X}
   ```
   Wait for phase execution to complete.

4. **If phase complete:**
   ```
   ✅ Phase {X} complete
   ```
   Skip to next phase.

5. **Update progress:**
   ```
   Progress: Phase {X}/{N} complete
   ```

**After all roadmap phases complete:**

**Step 5: Check and address open issues (see Step 5a below)**

**If issues were addressed (new phases/milestone created):**
- Return to build_loop step (plan and execute new phases)
- Continue until no phases remain AND no open issues remain

**If no issues OR all issues addressed:**
- Continue to merge_branch step (merge development branch to main)
- After merge, continue to loop_mode step (check for new issues)

**Step 5a. Check for open issues:**
```bash
# Check if ISSUES.md exists
if [ -f .planning/ISSUES.md ]; then
  # Count open issues (ISS-XXX entries in "## Open Enhancements" section)
  # Only count issues that are actually in the Open Enhancements section
  awk '/^## Open Enhancements/,/^## / { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md
else
  echo "0"
fi
```

**If open issues found (count > 0):**

Read ISSUES.md to analyze issues:
```bash
cat .planning/ISSUES.md
```

Extract from "## Open Enhancements" section:
- ISS numbers
- Type (Bug/Feature/Performance/Refactoring/UX/Testing/Documentation/Accessibility)
- Impact (High/Medium/Low)
- Description
- Suggested phase (if any)

**Analyze issues to determine action:**

1. **Count high-impact bugs:**
   - Issues with Type="Bug" AND Impact="High"
   - These are blocking and should be addressed

2. **Count high/medium-impact features:**
   - Issues with Type="Feature" AND (Impact="High" OR Impact="Medium")
   - These are valuable enhancements that should be addressed

3. **Count total issues:**
   - All issues in Open Enhancements section (including bugs, features, and other types)

4. **Determine strategy:**
   - If 2+ high-impact bugs OR 3+ total issues → Create hotfix milestone
   - If 1+ high/medium-impact features OR 1-2 issues (any type) → Add phase to current milestone
   - If 0 high-impact bugs AND 0 high/medium-impact features AND only low-impact enhancements → Can defer

**If action needed (high-impact bugs exist OR high/medium-impact features exist OR user wants to address issues):**

```
🔧 Open Issues Detected

All roadmap phases are complete, but {N} open issue(s) remain:

{List issues with ISS numbers, type, impact, and brief descriptions}

{If high-impact bugs: "⚠️  {X} high-impact bug(s) detected - these should be addressed"}
{If high/medium-impact features: "✨ {X} high/medium-impact feature(s) detected - these should be addressed"}
```

<if mode="yolo">
**Automatically address issues:**

**If 2+ high-impact bugs OR 3+ total issues:**
```
🚀 Creating hotfix milestone to address {N} open issue(s)
```
1. Determine next milestone version from ROADMAP.md (e.g., if last was v1.6 → v1.7)
2. Analyze issues and group them logically:
   - Group related issues together (e.g., all Pint evaluator bugs, all UI features)
   - Group by component/area (e.g., unit conversion, constant handling, user interface)
   - Create phase descriptions based on issue type:
     - Bugs: "Fix {component/area} ({ISS-XXX, ISS-YYY})"
     - Features: "Implement {feature description} ({ISS-XXX, ISS-YYY})"
     - Other: "{action} {component/area} ({ISS-XXX, ISS-YYY})"
3. Invoke: `SlashCommand("/gsd:new-milestone v{X.Y} Hotfix")` (or use "Enhancement" if mostly features)
4. During milestone creation, provide phase breakdown:
   - For each group of related issues, create a phase
   - Example phases:
     - "Phase {N}: Fix Pint evaluator constants and handlers (ISS-025)"
     - "Phase {N+1}: Implement dark mode toggle (ISS-042)"
     - "Phase {N+2}: Fix compound unit rate calculations (ISS-026)"
   - Use issue descriptions to inform phase goals
5. Wait for milestone creation to complete
6. Reload roadmap to get new phases
7. Continue to build_loop step (plan and execute new milestone phases)

**If 1+ high/medium-impact features OR 1-2 issues (any type):**
```
🚀 Adding phase to current milestone to address {N} open issue(s)
```
1. Read ROADMAP.md to find last phase number
2. Create phase description from issues:
   - Single issue: Extract brief description from issue
     - Bug: "Fix {description}" (e.g., "Fix Pint evaluator SymPy constants" from ISS-025)
     - Feature: "Implement {description}" (e.g., "Implement dark mode toggle" from ISS-042)
     - Other: Use issue description directly
   - Multiple issues: Combine into logical description
     - Same type: "Fix {component} issues (ISS-026, ISS-027)" or "Implement {features} (ISS-042, ISS-043)"
     - Mixed: "Address {component} (ISS-026, ISS-042)" or group by type
   - Use issue type and description to create meaningful phase name
3. Invoke: `SlashCommand("/gsd:add-phase {description}")`
4. Wait for phase creation to complete
5. Reload roadmap to get new phase
6. Continue to build_loop step (plan and execute new phase)

**After addressing issues:**
- Continue to build_loop step
- Plan and execute the new phase/milestone phases
- After those complete, check for open issues again (loop until no issues remain)
</if>

<if mode="interactive">
Use AskUserQuestion:
- header: "Open Issues Found"
- question: "{N} open issue(s) found. {If high-impact bugs: '{X} high-impact bug(s) detected.'} {If high/medium-impact features: '{X} high/medium-impact feature(s) detected.'} How would you like to proceed?"
- options:
  - "Address automatically" - Create milestone/phase and execute (same as YOLO mode)
  - "Show issues" - Display full issue details for manual review
  - "Skip for now" - Mark complete, issues remain open

**If "Address automatically" selected:**
- Follow same logic as YOLO mode above
- Create milestone or phase based on issue count/severity
- Continue to build_loop step

**If "Show issues" selected:**
- Display contents of ISSUES.md "## Open Enhancements" section
- Ask user: "Address these issues now, or skip?"
- If "Address": Follow YOLO mode logic
- If "Skip": Continue to completion message

**If "Skip for now" selected:**
- Continue to completion message (with warning)
</if>

**If no open issues (count = 0) OR all issues addressed:**
```
🎉 Build Cycle Complete!

✅ All phases planned and executed
📊 Total phases: {N}
📝 All summaries created
💾 All commits made
✅ All open issues addressed (if applicable)

Proceeding to merge and loop check...
```
</step>

<step name="merge_branch">
**Merge development branch to target branch (default workflow):**

**Only if branch workflow was used (not on main/master):**

```bash
# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Determine target branch (main, master, or branch we started from)
# Check if we have a stored "original branch" from setup_branch step
if [ -f .planning/.build-all-original-branch ]; then
  TARGET_BRANCH=$(cat .planning/.build-all-original-branch)
else
  # Otherwise, try to detect default branch
  TARGET_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || \
    git branch -r | grep -E 'origin/(main|master)' | head -1 | sed 's@origin/@@' || \
    echo "main")
fi

# Check if we're on a feature branch (starts with "build-all-")
if echo "$CURRENT_BRANCH" | grep -q "^build-all-"; then
  echo "MERGE_NEEDED"
else
  echo "NO_MERGE_NEEDED"
fi
```

**If MERGE_NEEDED:**

```
🔄 Merging development branch to {TARGET_BRANCH}
```

1. **Switch to target branch:**
   ```bash
   git checkout "$TARGET_BRANCH"
   git pull --rebase  # Ensure target is up to date
   ```

2. **Merge feature branch:**
   ```bash
   git merge "$CURRENT_BRANCH" --no-ff -m "Merge build cycle: $CURRENT_BRANCH"
   ```

3. **Handle merge conflicts:**
   - If conflicts occur, show error and pause
   - In interactive mode: Wait for user to resolve
   - In YOLO mode: Attempt automatic resolution if possible, otherwise pause

4. **Push merged changes:**
   ```bash
   git push origin "$TARGET_BRANCH"
   ```

5. **Cleanup (optional):**
   ```bash
   # Optionally delete feature branch after successful merge
   git branch -d "$CURRENT_BRANCH"
   ```

**If merge successful:**
```
✅ Successfully merged to {TARGET_BRANCH}
Code is now available on main branch.
```

**If merge failed:**
```
❌ Merge conflicts detected

Please resolve conflicts manually:
1. Fix conflicts in affected files
2. Run: git add <resolved-files>
3. Run: git commit
4. Run: git push

Then retry /gsd:build-all to continue.
```
Pause and wait for user to resolve.

**If NO_MERGE_NEEDED:**
```
ℹ️  Already on main branch. No merge needed.
```
</step>

<step name="review_gate">
**Review gate: Pause for user review (Y/N/ENOUGH to proceed):**

At this point, the build cycle should be complete:
- ✅ All phases planned and executed
- ✅ Development branch merged to main (if branch workflow used)
- ✅ Status file updated
- ❌ Not yet marked as "done" — that is expected

**Action:** Show summary and ask user to review:

```
## Build All Complete - Review

**Status:** ✅ All phases complete

**Summary:**
- Planned and executed {N} phases
- All summaries created
- All commits made
- All open issues addressed (if applicable)
- Status file updated: .planning/.build-all-status.json

**Files ready:**
- All phase summaries in .planning/phases/
- All code changes committed and merged

Please review and respond:
- **Y** = proceed to post-evaluation
- **N** = collect corrections, apply fixes, then repeat review
- **ENOUGH** = stop building, mark status as "done", workflow complete
- **CONTINUE** = check for new issues in ISSUES.md, restart cycle if found
```

**After user response:**

**If Y (proceed to post-evaluation):**
- Proceed to `post_evaluation` step
- Update status: `"status": "reviewing"`

**If N (collect corrections):**
- Apply fixes based on feedback
- Repeat `review_gate` after fixes applied

**If ENOUGH (stop building):**
- Update status file: `"status": "done"`
- Show final summary
- **Do NOT continue** - user wants to stop
- End workflow

**If CONTINUE (check for new issues):**
- Re-read ISSUES.md and count open issues
- Compare with count at start of cycle
- If new issues found, return to `build_loop` step (restart cycle)
- If no new issues, proceed to `post_evaluation`
</step>

<step name="post_evaluation">
**Post-evaluation: Retrospective + improve this command (ALWAYS DO THIS):**

At the end of the run, do a quick retrospective to make the next run faster and avoid repeating the same mistakes.

**Write a short summary (5-10 lines):**
- What was built (phases completed, issues addressed)
- Which issues were created/resolved
- What was unexpectedly tricky / slow
- User feedback received (if any)
- External process coordination (if applicable)

**Then propose concrete command improvements:**
- Which steps were unclear?
- Which missing instructions caused you to search/guess?
- Which recurring failure modes should be handled (status tracking, workspace detection, edge cases)?
- What user feedback suggests improvements?
- How can status tracking be improved?

**Apply the improvements to this command file** (`commands/gsd/build-all.md`).

**Finally ask:**
- "**YES/NO**: may I commit these command-instruction changes?"

If **YES**, commit with a separate commit message:

```bash
cd /path/to/get-shit-done
git add commands/gsd/build-all.md
git commit -m "chore(commands): improve build-all workflow based on retrospective"
```

If **NO**, do not commit (leave changes unstaged or revert).
</step>

<step name="status_tracking">
**Status tracking: Update status and wait for user/external process:**

**Status file location:** `.planning/.build-all-status.json`

**Purpose:** Allow external processes (test runners, CI, debug workflows) to monitor build progress and coordinate issue resolution.

**After merge completes, update status:**

1. **Update status file:**
   ```bash
   # Create status file
   cat > .planning/.build-all-status.json <<EOF
   {
     "status": "ready",
     "phase": "review",
     "timestamp": "$(date -Iseconds)",
     "branch": "$(git rev-parse --abbrev-ref HEAD)",
     "phases_completed": $(ls .planning/phases/*/SUMMARY.md 2>/dev/null | wc -l),
     "open_issues": $(awk '/^## Open Enhancements/,/^## / { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md 2>/dev/null || echo 0)
   }
   EOF
   ```

2. **Status values:**
   - `"status": "active"` - Currently building (workflow in progress)
   - `"status": "ready"` - Build complete, waiting for review
   - `"status": "waiting"` - Waiting for external process to create issues
   - `"status": "done"` - User said "enough", build complete

3. **Show completion summary:**
   ```
   🎉 Build Cycle Complete!

   ✅ All phases planned and executed
   📊 Total phases: {N}
   📝 All summaries created
   💾 All commits made
   ✅ All open issues addressed (if applicable)
   📄 Status file updated: .planning/.build-all-status.json

   Waiting for review or external process...
   ```

**External monitoring:**
- Python script can read status file to check if build is ready
- When status is "ready", external process can run tests and create issues
- After issues created, user can restart build cycle
- Status updates automatically at each phase transition

**Optional: External monitoring for coordination**

If you have an external process (e.g., test runner, debug workflow, CI) that creates issues:

1. External process monitors `.planning/.build-all-status.json`
2. When status is "ready", external process can:
   - Run tests/validation
   - Create new issues in `.planning/ISSUES.md`
   - Update its own status file (e.g., `.planning/.external-status.json`)
3. User can use CONTINUE option to check for new issues and restart cycle

This enables closed-loop development where:
- build-all builds the code
- External process validates and creates issues
- build-all addresses issues
- Loop continues until no new issues

**Note:** External monitoring is optional. Without it, build-all still works as a one-shot full project builder.
</step>

<step name="handle_checkpoints">
**Handle blocking checkpoints during execution:**

If execution pauses at checkpoint:decision or checkpoint:human-action:

```
⏸️  Build paused at checkpoint

Phase {X}, Plan {Y}: {checkpoint details}

After resolving checkpoint, build will continue automatically.
```

In YOLO mode:
- Note checkpoint but continue if possible
- Only pause for truly blocking decisions

In interactive mode:
- Wait for user decision/action
- Resume build after checkpoint resolved
</step>

</process>

<success_criteria>
- [ ] Planning structure verified
- [ ] Roadmap exists (or project initialized via /gsd:new-project)
- [ ] Development branch created (if not already on feature branch)
- [ ] All phases identified from roadmap
- [ ] Each phase planned before execution
- [ ] Each phase executed completely before next phase planning
- [ ] Planning uses context from previous phase summaries
- [ ] Progress shown throughout build
- [ ] Pipeline pauses only at blocking checkpoints
- [ ] Open issues checked after all phases complete
- [ ] User notified if open issues exist (not in roadmap)
- [ ] Development branch merged to main (or target branch) after cycle complete
- [ ] Status file updated for external monitoring
- [ ] Review gate implemented with Y/N/ENOUGH/CONTINUE options
- [ ] CONTINUE option checks for new issues in ISSUES.md
- [ ] Post-evaluation completed and improvements applied
- [ ] Final summary shows completion status and open issues count
</success_criteria>
