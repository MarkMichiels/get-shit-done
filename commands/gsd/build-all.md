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

<step name="load_roadmap">
**Load roadmap and identify phases:**

```bash
cat .planning/ROADMAP.md
```

Parse all phases from roadmap:
- Integer phases (1, 2, 3, ...)
- Decimal phases (2.1, 2.2, ...)

Count total phases and identify which need work.
</step>

<step name="check_config">
**Load workflow config:**

```bash
cat .planning/config.json 2>/dev/null
```

Parse mode (yolo/interactive) and gates.
</step>

<step name="build_loop">
**Build all phases sequentially:**

<if mode="yolo">
```
🚀 Building Entire Project

This will plan and execute each phase sequentially.
Each phase planning uses context from previous phase summaries.

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

Proceed with full build?
```
Wait for confirmation.
</if>

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

**After all phases complete:**
```
🎉 Project Build Complete!

✅ All phases planned and executed
📊 Total phases: {N}
📝 All summaries created
💾 All commits made

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
- [ ] All phases identified from roadmap
- [ ] Each phase planned before execution
- [ ] Each phase executed completely before next phase planning
- [ ] Planning uses context from previous phase summaries
- [ ] Progress shown throughout build
- [ ] Pipeline pauses only at blocking checkpoints
- [ ] Final summary shows completion status
</success_criteria>
