---
name: gsd:build-all
description: Build entire project automatically (plan → execute each phase sequentially), then daemon loop for issue resolution + repo improvement
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

**Always-on daemon:** After all phases complete and lifecycle runs, automatically enters
autonomous polling loop watching `.planning/ISSUES.md` for new work. Other sessions
(debug, create-issue) write issues; this session picks them up and resolves them.
During idle time, improves the repository (docs, lint, tests, dead code cleanup).
Status is tracked in `.planning/.build-all-status.json` for external monitoring.
Can be started on already-completed projects (skips to polling immediately).

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
**Fast-path for completed projects — THIS STEP RUNS FIRST, BEFORE ANYTHING ELSE:**

Check immediately if the project is already complete:

```bash
if [ -f .planning/ROADMAP.md ]; then
    TOTAL=$(grep -cE '^\s*- \[' .planning/ROADMAP.md 2>/dev/null || echo "0")
    DONE=$(grep -cE '^\s*- \[x\]' .planning/ROADMAP.md 2>/dev/null || echo "0")
    BUGS=$(awk '/^## Open Bugs/,/^## (Open Enhancements|Resolved)/ { if (/^### ISS-[0-9]+:/ && !/~~/) c++ } END { print c+0 }' .planning/ISSUES.md 2>/dev/null || echo "0")
    ENH=$(awk '/^## Open Enhancements/,/^## Resolved/ { if (/^### ISS-[0-9]+:/ && !/~~/) c++ } END { print c+0 }' .planning/ISSUES.md 2>/dev/null || echo "0")
    OPEN=$((BUGS + ENH))
    echo "FAST_PATH_CHECK|phases=$DONE/$TOTAL|issues=$OPEN"
fi
```

**If all phases complete (`DONE == TOTAL`) AND `OPEN == 0`:**

**STOP HERE.** Go DIRECTLY to `daemon_loop` step. Show:

```
All {TOTAL} phases complete, 0 open issues.
Entering daemon loop on .planning/ISSUES.md...
```

Do not suggest alternatives, do not show completion summaries, do not offer /gsd:new-milestone.

**If phases remaining OR issues open:**
Continue to normal flow (verify → load_roadmap → build_loop). After build completes, daemon_loop is entered automatically.
</step>

<step name="discover_project">
**Find the correct .planning/ directory:**

The working directory may contain multiple GSD projects in subdirectories. The correct project
must be identified BEFORE any other step runs. All subsequent steps use relative `.planning/` paths,
so the working directory must be set to the project root.

```bash
# Find all .planning/ directories (exclude worktrees, node_modules, milestones)
find . -name ".planning" -type d \
    -not -path "*/node_modules/*" \
    -not -path "*/.history/*" \
    -not -path "*/.claude/worktrees/*" \
    2>/dev/null | while read d; do
    [[ "$d" == */milestones/* ]] && continue
    [[ "$d" == *-build-* ]] && continue
    # Only count dirs that have ROADMAP.md or PROJECT.md (real GSD projects)
    [ -f "$d/ROADMAP.md" ] || [ -f "$d/PROJECT.md" ] && echo "$(dirname "$d")"
done
```

**If exactly 1 project found:** `cd` to that directory. Continue.

**If 0 projects found:** Check if `.planning/` exists in current directory (new project without ROADMAP yet).
If yes, stay in current directory. If no, exit with "No planning structure found."

**If multiple projects found:**
Match the session name (from `--name` flag used at launch) against project paths.
The session name typically contains the project name (e.g., `reactor-machine-daemon`, `gmail-build`).

```bash
# Example: session name "reactor-machine-daemon" should match
# ./tools/integrations/reactor_machine/.planning/
```

Compare each project path against the session name using fuzzy matching:
- Convert both to lowercase
- Replace `-` and `_` with spaces
- Check if any project path segments appear in the session name

If a match is found: `cd` to that project directory. Show:
```
Found GSD project: {project_path} (matched session name)
```

If no match: list all found projects and exit with:
```
Multiple GSD projects found. Specify which one by running from the project directory,
or use a session name that matches the project (e.g., --name "reactor-machine-daemon").

Projects:
  1. ./tools/integrations/reactor_machine/
  2. ./private/integrations/gmail/
  ...
```

**After selecting the project, load sibling project context from BRIEF.md:**

Read `.planning/BRIEF.md` if it exists — this file contains the project identity and sibling
GSD project list with their ISSUES.md paths. Created by the fleet launcher or by this step.

```bash
if [ -f .planning/BRIEF.md ]; then
    cat .planning/BRIEF.md
else
    echo "No BRIEF.md found — generating..."
fi
```

**If `.planning/BRIEF.md` does NOT exist, generate it:**

1. Read project name from first line of `.planning/PROJECT.md` (strip `# ` prefix)
2. Read first non-header, non-frontmatter line as description (max 150 chars)
3. Scan the workspace for sibling GSD projects (same logic as discover_project)
4. Write `.planning/BRIEF.md` with:

```markdown
# {Project Name}

{Description}

**Project dir:** `{absolute_path}`
**ISSUES.md:** `{absolute_path}/.planning/ISSUES.md`

## Sibling GSD Projects

- **{sibling-short-name}** — {Sibling Name} — `{sibling}/.planning/ISSUES.md`
- ...
```

5. Commit: `docs: generate BRIEF.md for fleet context`

This ensures every project has a BRIEF.md for cross-project awareness, whether launched
from the fleet or standalone. Use sibling ISSUES.md paths when filing cross-project issues.
</step>

<step name="verify">
**Verify planning structure exists:**

If no `.planning/` directory in the current working directory (after discover_project):
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

**Clean up stale worktree tracking files** (no longer used — all work on current branch):
```bash
for f in .build-all-worktree.json .build-all-current-branch .build-all-original-branch; do
    [ -f ".planning/$f" ] && rm ".planning/$f" && echo "CLEANED: .planning/$f (stale)"
done
```
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

<step name="standards_discovery">
**Discover repo-wide coding standards BEFORE scaffolding begins.**

**Why this step exists:** Subagents spawned by build-all read the subproject's CLAUDE.md — which is auto-generated and unaware of parent-repo coding rules (e.g. proviron `.cursor/rules/`, mark-private `PIPELINE_PRINCIPLES.md`). Without this step, planners and executors silently re-violate rules the repo already committed to. This is exactly how gmail_agent shipped 13 hardcoded paths + CLI duplication on 2026-04-21 — the rules existed but nobody looked them up before planning.

One RAG call here prevents hours of refactor work later.

**Step 1 — RAG discovery (non-negotiable):**

```bash
# Find coding standards documents in this repo and its symlinked parents.
# Uses whichever RAG CLI is available on this machine.
RAG_CLI=$(command -v rag_cli.py 2>/dev/null || \
          ls /home/*/Repositories/*/tools/integrations/gemini/rag_cli.py 2>/dev/null | head -1)

if [ -n "$RAG_CLI" ]; then
    python "$RAG_CLI" query "What are the repo-wide coding standards and conventions that apply to this project? Specifically: are there rules about YAML config vs hardcoded paths, CLI duplication, module reuse patterns, naming conventions, directory structure for integrations? Which rule files (*.mdc, CLAUDE.md, PRINCIPLES.md, best practices docs) should I read before scaffolding? Give exact file paths."
else
    echo "⚠ RAG CLI not found — falling back to filesystem search"
fi
```

**Step 2 — Filesystem fallback:** Regardless of RAG result, list rule files in ancestor directories (parent repos, symlinked repos):

```bash
# Scan up to 3 levels up + any repo in /home/*/Repositories/ for standards
find .. ../.. ../../.. -maxdepth 4 \
    \( -name "*.mdc" -o -name "PIPELINE_PRINCIPLES.md" -o -name "naming_conventions.md" \
       -o -name "general_coding*.md*" -o -name "python.md*" \) \
    2>/dev/null | grep -v "node_modules\|.planning\|worktrees" | sort -u | head -20

# Also: CLAUDE.md files in ancestor directories — these often point at more rules
find .. ../.. ../../.. -maxdepth 4 -name "CLAUDE.md" 2>/dev/null | \
    grep -v "node_modules\|worktrees\|.planning" | head -10
```

**Step 3 — Parse and surface the 3 most-violated rules.**

Read the discovered rule files (or their table-of-contents sections). Look specifically for:

- **Duplication / reuse rules** — "NEVER duplicate", "check tools/ first", "reuse existing wrappers"
- **Config externalization rules** — "config.yaml per pipeline", "no hardcoded paths", "env vars" patterns
- **Naming / structure rules** — snake_case files, language (English-only except private/), directory conventions

Present findings to user before critical_evaluation:

```markdown
## Standards Discovery

Found these authoritative rule files for this repo:

| File | Key Rules |
|------|-----------|
| `path/to/general_coding.mdc` | NEVER Duplicate (reuse tools/), tool discovery MANDATORY |
| `path/to/PIPELINE_PRINCIPLES.md` | config.yaml per pipeline (never hardcoded), models in YAML |
| `path/to/python.md` | @dataclass AppConfig.from_yaml() / from_env() loaders |

These will be passed to every planner + executor via their `<files_to_read>` blocks.
```

**Step 4 — Propagate to subagent prompts.**

Set `STANDARDS_FILES` variable listing absolute paths to rule files. All subagent invocations in subsequent steps (planner, executor, verifier, etc.) MUST include `STANDARDS_FILES` in their `<files_to_read>` block, prefixed with "Read these rule files FIRST. Comply with them — summarize the 3 most-relevant rules before touching code."

**Step 5 — Warn on zero findings.**

If both RAG and filesystem return nothing:
```
⚠ No repo-wide coding standards found.
Either (a) this is a truly standalone project, or (b) standards exist but are
unindexed. Proceeding without cascade — subagents will only have local CLAUDE.md.

To improve future runs: add rule files under parent `.cursor/rules/` or commit a
`CODING_STANDARDS.md` at workspace root, then rebuild RAG index.
```

**Anti-pattern warning:** Do NOT let subagents claim "rules will be followed" without evidence they READ the files. Planner/executor should paraphrase 2-3 rules back in their prompt responses as proof-of-read.

**Auto mode:** Runs silently. Log discovered rule files to STATE.md under a `## Standards Cascade` section for auditability. No user gate.

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

```
Building Entire Project

Plan → execute each phase sequentially.
After completion: lifecycle → daemon loop (issue polling + repo improvement).

All work on current branch (main).
Starting build pipeline...
```

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
   Log human verification items but continue — can't wait for human input.
   File items as issues in ISSUES.md for manual follow-up.

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
   Run forensics to diagnose the persistent failure:
   ```
   Phase {X}: Gaps persist after retry — running forensics...
   /gsd:forensics
   ```
   Log the forensics report. File remaining gaps as issues in ISSUES.md.
   Continue to next phase — daemon will revisit issues later.

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
# Count open bugs AND enhancements (exclude resolved ~~ISS~~ entries)
if [ -f .planning/ISSUES.md ]; then
  BUGS=$(awk '/^## Open Bugs/,/^## (Open Enhancements|Resolved)/ { if (/^### ISS-[0-9]+:/ && !/~~/) c++ } END { print c+0 }' .planning/ISSUES.md)
  ENH=$(awk '/^## Open Enhancements/,/^## Resolved/ { if (/^### ISS-[0-9]+:/ && !/~~/) c++ } END { print c+0 }' .planning/ISSUES.md)
  echo "$((BUGS + ENH))"
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
Log gaps but continue — file as issues for daemon to pick up in next cycle.

**If `tech_debt`:**
Log tech debt but continue — daemon housekeeping will address it.

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
Entering daemon loop...
```

Proceed directly to `daemon_loop` step.
</step>

<step name="daemon_loop">
**Daemon Loop: Autonomous issue polling + repository improvement**

Entered automatically after lifecycle completes, or via fast-path when all phases are already done.

**How it works:** Uses `inotifywait` to block until ISSUES.md is modified, then reads and acts.
Falls back to 30-minute timeout for resilience. No polling, no background processes, no parallel sleeps.

**1. Update status and show banner:**
```bash
cat > .planning/.build-all-status.json <<EOF
{
  "status": "daemon",
  "phase": "issue-loop",
  "timestamp": "$(date -Iseconds)",
  "branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)",
  "poll_interval_seconds": 1800
}
EOF
```

```
## Daemon Mode Active

Watching .planning/ISSUES.md for changes (inotifywait).
Any session that writes issues to ISSUES.md will be automatically picked up.

To stop: type anything in this session.
```

**2. Wait for changes:**

Run this as a **foreground** Bash call (NOT background). This blocks until ISSUES.md changes or 30 minutes pass:

```bash
inotifywait -t 1800 -e modify .planning/ISSUES.md 2>/dev/null; EXIT=$?; sleep 10; if [ $EXIT -eq 0 ]; then echo "ISSUES_CHANGED"; else echo "TIMEOUT"; fi
```

The `sleep 10` is a debounce — waits for the writer to finish (they may do multiple edits).

This command returns exactly one of two strings:
- `ISSUES_CHANGED` — the file was modified by another session
- `TIMEOUT` — 30 minutes passed with no changes

**CRITICAL:** Do NOT run this in background. Run it as a normal foreground Bash call. You will wait for the result. When it returns, proceed to step 3.

**3. Read and count issues:**

When the wait returns (either trigger), read ISSUES.md and count open issues:

```bash
BUGS=$(awk '/^## Open Bugs/,/^## (Open Enhancements|Resolved)/ { if (/^### ISS-[0-9]+:/ && !/~~/) c++ } END { print c+0 }' .planning/ISSUES.md 2>/dev/null)
ENH=$(awk '/^## Open Enhancements/,/^## Resolved/ { if (/^### ISS-[0-9]+:/ && !/~~/) c++ } END { print c+0 }' .planning/ISSUES.md 2>/dev/null)
echo "OPEN_BUGS=$BUGS OPEN_ENH=$ENH TOTAL=$((BUGS + ENH))"
```

**4. Act on result:**

**If TOTAL > 0 (issues found):**

Read ISSUES.md fully to understand the issues:
```bash
cat .planning/ISSUES.md
```

Classify each open (non-strikethrough) issue:

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

After resolving all issues, update status timestamp and **go back to step 2** (wait for changes again).

**If TOTAL = 0 (no issues — either timeout or file changed but no open issues):**

**Idle housekeeping (use wait time productively):**

Run ONE housekeeping task, then go back to step 2 (wait for changes again).
Track which tasks have been completed in this daemon session to avoid repeating them.

**Priority order (run first uncompleted):**

1. **Documentation review** — scan modified files, update stale docs/docstrings, remove references to deleted features. Commit: `docs: idle housekeeping — documentation review`

2. **Dead code cleanup** — find exported functions never imported elsewhere, unused imports. Remove conservatively (zero references only). Commit: `refactor: idle housekeeping — dead code removal`

3. **Code quality** — run project linter (`npm run lint --fix`, `ruff check --fix`), fix auto-fixable issues. Commit: `style: idle housekeeping — lint fixes`

4. **Test health** — run existing tests, fix any that broke. If tests are missing for recent phases, generate via `/gsd:add-tests`. Commit: `test: idle housekeeping — test maintenance`

**After each task, update status file with what was done:**
```bash
python3 -c "
import json, datetime
with open('.planning/.build-all-status.json') as f: s = json.load(f)
s.setdefault('housekeeping', []).append({'task': 'TASK_NAME', 'at': '$(date -Iseconds)', 'commit': 'HASH'})
s['timestamp'] = '$(date -Iseconds)'
with open('.planning/.build-all-status.json', 'w') as f: json.dump(s, f, indent=2)
"
```

**After task (or if all 4 done):** Go back to step 2 (wait for changes again).

**5. Exit conditions:**

The daemon runs indefinitely. It exits only when:
- User types anything in the session → Claude receives input → show summary and ask:
  "Continue daemon?" / "Stop"
- The session is killed externally (kitty close, ctrl+c)

**No timeout on the loop itself.** Each wait cycle is 30 minutes max, but the loop repeats forever.
Status file stays updated so other sessions can see it's alive.

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
- [ ] Stale worktree tracking files cleaned up during health check
- [ ] Daemon loop entered automatically after lifecycle (no review gate)
- [ ] Daemon polls ISSUES.md via inotifywait (no signal protocol needed)
- [ ] Post-evaluation completed and improvements applied
- [ ] Final summary shows completion status and open issues count
</success_criteria>
</output>

