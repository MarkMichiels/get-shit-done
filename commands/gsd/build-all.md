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

<step name="build_loop">
**Build all phases sequentially (with issue resolution loop):**

<if mode="yolo">
```
🚀 Building Entire Project

This will plan and execute each phase sequentially.
Each phase planning uses context from previous phase summaries.
Open issues will be automatically addressed after roadmap phases complete.

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
- Continue to completion message

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
🎉 Project Build Complete!

✅ All phases planned and executed
📊 Total phases: {N}
📝 All summaries created
💾 All commits made
✅ All open issues addressed (if applicable)

Project is ready for milestone completion.
```
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
- [ ] All phases identified from roadmap
- [ ] Each phase planned before execution
- [ ] Each phase executed completely before next phase planning
- [ ] Planning uses context from previous phase summaries
- [ ] Progress shown throughout build
- [ ] Pipeline pauses only at blocking checkpoints
- [ ] Open issues checked after all phases complete
- [ ] User notified if open issues exist (not in roadmap)
- [ ] Final summary shows completion status and open issues count
</success_criteria>
