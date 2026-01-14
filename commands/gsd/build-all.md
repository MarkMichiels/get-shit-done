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

**Loop mode (default):**
- After completing all phases and addressing issues, **execute `sleep 600` terminal command** (waits 10 minutes = 600 seconds)
- This is a **real terminal wait** - not just a description
- Check for new issues in ISSUES.md after wait completes
- If new issues found, **restart build cycle from beginning** (setup_branch step) - this is a REAL restart
- Continues looping until no new issues appear OR maximum cycles reached (6 cycles = 1 hour)
- Each cycle is isolated on its own branch until merged
- Uses `run_terminal_cmd` with `is_background: false` to execute the wait
- Command ends after loop completes (either no new issues or max cycles reached)
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
- question: "No ROADMAP.md found. Create roadmap now?"
- options:
  - "Create roadmap" - Run /gsd:create-roadmap
  - "Cancel" - Exit build-all

If "Create roadmap":
- Invoke: `SlashCommand("/gsd:create-roadmap")`
- Wait for roadmap creation to complete
- Continue to load_roadmap step

If "Cancel":
- Exit
</if>

<if mode="yolo">
```
❌ No roadmap found. Cannot build without roadmap.

Run /gsd:create-roadmap first, then retry /gsd:build-all
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

Update ROADMAP.md with phases, or run /gsd:create-roadmap to regenerate.
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
   Execute all unexecuted plans:
   ```
   /gsd:execute-plan .planning/phases/{phase-dir}/{plan}-PLAN.md
   ```
   (Repeat for each plan without SUMMARY.md)

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
- Type (Bug/Performance/Refactoring/UX/Testing/Documentation/Accessibility)
- Impact (High/Medium/Low)
- Description
- Suggested phase (if any)

**Analyze issues to determine action:**

1. **Count high-impact bugs:**
   - Issues with Type="Bug" AND Impact="High"
   - These are blocking and should be addressed

2. **Count total issues:**
   - All issues in Open Enhancements section

3. **Determine strategy:**
   - If 2+ high-impact bugs OR 3+ total issues → Create hotfix milestone
   - If 1-2 issues (any type) → Add phase to current milestone
   - If 0 high-impact bugs AND only low-impact enhancements → Can defer

**If action needed (high-impact bugs exist OR user wants to address issues):**

```
🔧 Open Issues Detected

All roadmap phases are complete, but {N} open issue(s) remain:

{List issues with ISS numbers, type, impact, and brief descriptions}

{If high-impact bugs: "⚠️  {X} high-impact bug(s) detected - these should be addressed"}
```

<if mode="yolo">
**Automatically address issues:**

**If 2+ high-impact bugs OR 3+ total issues:**
```
🚀 Creating hotfix milestone to address {N} open issue(s)
```
1. Determine next milestone version from ROADMAP.md (e.g., if last was v1.6 → v1.7)
2. Analyze issues and group them logically:
   - Group related bugs together (e.g., all Pint evaluator bugs)
   - Group by component/area (e.g., unit conversion, constant handling)
   - Create phase descriptions: "Fix {component/area} ({ISS-XXX, ISS-YYY})"
3. Invoke: `SlashCommand("/gsd:new-milestone v{X.Y} Hotfix")`
4. During milestone creation, provide phase breakdown:
   - For each group of related issues, create a phase
   - Example phases:
     - "Phase {N}: Fix Pint evaluator constants and handlers (ISS-025)"
     - "Phase {N+1}: Fix compound unit rate calculations (ISS-026)"
     - "Phase {N+2}: Fix currency unit conversion (ISS-027)"
   - Use issue descriptions to inform phase goals
5. Wait for milestone creation to complete
6. Reload roadmap to get new phases
7. Continue to build_loop step (plan and execute new milestone phases)

**If 1-2 issues (any type):**
```
🚀 Adding phase to current milestone to address {N} open issue(s)
```
1. Read ROADMAP.md to find last phase number
2. Create phase description from issues:
   - Single issue: Extract brief description from issue (e.g., "Fix Pint evaluator SymPy constants" from ISS-025)
   - Multiple issues: Combine into logical description (e.g., "Fix unit calculation bugs (ISS-026, ISS-027)")
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
- question: "{N} open issue(s) found. {If high-impact bugs: '{X} high-impact bug(s) detected.'} How would you like to proceed?"
- options:
  - "Address automatically" - Create milestone/phase and execute (same as YOLO mode)
  - "Review issues first" - Run /gsd:consider-issues to triage
  - "Skip for now" - Mark complete, issues remain open

**If "Address automatically" selected:**
- Follow same logic as YOLO mode above
- Create milestone or phase based on issue count/severity
- Continue to build_loop step

**If "Review issues first" selected:**
- Invoke: `SlashCommand("/gsd:consider-issues")`
- After consider-issues completes, re-check for open issues
- If issues remain, offer to address them (loop back to this step)

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

<step name="loop_mode">
**Loop mode: Check for new issues and restart cycle (default):**

**This is the default behavior - build-all always loops until no new issues appear.**

**Store initial issue state (at start of cycle, in setup_branch or build_loop):**
```bash
# Store issue count and IDs at start of cycle
if [ -f .planning/ISSUES.md ]; then
  INITIAL_ISSUE_COUNT=$(awk '/^## Open Enhancements/,/^## / { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md)
  grep -E '^### ISS-[0-9]+:' .planning/ISSUES.md | sed 's/^### //' | cut -d: -f1 > .planning/.build-all-initial-issues 2>/dev/null || true
  echo "$INITIAL_ISSUE_COUNT" > .planning/.build-all-initial-issue-count 2>/dev/null || true
else
  echo "0" > .planning/.build-all-initial-issue-count 2>/dev/null || true
  touch .planning/.build-all-initial-issues 2>/dev/null || true
fi
```

**After merge completes, start loop check:**

```
🔄 Loop Mode: Checking for new issues in 10 minutes...
```

1. **Wait 10 minutes using actual terminal command in loop:**

   **⚠️ CRITICAL: Use `run_terminal_cmd` to execute the loop - this is a REAL terminal command that actually waits and restarts.**

   ```bash
   CYCLE=1
   MAX_CYCLES=6  # 6 cycles × 10 min = 60 minutes (1 hour) max

   while [ $CYCLE -le $MAX_CYCLES ]; do
     echo "=== Loop Cycle $CYCLE/$MAX_CYCLES ==="
     echo "Waiting 10 minutes for new issues to appear..."

     # ACTUAL TERMINAL WAIT - executes sleep 600 (10 minutes)
     sleep 600

     # Check for new issues (compare current vs initial)
     if [ -f .planning/ISSUES.md ]; then
       CURRENT_ISSUE_COUNT=$(awk '/^## Open Enhancements/,/^## / { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md)
       grep -E '^### ISS-[0-9]+:' .planning/ISSUES.md | sed 's/^### //' | cut -d: -f1 > .planning/.build-all-current-issues 2>/dev/null || true
     else
       CURRENT_ISSUE_COUNT=0
       touch .planning/.build-all-current-issues 2>/dev/null || true
     fi

     INITIAL_ISSUE_COUNT=$(cat .planning/.build-all-initial-issue-count 2>/dev/null || echo "0")

     # Compare counts
     if [ "$CURRENT_ISSUE_COUNT" -gt "$INITIAL_ISSUE_COUNT" ]; then
       echo "NEW_ISSUES_FOUND"
       echo "Found $((CURRENT_ISSUE_COUNT - INITIAL_ISSUE_COUNT)) new issue(s). Restarting build cycle..."
       break
     else
       # Check if issue IDs changed (even if count same)
       if ! diff -q .planning/.build-all-initial-issues .planning/.build-all-current-issues >/dev/null 2>&1; then
         echo "NEW_ISSUES_FOUND"
         echo "Issue IDs changed. Restarting build cycle..."
         break
       else
         echo "NO_NEW_ISSUES"
         if [ $CYCLE -lt $MAX_CYCLES ]; then
           echo "No new issues. Continuing loop..."
           CYCLE=$((CYCLE + 1))
         else
           echo "Maximum cycles reached (6 cycles = 1 hour). Stopping loop."
           break
         fi
       fi
     fi
   done
   ```

   **Implementation in AI assistant:**
   - Use `run_terminal_cmd` with `is_background: false` to execute the loop
   - The `sleep 600` command will actually wait 10 minutes
   - After each wait, check for new issues
   - If new issues found, break loop and **restart from setup_branch step** (REAL restart)
   - If no new issues and cycles remaining, continue loop
   - If max cycles (6) reached, stop loop and end command

2. **Check for new issues:**
   ```bash
   # Count current open issues
   if [ -f .planning/ISSUES.md ]; then
     CURRENT_ISSUE_COUNT=$(awk '/^## Open Enhancements/,/^## / { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md)
     grep -E '^### ISS-[0-9]+:' .planning/ISSUES.md | sed 's/^### //' | cut -d: -f1 > .planning/.build-all-current-issues 2>/dev/null || true
   else
     CURRENT_ISSUE_COUNT=0
     touch .planning/.build-all-current-issues 2>/dev/null || true
   fi

   # Load initial count
   INITIAL_ISSUE_COUNT=$(cat .planning/.build-all-initial-issue-count 2>/dev/null || echo "0")

   # Compare counts
   if [ "$CURRENT_ISSUE_COUNT" -gt "$INITIAL_ISSUE_COUNT" ]; then
     echo "NEW_ISSUES_FOUND"
   else
     # Check if issue IDs changed (even if count same)
     if ! diff -q .planning/.build-all-initial-issues .planning/.build-all-current-issues >/dev/null 2>&1; then
       echo "NEW_ISSUES_FOUND"
     else
       echo "NO_NEW_ISSUES"
     fi
   fi
   ```

2. **After loop completes, check result:**

3. **If new issues found:**
   ```
   🔍 New Issues Detected

   Found {N} new issue(s) since last cycle:
   {List new issues with ISS numbers by comparing issue ID lists}

   Restarting build cycle from beginning...
   ```
   - **Return to `setup_branch` step** (create new branch for new cycle) - this is a REAL restart
   - Continue with full build workflow
   - This creates a new isolated development cycle
   - Update initial issue state for new cycle
   - After cycle completes, loop again if new issues appear

4. **If no new issues OR max cycles reached:**
   ```
   ✅ No new issues found (or maximum cycles reached)

   Build complete. All work merged to main.
   No further action needed.
   ```
   - Clean up temporary files:
     ```bash
     rm -f .planning/.build-all-initial-issues .planning/.build-all-current-issues .planning/.build-all-initial-issue-count .planning/.build-all-original-branch .planning/.build-all-current-branch
     ```
   - **End command** - loop complete

**Loop termination:**
- Loop continues until no new issues appear after a cycle OR maximum cycles reached (6 cycles = 1 hour)
- Each cycle is isolated on its own branch
- Each cycle merges to main before next cycle starts
- Prevents unstable code from affecting main during development
- Uses actual `sleep 600` terminal command to wait between cycles
- **Command ends after loop completes** (either no new issues or max cycles reached)

**Maximum cycles:**
- Default: 6 cycles (60 minutes total wait time)
- After 6 cycles with no new issues, loop stops and command ends
- Prevents infinite loops while allowing reasonable time for external fixes

**Manual termination:**
- User can stop loop at any time
- Current cycle completes and merges before stopping
- The `sleep 600` command can be interrupted (Ctrl+C), but loop will continue checking

**⚠️ CRITICAL:**
- The loop uses **actual terminal commands** (`sleep 600`) to wait
- The loop **actually restarts the workflow** from `setup_branch` step when new issues are found
- This must be executed using `run_terminal_cmd` tool, not just described
- Command ends after loop completes (either success or max cycles reached)
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
- [ ] Roadmap exists (or created via /gsd:create-roadmap)
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
- [ ] Loop mode checks for new issues (waits 10 minutes)
- [ ] New build cycle starts if new issues found
- [ ] Loop terminates when no new issues appear
- [ ] Final summary shows completion status and open issues count
</success_criteria>
