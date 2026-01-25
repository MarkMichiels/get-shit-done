---
name: gsd:build-phase
description: Plan and execute a phase automatically (plan → execute all plans in phase)
argument-hint: "[phase-number]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - SlashCommand
---

<objective>
Plan a phase and then execute all plans in that phase automatically.

**Input sources:**
- ROADMAP.md - Phase goals and structure (primary input)
- ISSUES.md - Deferred issues that may become tasks (primary input)
- STATE.md - Project state, decisions, blockers
- Previous phase summaries - Context from completed work

This combines planning and execution:
1. Plan the phase (creates PLAN.md files using ROADMAP + ISSUES as input)
2. Execute all plans in the phase sequentially
3. Each plan execution builds on the previous plan's SUMMARY.md context

This is the ideal workflow because:
- Planning uses ROADMAP for phase goals and ISSUES.md for deferred enhancements
- Planning uses context from previous phase summaries
- Code is built incrementally
- Each phase completes before planning the next
- Context builds up naturally through SUMMARY.md files
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/workflows/execute-phase.md
</execution_context>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)

**Input sources (used by planning):**
- @.planning/ROADMAP.md - Phase goals and structure
- @.planning/ISSUES.md - Deferred issues that may become tasks
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

<step name="identify_phase">
**Identify which phase to build:**

If phase number provided via $ARGUMENTS:
- Validate phase exists in ROADMAP.md
- Check if phase already has plans

If no phase number provided:
- Find next unplanned phase (no PLAN.md files exist)
- Or find phase with plans but not all executed

**Output:**
```
Building Phase {X}: {Phase Name}
```
</step>

<step name="check_config">
**Load workflow config:**

```bash
cat .planning/config.json 2>/dev/null
```

Parse mode (yolo/interactive) and gates.
</step>

<step name="check_research_needed">
**Check if research is needed before planning:**

Analyze phase description from ROADMAP.md to determine complexity:

**Complexity indicators (suggest research):**
- Keywords: "3D", "game", "audio", "shader", "ML", "AI", "real-time", "WebRTC", "WebSocket", "physics", "procedural"
- Roadmap marked: `Research: Likely` or `Research: Yes`
- Architectural decisions: "architecture", "design", "system", "distributed"
- Multiple external services or integrations
- Novel problem without clear patterns

**Simple indicators (skip research):**
- Standard web dev: "auth", "CRUD", "API", "form", "validation"
- Well-known patterns: "endpoint", "model", "component"
- Simple integrations: "Stripe", "SendGrid" (with clear docs)

**Decision:**
- If complex → Research first
- If simple → Plan directly

**Check if RESEARCH.md already exists:**
```bash
ls .planning/phases/{phase-dir}/{phase}-RESEARCH.md 2>/dev/null
```

If RESEARCH.md exists → skip research step
If RESEARCH.md missing and complex → do research first
</step>

<step name="research_if_needed">
**Execute research if needed:**

<if research_needed="true" AND research_exists="false">
```
🔬 Researching Phase {X}: {Phase Name}

This phase involves complex/niche domain. Researching ecosystem before planning...
```

**Execute research:**
```
/gsd:research-phase {phase-number}
```

Wait for research to complete.

**Verify RESEARCH.md created:**
```bash
ls .planning/phases/{phase-dir}/{phase}-RESEARCH.md
```

If research failed:
```
⚠️  Research incomplete, but proceeding with planning.
Planning may be less informed without ecosystem knowledge.
```
</if>

<if research_needed="false" OR research_exists="true">
```
Skipping research - phase is standard domain or research already exists.
```
</if>
</step>

<step name="plan_phase">
**Plan the phase:**

<if mode="yolo">
```
📋 Planning Phase {X}: {Phase Name}

Creating execution plans...
```
</if>

<if mode="interactive">
```
📋 Planning Phase {X}: {Phase Name}

This will create PLAN.md files for this phase.
Proceed?
```
Wait for confirmation.
</if>

**Execute planning:**
```
/gsd:plan-phase {phase-number}
```

Wait for planning to complete.

**Verify plans created:**
```bash
ls .planning/phases/{phase-dir}/*-PLAN.md
```

If no plans created:
```
Error: Planning failed - no PLAN.md files created.
```
Exit.
</step>

<step name="execute_phase">
**Execute all plans in the phase:**

Use the standard execute-phase command which handles:
- Wave-based parallel execution
- Verification after completion
- SUMMARY.md creation for each plan

```
⚙️  Executing Phase {X}: {Phase Name}
/gsd:execute-phase {phase-number}
```

Wait for execution to complete.

**After phase execution complete:**
```
✅ Phase {X} complete!

Ready to plan next phase.
```
</step>

<step name="offer_next">
**Offer to continue to next phase:**

Check if more phases exist in ROADMAP.md.

If next phase exists:
```
---

## Next Phase Available

**Phase {X+1}: {Next Phase Name}**

Would you like to:
1. Build next phase (plan + execute)
2. Stop here
```

In YOLO mode:
- Auto-continue to next phase if user wants full automation
- Or stop and let user decide

In interactive mode:
- Ask user if they want to continue
</step>

</process>

<success_criteria>
- [ ] Phase identified (from argument or auto-detected)
- [ ] Phase planned (PLAN.md files created)
- [ ] All plans in phase executed sequentially
- [ ] Each plan execution completes before next starts
- [ ] Progress shown throughout
- [ ] Next phase offered if available
</success_criteria>
