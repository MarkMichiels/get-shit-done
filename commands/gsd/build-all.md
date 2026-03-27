---
name: gsd:build-all
description: Build entire project automatically (plan → execute each phase sequentially) with daemon mode for continuous issue resolution
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - SlashCommand
user-invocable: true
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

**All work happens on the current branch.** No worktree isolation — simpler, fewer failure modes.

**Interactive mode (default):**
- Workflow continues until user explicitly says "it's done" or "enough"
- Status is tracked in `.planning/.build-all-status.json` for external monitoring
- Review gate after each cycle for user feedback
- Post-evaluation to improve the command itself
- External process can optionally monitor status file for coordination

**Daemon mode (`--daemon`):**
- After building all phases, enters autonomous polling loop
- Polls `.planning/ISSUES.md` every 60 seconds for new issues
- Automatically plans + executes any new issues found
- No review gate, no user interaction required
- Runs indefinitely until session is closed or user intervenes
- Other sessions (debug, create-issue) just write to ISSUES.md — daemon picks it up
- Can be started on already-completed projects (skips to polling immediately)

## Parallel Projects

Multiple GSD projects in the same repo can run build-all simultaneously — each in its own session, working on different `.planning/` directories. Commits go to the same branch (main). Conflicts are rare because projects modify different files.
</objective>

<execution_context>
@/home/mark/.claude/get-shit-done/workflows/plan-phase.md
@/home/mark/.claude/get-shit-done/workflows/execute-phase.md
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

<step name="parse_flags" priority="first">
**Parse arguments — THIS STEP RUNS FIRST, BEFORE ANYTHING ELSE:**

- `--daemon` → Set `DAEMON_MODE=true`. Skips review gate, enters autonomous issue loop after build.
- No flag → `DAEMON_MODE=false`. Normal interactive build with review gate.

```bash
DAEMON_MODE=false
[[ "$ARGUMENTS" =~ --daemon ]] && DAEMON_MODE=true
```

**CRITICAL — Daemon fast-path for completed projects:**

If `DAEMON_MODE=true`, check immediately if the project is already complete:

```bash
if [ "$DAEMON_MODE" = "true" ] && [ -f .planning/ROADMAP.md ]; then
    TOTAL=$(grep -cE '^\s*- \[' .planning/ROADMAP.md 2>/dev/null || echo "0")
    DONE=$(grep -cE '^\s*- \[x\]' .planning/ROADMAP.md 2>/dev/null || echo "0")
    OPEN=$(awk '/^## Open Enhancements/,0 { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md 2>/dev/null || echo "0")
    echo "DAEMON_CHECK|phases=$DONE/$TOTAL|issues=$OPEN"
fi
```

**If `DAEMON_MODE=true` AND all phases complete (`DONE == TOTAL`) AND `OPEN == 0`:**

**STOP HERE. Do NOT continue to verify, check_roadmap, load_roadmap, critical_evaluation, or any other step.**

**Go DIRECTLY to `daemon_loop` step.** Show:

```
Daemon mode — all {TOTAL} phases complete, 0 open issues.
Entering polling loop on .planning/ISSUES.md...
```

**This override is absolute.** The user explicitly asked for daemon mode. Do not suggest alternatives, do not show completion summaries, do not offer /gsd:new-milestone. Enter the daemon loop and start polling.

**If `DAEMON_MODE=true` AND phases remaining OR issues open:**
Continue to normal flow (verify → load_roadmap → build_loop). After build completes, daemon_loop will be entered instead of review_gate.

**If `DAEMON_MODE=false`:**
Continue to verify step (normal flow).
</step>

<step name="verify">
**Verify planning structure exists:**

If no `.planning/` directory:
```
No planning structure found.

Run /gsd:new-project to start a new project.
```
Exit.
</step>

<step name="health_check">
**Pre-flight health check on .planning/ directory:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" validate health --repair 2>/dev/null || echo "HEALTH_SKIP"
```

If health issues found and auto-repaired, log them. If critical issues remain, warn but continue.
This catches corrupted STATE.md, missing phase directories, stale frontmatter, etc. before they cause failures mid-build.
</step>

<step name="check_roadmap">
**Check if roadmap exists:**

```bash
[ -f .planning/ROADMAP.md ] && echo "ROADMAP_EXISTS" || echo "NO_ROADMAP"
```

**If NO_ROADMAP:**
```
No roadmap found.

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
No roadmap found. Cannot build without roadmap.

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
Roadmap exists but contains no phases.

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

**Store research config:** Check if `workflow.research` is `true` in config.json. If true, set `RESEARCH_ALWAYS=true`. This flag is used in the build_loop to ensure research is always checked.
</step>

<step name="critical_evaluation">
**Critical evaluation: Is this roadmap ready to build?**

This is the most important step in build-all. Before committing hours of autonomous execution, walk through every phase and verify the roadmap is buildable. The goal: catch problems NOW, not 3 phases in.

**Mindset: Helpful skeptic, not interrogator.** Don't ask the user a list of questions. Instead, analyze everything yourself, form an opinion, and present your assessment. The user should feel like they have a knowledgeable partner reviewing the plan — not filling out a questionnaire.

**1. Load all planning context:**
```bash
cat .planning/ROADMAP.md
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
CODEBASE_DOCS=$(ls .planning/codebase/*.md 2>/dev/null | wc -l)
echo "CODEBASE_DOCS=$CODEBASE_DOCS"
```

**If `CODEBASE_DOCS` is 0 and this is a brownfield project (existing code):**
Run codebase mapping to give planners context:
```
Generating codebase analysis for planning context...
```
Invoke: `SlashCommand("/gsd:map-codebase")`

This produces `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `TESTING.md`, etc. which planners and verifiers will use.

Also scan the actual codebase to understand current state:
```bash
# What exists already?
find . -maxdepth 3 -name "*.ts" -o -name "*.py" -o -name "*.js" -o -name "*.rs" | head -30
cat package.json 2>/dev/null | head -20
cat pyproject.toml 2>/dev/null | head -20
```

**2. Walk through every phase — build a mental model:**

For each phase, evaluate:

| Check | Question | Red Flag |
|-------|----------|----------|
| **Clarity** | Is the goal specific enough to plan against? | "Improve UX", "optimize performance" without targets |
| **Completeness** | Are success criteria testable and concrete? | No success criteria, or only vague ones |
| **Information gaps** | Do we have everything needed to build this? | Missing API specs, design mockups, data schemas |
| **Dependencies** | Does this need something from a previous phase that isn't explicitly produced? | Phase 3 needs a DB schema that Phase 2 doesn't mention |
| **Scope** | Is this phase trying to do too much? | >5 success criteria, mixing concerns (UI + backend + infra) |
| **Feasibility** | Can Claude Code actually build this autonomously? | Hardware setup, manual GUI testing, real-time debugging |
| **Handoff gaps** | Will the output of this phase give the next phase what it needs? | Phase produces API but next phase assumes WebSocket |

**3. Establish definition of done per phase:**

For each phase, state in 1-2 sentences what "done" concretely means. This becomes the contract between the generator (executor) and evaluator (verifier). The executor can't move the goalpost mid-build.

**4. Report back to the user:**

Present a single assessment table — NOT a wall of questions:

```
## Build Readiness Assessment

| # | Phase | Goal | Definition of Done | Status |
|---|-------|------|--------------------|--------|
| 1 | {Name} | {1-line goal} | {concrete done criteria} | ✅ Ready |
| 2 | {Name} | {1-line goal} | {concrete done criteria} | ✅ Ready |
| 3 | {Name} | {1-line goal} | {concrete done criteria} | ⚠️ Gap |
| 4 | {Name} | {1-line goal} | {concrete done criteria} | ✅ Ready |

### Issues to Resolve

**Phase 3: {Name}**
⚠ {Specific issue — e.g., "Success criteria say 'API handles all edge cases' but no edge cases are defined"}
💡 {Concrete suggestion — e.g., "I'll add these edge cases to the success criteria: empty input, duplicate entries, concurrent writes"}

{For each issue: state what YOU will fix vs. what needs USER input}
```

**5. Resolve issues:**

**Issues you can fix yourself** (missing detail, vague criteria, ordering problems):
- Propose the fix inline: "I'll update Phase 3's success criteria to include: ..."
- Apply fixes to ROADMAP.md directly after user approves

**Issues that need user input** (ambiguous requirements, business decisions, external dependencies):
- Ask specifically: "Phase 4 says 'integrate with payment provider' — which one? Stripe, Mollie, or something else?"
- Batch all user questions together — don't ask one at a time

**6. Final summary and proceed:**

**If everything looks solid (no issues, or all issues resolved):**
```
## Build Readiness: ✅ All Clear

{N} phases reviewed. All goals are specific, success criteria are testable, and phases connect logically.

{Any minor notes}

Starting build.
```
Proceed directly — don't ask "shall I proceed?" when there are no issues.

**If issues remain that need user input:**
Batch all remaining questions and wait for answers. Then proceed.

<if mode="yolo">
Still run the full evaluation. If issues found:
- Fix what you can fix yourself (update ROADMAP.md)
- Log warnings for issues needing user input
- Default to main branch (no worktree)
- Continue building
```
Build readiness: {N} phases reviewed, {M} issues auto-fixed, {K} warnings logged.
Branch: main (default). Proceeding.
```
</if>
</step>

<step name="preflight_check">
**Pre-flight: Identify all external dependencies before building**

Scan ALL phases in ROADMAP.md to detect blocking dependencies that require user action before build can succeed autonomously.

**1. Scan roadmap for dependency indicators:**

Read each phase description and look for:

| Category | Keywords | Examples |
|----------|----------|----------|
| Authentication | OAuth, Firebase Auth, Google Sign-In, SSO, login | Firebase Console setup, OAuth consent screen |
| Cloud Services | Firebase, GCP, AWS, Azure, Cloud Run, Cloud Functions | Project creation, API enabling, billing |
| API Keys | API key, secret, token, credentials | Stripe, SendGrid, Twilio keys |
| External Services | Modbus, SCADA, SSH, VPN, database | Network access, connection strings |
| Manual Setup | console, dashboard, manual, download | Config file downloads, UI configuration |
| Certificates | SSL, certificate, signing key | App signing, HTTPS certificates |
| App Stores | Play Store, App Store, TestFlight | Developer accounts, app registration |

**2. For each detected dependency, determine:**
- **What**: Specific resource needed (API key, project, config file)
- **When**: Which phase requires it
- **How**: Setup instructions or link to documentation
- **Blocking**: Can build proceed without it? (Yes/No)

**3. Generate PREFLIGHT.md checklist:**

```bash
# Create preflight checklist if dependencies found
cat > .planning/PREFLIGHT.md <<'EOF'
# Pre-flight Checklist

Generated: {timestamp}

## Blocking Dependencies

These must be completed before build-all can run autonomously.

### Phase 1: {Phase Name}
- [ ] **{Dependency}** - {Description}
  - Go to: {URL or location}
  - Action: {What to do}
  - Required for: {What depends on it}

...

## Non-Blocking (Can be deferred)

These can be completed later but will block specific features.

...

---

**Instructions:**
1. Complete all "Blocking Dependencies" items
2. Run `/gsd:build-all` again
3. Non-blocking items can be completed when their phase is reached

EOF
```

**4. Present to user:**

<if dependencies_found="true">
```
Pre-flight Check: External Dependencies Detected

Before building autonomously, you need to set up:

BLOCKING (must complete before build):
  Phase 1: {dependency list}
  Phase 2: {dependency list}

NON-BLOCKING (can defer):
  Phase 6: {dependency list}

Checklist saved: .planning/PREFLIGHT.md
```

Use AskUserQuestion:
- header: "Pre-flight Check"
- question: "How do you want to proceed?"
- options:
  - "All done" - I've completed the blocking items, proceed with build
  - "Show setup guides" - Display detailed setup instructions
  - "Skip pre-flight" - Proceed anyway (will pause at checkpoints)
  - "Exit" - Stop and complete setup first

**If "All done":**
- Continue to build_loop step
- Build proceeds autonomously

**If "Show setup guides":**
- Display contents of PREFLIGHT.md
- Ask again after user reviews

**If "Skip pre-flight":**
- Warn: "Build will pause at checkpoints requiring manual setup"
- Continue to build_loop step
- Plans with external dependencies should have `autonomous: false`

**If "Exit":**
- Show: "Complete items in .planning/PREFLIGHT.md, then run /gsd:build-all again"
- Exit
</if>

<if dependencies_found="false">
```
Pre-flight Check: No blocking dependencies detected

All phases can be built autonomously.
```
Continue to build_loop step.
</if>

<if mode="yolo">
- Still generate PREFLIGHT.md for reference
- Show summary but don't ask for confirmation
- Log warning if blocking dependencies found
- Proceed to build (will hit checkpoints if setup incomplete)
</if>
</step>


<step name="build_loop">
**Build all phases sequentially (with issue resolution loop):**

<if mode="yolo">
```
Building Entire Project

This will plan and execute each phase sequentially.
Each phase planning uses context from previous phase summaries.
Open issues will be automatically addressed after roadmap phases complete.

All work on current branch (main).
Loop mode: After completion, waits for review and checks for new issues

Starting build pipeline...
```
</if>

<if mode="interactive">
```
Building Entire Project

This will plan and execute each phase sequentially.
You'll be prompted at:
- Each phase planning start
- Blocking checkpoints during execution
- Errors or failures
- Open issues resolution (after roadmap phases complete)
- Merge confirmation (if conflicts occur)

All work on current branch (main).
Loop mode: After completion, waits for review and checks for new issues

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

   # Check if context exists
   ls .planning/phases/{phase-dir}/*-CONTEXT.md 2>/dev/null
   ```

2. **If phase not planned:**

   **2a. Smart discuss (before planning):**

   Check if CONTEXT.md exists for this phase.

   **If CONTEXT.md exists:** Skip discuss — context already gathered. Display:
   ```
   Phase {X}: Context exists — skipping discuss.
   ```

   **If CONTEXT.md does NOT exist:**

   Detect if phase is infrastructure-only:
   - Goal keywords match: "scaffolding", "plumbing", "setup", "configuration", "migration", "refactor", "rename", "restructure", "upgrade", "infrastructure"
   - AND success criteria are all technical: "file exists", "test passes", "config valid", "command runs"
   - AND no user-facing behavior is described (no "users can", "displays", "shows", "presents")

   **If infrastructure-only:** Skip discuss, write minimal CONTEXT.md:
   ```
   Phase {X}: Infrastructure phase — skipping discuss, writing minimal context.
   ```
   Write CONTEXT.md with:
   - `<domain>`: Phase boundary from ROADMAP goal
   - `<decisions>`: Single "### Claude's Discretion" subsection — "All implementation choices are at Claude's discretion — pure infrastructure phase"
   - `<code_context>`: Brief codebase scan results
   - `<specifics>`: "No specific requirements — infrastructure phase"
   - `<deferred>`: "None"

   **If NOT infrastructure (needs decisions):**

   Present grey areas as batch table with recommendations. For each grey area (M of N):

   ```
   ### Grey Area {M}/{N}: {Area Name}

   | # | Question | Recommended | Alternative(s) |
   |---|----------|-------------|-----------------|
   | 1 | {question} | {answer} — {rationale} | {alt1}; {alt2} |
   | 2 | {question} | {answer} — {rationale} | {alt1} |
   | 3 | {question} | {answer} — {rationale} | {alt1}; {alt2} |
   ```

   Use AskUserQuestion per area:
   - "Accept all" — record all recommendations
   - "Change QN" — let user pick alternative for specific question
   - "Discuss deeper" — switch to interactive mode for this area

   Write CONTEXT.md with all decisions captured.

   **2b. UI design contract (frontend phases — autonomous):**

   Detect if this phase has frontend indicators:
   ```bash
   PHASE_SECTION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase {X} 2>/dev/null)
   echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
   HAS_UI=$?
   UI_SPEC_FILE=$(ls .planning/phases/{phase-dir}/*-UI-SPEC.md 2>/dev/null | head -1)
   ```

   **If `HAS_UI` is 0 (frontend detected) AND no UI-SPEC exists:**
   ```
   Phase {X}: Frontend phase detected — generating UI design contract...
   /gsd:ui-phase {X}
   ```
   This produces a UI-SPEC.md that the planner will use as input. Fully autonomous.

   **Otherwise:** Skip silently.

   **2c. Check if research needed (before planning):**

   Research is needed when ANY of these are true:
   - `RESEARCH_ALWAYS=true` (from config.json `workflow.research=true`) AND no RESEARCH.md exists for this phase
   - Phase description contains complexity indicators (3D, games, audio, ML, real-time, Modbus, protocol, hardware, etc.)
   - Roadmap has `Research: Likely` flag for this phase

   **If research needed:**
   ```
   Researching Phase {X}: {Phase Name}
   /gsd:research-phase {X}
   ```
   Wait for research to complete.

   **2d. Plan the phase:**
   ```
   Planning Phase {X}: {Phase Name}
   /gsd:plan-phase {X}
   ```
   Wait for planning to complete.

3. **If phase planned but not all executed:**
   ```
   Executing Phase {X}: {Phase Name}
   ```
   Execute the phase (handles all plans with wave-based parallelization):
   ```
   /gsd:execute-phase {X}
   ```
   Wait for phase execution to complete.

4. **Post-execution verification routing:**

   After execute-phase returns, read the verification result:
   ```bash
   VERIFY_STATUS=$(grep "^status:" .planning/phases/{phase-dir}/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
   QUALITY_SCORE=$(grep "^  overall:" .planning/phases/{phase-dir}/*-VERIFICATION.md 2>/dev/null | head -1 | grep -oE "[0-9]+")
   ```

   **If `passed`:**
   ```
   Phase {X} -- Verification passed (quality: {QUALITY_SCORE}/10)
   ```

   **Post-verification autonomous enhancements (only if passed):**

   **a) UI Review (frontend phases only):**
   ```bash
   UI_SPEC_FILE=$(ls .planning/phases/{phase-dir}/*-UI-SPEC.md 2>/dev/null | head -1)
   ```
   If `UI_SPEC_FILE` exists:
   ```
   Phase {X}: Running UI review audit...
   /gsd:ui-review {X}
   ```
   UI review is advisory — log score but don't block. Continue regardless.

   **b) Test generation:**
   ```
   Phase {X}: Generating tests from phase artifacts...
   /gsd:add-tests {X}
   ```
   Generates unit + E2E tests based on SUMMARY.md, CONTEXT.md, and VERIFICATION.md.
   Tests are committed. Failures are logged as issues but don't block the next phase.

   Continue to next phase.

   **If `human_needed`:**

   <if DAEMON_MODE="true">
   Log human verification items but continue — daemon can't wait for human input.
   File items as issues in ISSUES.md for manual follow-up.
   </if>

   <if DAEMON_MODE="false">
   Read human_verification section from VERIFICATION.md. Present items to user:
   - "Validate now" — present specific items, ask for result
   - "Continue without validation" — defer validation, proceed
   </if>

   **If `gaps_found`:**
   Read gap summary (score, quality scores, and missing items). Display:
   ```
   Phase {X}: {Phase Name} — Gaps Found
   Score: {N}/{M} must-haves verified
   Quality: {overall}/10 (completeness: {N}, correctness: {N}, integration: {N}, edge_cases: {N}, code_quality: {N})
   ```

   Show quality dimension details for any dimension scoring < 7.

   Offer gap closure (limit: 1 retry):
   - "Run gap closure" — invoke `/gsd:plan-phase {X} --gaps`, then re-execute, re-verify
   - "Continue without fixing" — defer gaps, proceed
   - "Stop" — go to handle_checkpoints

   If gap closure attempted and gaps persist after retry:

   <if mode="yolo" or DAEMON_MODE="true">
   Run forensics to diagnose the persistent failure:
   ```
   Phase {X}: Gaps persist after retry — running forensics...
   /gsd:forensics
   ```
   Log the forensics report. File remaining gaps as issues in ISSUES.md.
   Continue to next phase — daemon will revisit issues later.
   </if>

   <if mode="interactive" and DAEMON_MODE="false">
   Ask user to continue or stop.
   </if>

   **If empty (no VERIFICATION.md):**
   Log warning but continue — not all phases produce verification files.

5. **If phase complete:**
   ```
   Phase {X} complete
   ```
   Skip to next phase.

6. **Update progress:**
   ```
   Progress: Phase {X}/{N} complete
   ```

**After all roadmap phases complete:**

**Step 5: Check and address open issues (see Step 5a below)**

**If issues were addressed (new phases/milestone created):**
- Return to build_loop step (plan and execute new phases)
- Continue until no phases remain AND no open issues remain

**If no issues OR all issues addressed:**
- Continue to lifecycle step

**Step 5a. Check for open issues:**
```bash
# Check if ISSUES.md exists
if [ -f .planning/ISSUES.md ]; then
  # Count open issues (ISS-XXX entries in "## Open Enhancements" section)
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
   - If 2+ high-impact bugs OR 3+ total issues: Create hotfix milestone
   - If 1+ high/medium-impact features OR 1-2 issues (any type): Add phase to current milestone
   - If 0 high-impact bugs AND 0 high/medium-impact features AND only low-impact enhancements: Can defer

**If action needed (high-impact bugs exist OR high/medium-impact features exist OR user wants to address issues):**

```
Open Issues Detected

All roadmap phases are complete, but {N} open issue(s) remain:

{List issues with ISS numbers, type, impact, and brief descriptions}

{If high-impact bugs: "{X} high-impact bug(s) detected - these should be addressed"}
{If high/medium-impact features: "{X} high/medium-impact feature(s) detected - these should be addressed"}
```

<if mode="yolo">
**Automatically address issues:**

**If 2+ high-impact bugs OR 3+ total issues:**
```
Creating hotfix milestone to address {N} open issue(s)
```
1. Determine next milestone version from ROADMAP.md (e.g., if last was v1.6 -> v1.7)
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
   - Use issue descriptions to inform phase goals
5. Wait for milestone creation to complete
6. Reload roadmap to get new phases
7. Continue to build_loop step (plan and execute new milestone phases)

**If 1+ high/medium-impact features OR 1-2 issues (any type):**
```
Adding phase to current milestone to address {N} open issue(s)
```
1. Read ROADMAP.md to find last phase number
2. Create phase description from issues:
   - Single issue: Extract brief description from issue
   - Multiple issues: Combine into logical description
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
- question: "{N} open issue(s) found. How would you like to proceed?"
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
Build Cycle Complete!

All phases planned and executed
Total phases: {N}
All summaries created
All commits made
All open issues addressed (if applicable)

Proceeding to merge and lifecycle...
```
</step>


<step name="lifecycle">
**Lifecycle: audit -> complete -> cleanup (from autonomous.md):**

After all phases complete and merge succeeds, run the milestone lifecycle sequence.

```
LIFECYCLE

All phases complete + merged -> Starting lifecycle: audit -> complete -> cleanup
```

**0. Cross-phase UAT scan (before audit):**

Invoke: `SlashCommand("/gsd:audit-uat")`

Surfaces any outstanding UAT items, unresolved verification gaps, or skipped human-verification items across ALL phases. Results inform the milestone audit.

**1. Audit:**

Invoke: `SlashCommand("/gsd:audit-milestone")`

After audit completes, detect the result:
```bash
AUDIT_FILE=$(ls .planning/v*-MILESTONE-AUDIT.md 2>/dev/null | head -1)
AUDIT_STATUS=$(grep "^status:" "$AUDIT_FILE" 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**If `passed`:**
```
Audit passed — proceeding to complete milestone
```

**If `gaps_found`:**

<if DAEMON_MODE="true">
Log gaps but continue — file as issues for next cycle.
</if>

<if DAEMON_MODE="false">
Read the gaps summary. Ask user:
- "Continue anyway — accept gaps" -> proceed
- "Stop — fix gaps manually" -> pause
</if>

**If `tech_debt`:**

<if DAEMON_MODE="true">
Log tech debt but continue.
</if>

<if DAEMON_MODE="false">
Read the tech debt summary. Ask user:
- "Continue with tech debt" -> proceed
- "Stop — address debt first" -> pause
</if>

**If audit file missing or no status:**
Log warning but continue — audit may not be configured for all projects.

**2. Complete Milestone:**

Invoke: `SlashCommand("/gsd:complete-milestone")`

Verify archive produced:
```bash
ls .planning/milestones/v*-ROADMAP.md 2>/dev/null
```

**3. Milestone summary:**

Invoke: `SlashCommand("/gsd:milestone-summary")`

Generates a human-readable project summary document from milestone artifacts. Useful for team onboarding and project handoff.

**4. Documentation & dead code cleanup:**

Before archiving, verify documentation is current and no dead code remains:

```bash
# Find files modified in this milestone (from phase summaries)
MODIFIED_FILES=$(grep -rh "key-files" .planning/phases/*/SUMMARY.md 2>/dev/null | grep -oE '`[^`]+`' | tr -d '`' | sort -u)
```

For each modified file:
- Check if corresponding documentation (README, inline comments, docstrings) matches the current implementation
- Check if any imports/functions were removed but their definitions remain elsewhere (dead code)
- Check if any config references point to removed features

```bash
# Find potentially dead exports (defined but never imported)
for file in $MODIFIED_FILES; do
    [ -f "$file" ] || continue
    # Extract exported names and check for imports elsewhere
    grep -E "^export |^def |^class |^function " "$file" 2>/dev/null | head -20
done
```

Update documentation and remove dead code. Commit:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update documentation and remove dead code after milestone completion" --files .
```

**5. Cleanup:**

Invoke: `SlashCommand("/gsd:cleanup")`

Cleanup shows its own dry-run and asks user for approval internally.

```
Lifecycle complete: audit-uat -> audit -> complete -> milestone-summary -> docs-cleanup -> cleanup
```
</step>

<step name="review_gate">
**If `DAEMON_MODE=true`:** Skip review gate entirely. Go directly to `daemon_loop` step.

**Review gate: Pause for user review (Y/N/ENOUGH/CONTINUE to proceed):**

At this point, the build cycle should be complete:
- All phases planned and executed
- Lifecycle completed (audit, complete, cleanup)
- Status file updated

**Action:** Show summary and ask user to review:

```
## Build All Complete - Review

**Status:** All phases complete

**Summary:**
- Planned and executed {N} phases
- All summaries created
- All commits made
- All open issues addressed (if applicable)
- Lifecycle: audit -> complete -> cleanup
- Status file updated: .planning/.build-all-status.json

**Files ready:**
- All phase summaries in .planning/phases/
- All code changes committed and merged to main

Please review and respond:
- **Y** = proceed to post-evaluation
- **N** = collect corrections, apply fixes, then repeat review
- **ENOUGH** = stop building, mark status as "done", workflow complete
- **CONTINUE** = check for new issues in ISSUES.md, restart cycle if found
- **WATCH** = enter watch mode — wait for external process to signal new issues
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
- If new issues found, return to `build_loop` step (process new issues)
- If no new issues, proceed to `post_evaluation`

**If WATCH (enter daemon mode):**
- Proceed to `daemon_loop` step
</step>

<step name="daemon_loop">
**Daemon Mode: Autonomous issue polling loop**

Entered when `DAEMON_MODE=true` (via `--daemon` flag) or when user selects WATCH from review gate.
Can also be entered in a session where all phases are already complete — build-all detects this
and skips straight to the loop.

**The loop is dead simple: poll ISSUES.md, act if issues found, sleep if not.**

**1. Update status:**
```bash
cat > .planning/.build-all-status.json <<EOF
{
  "status": "daemon",
  "phase": "issue-loop",
  "timestamp": "$(date -Iseconds)",
  "branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)",
  "poll_interval_seconds": 60
}
EOF
```

```
## Daemon Mode Active

Polling .planning/ISSUES.md every 60 seconds.
Any session that writes issues to ISSUES.md will be automatically picked up.

To stop: type anything in this session.
```

**2. Poll loop:**

```bash
sleep 60 && awk '/^## Open Enhancements/,0 { if (/^### ISS-[0-9]+:/) count++ } END { print count+0 }' .planning/ISSUES.md 2>/dev/null || echo 0
```

Output is a single number: `0` or `3`.

**If `OPEN_ISSUES > 0`:**
- Read ISSUES.md to analyze issues
- **Classify each issue:**

  **Regular issues** (Type: Bug/Feature/etc.):
  - Follow existing issue resolution logic from build_loop step 5a
  - Group issues, determine strategy (hotfix milestone vs add phase)
  - Create phase/milestone, plan + execute, verify

  **Cross-project return issues** (Type: Notification, contains "cross-project return"):
  - These are responses from another project saying "your request is done"
  - Read the "How to verify" field
  - Run the verification steps (check file exists, test behavior, etc.)
  - If verification passes: mark both the return issue AND the original request as resolved
  - If verification fails: create a follow-up issue in the provider project's ISSUES.md
    with specific feedback on what doesn't work, referencing the original issue chain

  **Cross-project dependency issues** (contains "Requested by:" from another project):
  - These are requests FROM another project asking THIS project to do something
  - Plan + execute the requested work normally
  - **After completion: create a RETURN issue** in the requester's .planning/ISSUES.md:
    ```markdown
    ### ISS-{N}: [Return] {Original issue brief} resolved

    - **Type:** Notification (cross-project return)
    - **From:** {this_project_path} ISS-{M}
    - **Original request:** {requester_path} ISS-{K}
    - **What was done:** {Brief description}
    - **How to verify:** {Specific steps}
    ```
  - Commit the return issue in the requester's ISSUES.md

- After resolving, update status timestamp and **return to poll loop**

**If `OPEN_ISSUES = 0`:**

**Idle housekeeping (use wait time productively):**

Instead of just sleeping, use idle cycles for maintenance tasks. Run ONE task per idle cycle, then poll again.
Track which tasks have been completed in this daemon session to avoid repeating them.

```bash
# Check what housekeeping is needed
HOUSEKEEPING_DONE=${HOUSEKEEPING_DONE:-""}
```

**Priority order (run first uncompleted task, then sleep + poll):**

1. **Documentation review** (if not yet done this session):
   - Scan all files modified in the last milestone
   - Check READMEs, docstrings, inline comments match current code
   - Update stale documentation, remove references to deleted features
   - Commit changes: `docs: update documentation during idle housekeeping`
   - Mark: `HOUSEKEEPING_DONE="$HOUSEKEEPING_DONE|docs"`

2. **Dead code cleanup** (if not yet done):
   - Find exported functions/classes that are never imported elsewhere
   - Find unused imports
   - Remove confirmed dead code (conservative — only remove if zero references)
   - Commit: `refactor: remove dead code during idle housekeeping`
   - Mark: `HOUSEKEEPING_DONE="$HOUSEKEEPING_DONE|deadcode"`

3. **Code quality pass** (if not yet done):
   - Run linter if available (`npm run lint`, `ruff check`, etc.)
   - Fix auto-fixable issues
   - Commit: `style: fix lint issues during idle housekeeping`
   - Mark: `HOUSEKEEPING_DONE="$HOUSEKEEPING_DONE|lint"`

4. **Test coverage review** (if not yet done):
   - Check if existing tests still pass
   - Identify untested functions in recently modified files
   - Generate missing tests via `/gsd:add-tests` for the most recent completed phase
   - Mark: `HOUSEKEEPING_DONE="$HOUSEKEEPING_DONE|tests"`

**After housekeeping task (or if all done):**
- Sleep 60 seconds: `sleep 60`
- Return to poll loop

**3. Exit conditions:**

The daemon runs indefinitely. It exits only when:
- User types anything in the session → Claude receives input → show summary and ask:
  "Continue daemon?" / "Stop"
- The session is killed externally (kitty close, ctrl+c)

**No timeout.** The daemon is meant to run for hours. Status file stays updated so other
sessions can see it's alive.

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
- Worktree workflow: any issues with symlinks, merge, cleanup?

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


<step name="handle_checkpoints">
**Handle blocking checkpoints during execution:**

If execution pauses at checkpoint:decision or checkpoint:human-action:

```
Build paused at checkpoint

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
- [ ] Critical roadmap evaluation completed — every phase reviewed with definition of done
- [ ] Pre-flight check completed (dependencies identified, PREFLIGHT.md generated)
- [ ] Blocking dependencies resolved (or user chose to skip)
- [ ] All phases identified from roadmap
- [ ] Smart discuss runs before planning (infrastructure detection or batch table proposals)
- [ ] Research checked for EVERY phase (respects config.workflow.research flag)
- [ ] Each phase planned before execution
- [ ] Each phase executed completely before next phase planning
- [ ] Post-execution verification routes on status (passed/gaps_found/human_needed)
- [ ] Gap closure limited to 1 retry (prevents infinite loops)
- [ ] Planning uses context from previous phase summaries
- [ ] Progress shown throughout build
- [ ] Pipeline pauses only at blocking checkpoints
- [ ] Open issues checked after all phases complete
- [ ] User notified if open issues exist (not in roadmap)
- [ ] Health check run at startup (.planning/ integrity)
- [ ] Codebase mapped if brownfield project with no .planning/codebase/ docs
- [ ] UI-SPEC generated for frontend phases (before planning)
- [ ] UI review run for frontend phases (after verification)
- [ ] Tests generated after each verified phase (add-tests)
- [ ] Forensics run on persistent failures (daemon/yolo mode)
- [ ] Cross-phase UAT audit run before lifecycle
- [ ] Lifecycle executed: audit-uat -> audit -> complete -> milestone-summary -> docs-cleanup -> cleanup
- [ ] Documentation updated and dead code removed before archiving
- [ ] Status file updated for external monitoring
- [ ] Review gate implemented with Y/N/ENOUGH/CONTINUE/WATCH options
- [ ] CONTINUE option checks for new issues in ISSUES.md
- [ ] WATCH/--daemon mode enters polling loop on ISSUES.md (no signal protocol needed)
- [ ] Post-evaluation completed and improvements applied
- [ ] Final summary shows completion status and open issues count
</success_criteria>
</output>

