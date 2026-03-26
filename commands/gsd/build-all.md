---
name: gsd:build-all
description: Build entire project automatically (plan → execute each phase sequentially) using git worktree isolation
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

**Worktree isolation (default):**
- All development happens in a **git worktree** in a sibling directory
- Main branch is NEVER touched during development
- Crons, other processes, and parallel sessions on main keep running undisturbed
- Worktree gets its own branch, own working directory, own symlinks
- At end of cycle, worktree branch is merged back to main
- Worktree is cleaned up after successful merge
- If something goes wrong, recovery is straightforward (see Worktree Recovery below)

**Interactive mode:**
- Workflow continues until user explicitly says "it's done" or "enough"
- Status is tracked in `.planning/.build-all-status.json` for external monitoring
- Review gate after each cycle for user feedback
- Post-evaluation to improve the command itself
- External process can optionally monitor status file for coordination

## Parallel Projects

Multiple GSD projects in the same repo can run build-all simultaneously:
- Each gets its own worktree: `mark-private-build-gmail`, `mark-private-build-transcripts`
- Each gets its own branch: `build-gmail-20260325-...`, `build-transcripts-20260325-...`
- Proviron tools/scripts are shared (symlinked, not copied)
- Merges happen independently — conflicts resolved at merge time
- Databases are symlinked from main repo (shared read, worktree doesn't copy binary files)

## Worktree Recovery

If something goes wrong mid-build:

1. Check worktree status:
   ```bash
   git worktree list
   ```

2. Remove broken worktree:
   ```bash
   git worktree remove /path/to/worktree --force
   ```

3. Delete orphaned branch:
   ```bash
   git branch -D branch-name
   ```

4. Start fresh:
   ```
   /gsd:build-all
   ```

5. If worktree directory remains after removal:
   ```bash
   rm -rf /path/to/worktree
   git worktree prune
   ```
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
ls .planning/codebase/*.md 2>/dev/null  # Existing codebase analysis
```

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

**6. Recommend branch strategy:**

Based on the roadmap analysis, recommend whether to use an isolated branch or work on main. Don't ask blind — make a recommendation with reasoning.

**Factors that favor isolated branch (worktree):**
- Production repo with running crons, daemons, or services on main
- Parallel build-all sessions in the same repo
- Large/risky changes that could break main mid-build
- Shared repo with other contributors

**Factors that favor main branch (no worktree):**
- Solo work, no services running on main
- Small project (1-3 phases)
- New project (nothing to break yet)
- Project is in a subdirectory that doesn't affect main-branch processes

Present as part of the assessment summary:

```
### Branch Strategy

**Recommendation: Main branch** (no worktree isolation)
Reason: {e.g., "New project with 3 phases, no services running on main. Worktree adds unnecessary complexity."}
```
or:
```
### Branch Strategy

**Recommendation: Isolated branch** (worktree)
Reason: {e.g., "This repo has cron jobs running on main. 6 phases with significant file changes — safer to isolate."}
```

The user can override, but present a clear recommendation. Set `WORKTREE_MODE` based on user's choice (or the recommendation if user accepts).

**7. Final summary and proceed:**

**If everything looks solid (no issues, or all issues resolved):**
```
## Build Readiness: ✅ All Clear

{N} phases reviewed. All goals are specific, success criteria are testable, and phases connect logically.
Branch: {main | isolated worktree} — {1-line reason}

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
- Continue to setup_worktree step
- Build proceeds autonomously

**If "Show setup guides":**
- Display contents of PREFLIGHT.md
- Ask again after user reviews

**If "Skip pre-flight":**
- Warn: "Build will pause at checkpoints requiring manual setup"
- Continue to setup_worktree step
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
Continue to setup_worktree step.
</if>

<if mode="yolo">
- Still generate PREFLIGHT.md for reference
- Show summary but don't ask for confirmation
- Log warning if blocking dependencies found
- Proceed to build (will hit checkpoints if setup incomplete)
</if>
</step>

<step name="setup_worktree">
**Setup git worktree for isolated development:**

**If `WORKTREE_MODE=false`:** Skip this entire step. Set `WORKTREE_ACTIVE=false`. All work happens on the current branch.
```
Working directly on main branch. No worktree isolation.
```
Continue to build_loop.

**If `WORKTREE_MODE=true`:**

All development happens in a sibling worktree directory. The main branch stays untouched
so crons, parallel sessions, and other processes keep running.

**Each GSD project gets its own worktree.** Multiple projects in the same repo can run in parallel
on separate branches. Merges happen independently.

**Derive project slug for worktree isolation:**
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Derive project slug from .planning/ location relative to repo root
PLANNING_DIR=$(realpath .planning)
PROJECT_REL=$(realpath --relative-to="$REPO_ROOT" "$PLANNING_DIR" | sed 's|/.planning||; s|/|-|g')
if [ "$PROJECT_REL" = ".planning" ] || [ -z "$PROJECT_REL" ]; then
    PROJECT_SLUG="root"
else
    PROJECT_SLUG="$PROJECT_REL"
fi

WORKTREE_PATH="${REPO_ROOT}/../${REPO_NAME}-build-${PROJECT_SLUG}"
BRANCH_NAME="build-${PROJECT_SLUG}-$(date +%Y%m%d-%H%M%S)"
```

This produces project-specific paths:
- `mark-private-build-private-integrations-gmail` for the gmail project
- `mark-private-build-private-integrations-transcripts` for the transcripts project
- `mark-private-build-root` for a project at repo root

Multiple GSD projects can run in parallel without worktree collisions.

**If not a git repository:**
```
Not a git repository. Worktree workflow skipped.
Continuing without worktree isolation.
```
Set `WORKTREE_ACTIVE=false` and continue to build_loop. All work happens in current directory.

**If a worktree already exists at WORKTREE_PATH:**
```bash
if [ -d "$WORKTREE_PATH" ]; then
  echo "EXISTING_WORKTREE"
  # Check if it's a valid worktree
  git -C "$WORKTREE_PATH" rev-parse --git-dir 2>/dev/null && echo "VALID" || echo "STALE"
fi
```

**If EXISTING_WORKTREE and VALID:**
```
Existing build worktree found at {WORKTREE_PATH}
Resuming work in existing worktree.
```
Set `WORKTREE_ACTIVE=true`. Read branch name from existing worktree:
```bash
BRANCH_NAME=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD)
```
Skip worktree creation, continue to build_loop.

**If EXISTING_WORKTREE and STALE:**
```
Stale worktree found. Cleaning up and creating fresh worktree.
```
```bash
git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || rm -rf "$WORKTREE_PATH"
git worktree prune
```
Continue to worktree creation below.

**Create worktree:**
```bash
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$CURRENT_BRANCH"
```

**Setup symlinks in worktree (critical for mark-private and similar repos):**
```bash
cd "$WORKTREE_PATH"

# Try repo's own setup script first
if [ -f setup_workspace.sh ]; then
    ./setup_workspace.sh 2>/dev/null || true
fi

# Ensure critical symlinks exist (proviron tools/scripts)
# Proviron is SHARED — all worktrees point to the same proviron repo (not copied)
PROVIRON_DIR="${REPO_ROOT}/../proviron"
if [ -d "$PROVIRON_DIR" ]; then
    [ -L tools ] || ln -sf "$PROVIRON_DIR/tools" tools 2>/dev/null || true
    [ -L scripts ] || ln -sf "$PROVIRON_DIR/scripts" scripts 2>/dev/null || true
    [ -L .crossnote ] || ln -sf "$PROVIRON_DIR/.crossnote" .crossnote 2>/dev/null || true
fi

# Symlink databases and other binary/large files from main repo
# (gitignored files don't exist in worktrees — symlink from main)
PROJECT_DIR_IN_WORKTREE="$WORKTREE_PATH/$PROJECT_REL"
PROJECT_DIR_IN_MAIN="$REPO_ROOT/$PROJECT_REL"
if [ -d "$PROJECT_DIR_IN_MAIN" ]; then
    for db in $(find "$PROJECT_DIR_IN_MAIN" -maxdepth 1 -name "*.db" -o -name "*.db-shm" -o -name "*.db-wal" -o -name "*.pkl" 2>/dev/null); do
        dbname=$(basename "$db")
        [ -f "$PROJECT_DIR_IN_WORKTREE/$dbname" ] || ln -sf "$db" "$PROJECT_DIR_IN_WORKTREE/$dbname" 2>/dev/null || true
    done
    # Symlink model directories (pickle files for ML)
    for modeldir in $(find "$PROJECT_DIR_IN_MAIN" -maxdepth 1 -type d -name "models" 2>/dev/null); do
        dirname=$(basename "$modeldir")
        [ -e "$PROJECT_DIR_IN_WORKTREE/$dirname" ] || ln -sf "$modeldir" "$PROJECT_DIR_IN_WORKTREE/$dirname" 2>/dev/null || true
    done
fi
```

**Store worktree metadata:**
```bash
# Store in project-level .planning, not repo-level
mkdir -p "$PROJECT_DIR_IN_WORKTREE/.planning"
cat > "$PROJECT_DIR_IN_WORKTREE/.planning/.build-all-worktree.json" <<EOF
{
  "repo_root": "$REPO_ROOT",
  "worktree_path": "$WORKTREE_PATH",
  "project_dir": "$PROJECT_DIR_IN_WORKTREE",
  "project_slug": "$PROJECT_SLUG",
  "branch_name": "$BRANCH_NAME",
  "base_branch": "$CURRENT_BRANCH",
  "created": "$(date -Iseconds)"
}
EOF
```

Set `WORKTREE_ACTIVE=true`.

```
Created build worktree:
  Branch: {BRANCH_NAME}
  Path: {WORKTREE_PATH}
  Project: {PROJECT_SLUG}
  Base: {CURRENT_BRANCH}

Main branch is untouched. All work happens in worktree.
Proviron tools/scripts shared (not copied).
Databases symlinked from main repo.
```

**IMPORTANT:** From this point forward, ALL file operations, git commands, and slash command invocations
must operate within `WORKTREE_PATH`, not `REPO_ROOT`. When invoking slash commands, ensure the
working directory is set to the worktree path.

**PATH SAFETY:** Scripts in the worktree may have hardcoded absolute paths (e.g., `PRIVATE_ROOT = Path("/home/mark/Repositories/mark-private/private")`).
These will resolve to the MAIN repo, not the worktree. For code that writes to `private/`, this is actually correct — knowledge documents should be written to the main knowledge base. For code that reads `.planning/` or project-specific files, use relative paths or `Path(__file__).parent`.
</step>

<step name="build_loop">
**Build all phases sequentially (with issue resolution loop):**

<if mode="yolo">
```
Building Entire Project

This will plan and execute each phase sequentially.
Each phase planning uses context from previous phase summaries.
Open issues will be automatically addressed after roadmap phases complete.

Worktree: {WORKTREE_PATH} (main branch untouched)
Loop mode: After completion, waits for review and checks for new issues
Merge: Worktree branch merges to main at end of each cycle

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

Worktree: {WORKTREE_PATH} (main branch untouched)
Loop mode: After completion, waits for review and checks for new issues
Merge: Worktree branch merges to main at end of each cycle

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

   **2b. Check if research needed:**

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

   **2c. Plan the phase:**
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
   Continue to next phase.

   **If `human_needed`:**
   Read human_verification section from VERIFICATION.md. Present items to user:
   - "Validate now" — present specific items, ask for result
   - "Continue without validation" — defer validation, proceed

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

   If gap closure attempted and gaps persist after retry, ask user to continue or stop.

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
- Continue to merge_worktree step
- After merge, continue to loop_mode step (check for new issues)

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

<step name="merge_worktree">
**Merge worktree branch back to main (or base branch):**

**Only if WORKTREE_ACTIVE=true:**

```bash
# Read worktree metadata
cat "$WORKTREE_PATH/.planning/.build-all-worktree.json"
```

Extract `repo_root`, `branch_name`, `base_branch`.

**1. Ensure all changes in worktree are committed:**
```bash
cd "$WORKTREE_PATH"
if [ -n "$(git status --porcelain)" ]; then
  echo "UNCOMMITTED_CHANGES"
else
  echo "CLEAN"
fi
```

If UNCOMMITTED_CHANGES:
```
Uncommitted changes detected in worktree. Committing...
```
```bash
cd "$WORKTREE_PATH"
git add -A
git commit -m "chore: commit remaining changes before merge"
```

**2. Switch to main repo and merge:**
```bash
cd "$REPO_ROOT"
git merge "$BRANCH_NAME" --no-ff -m "Merge build: $BRANCH_NAME"
```

**3. Handle merge conflicts:**
- If conflicts occur, show error and pause
- In interactive mode: Wait for user to resolve
- In YOLO mode: Attempt automatic resolution if possible, otherwise pause

**If merge successful:**
```
Successfully merged {BRANCH_NAME} to {BASE_BRANCH}
All build work is now on the main branch.
```

**4. Push if remote exists:**
```bash
cd "$REPO_ROOT"
git remote get-url origin 2>/dev/null && git push origin "$BASE_BRANCH" || true
```

**5. Cleanup worktree and branch:**
```bash
cd "$REPO_ROOT"
git worktree remove "$WORKTREE_PATH"
git branch -d "$BRANCH_NAME"
```

```
Worktree cleaned up:
  Removed: {WORKTREE_PATH}
  Deleted branch: {BRANCH_NAME}
```

**If merge failed:**
```
Merge conflicts detected

Please resolve conflicts manually:
1. cd {REPO_ROOT}
2. Fix conflicts in affected files
3. Run: git add <resolved-files>
4. Run: git commit
5. Then cleanup: git worktree remove {WORKTREE_PATH} && git branch -d {BRANCH_NAME}

Or to abort the merge:
  git merge --abort
```
Pause and wait for user to resolve.

**If WORKTREE_ACTIVE=false:**
```
No worktree active. Skipping merge.
```
</step>

<step name="lifecycle">
**Lifecycle: audit -> complete -> cleanup (from autonomous.md):**

After all phases complete and merge succeeds, run the milestone lifecycle sequence.

```
LIFECYCLE

All phases complete + merged -> Starting lifecycle: audit -> complete -> cleanup
```

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
Read the gaps summary. Ask user:
- "Continue anyway — accept gaps" -> proceed
- "Stop — fix gaps manually" -> pause

**If `tech_debt`:**
Read the tech debt summary. Ask user:
- "Continue with tech debt" -> proceed
- "Stop — address debt first" -> pause

**If audit file missing or no status:**
Log warning but continue — audit may not be configured for all projects.

**2. Complete Milestone:**

Invoke: `SlashCommand("/gsd:complete-milestone")`

Verify archive produced:
```bash
ls .planning/milestones/v*-ROADMAP.md 2>/dev/null
```

**3. Cleanup:**

Invoke: `SlashCommand("/gsd:cleanup")`

Cleanup shows its own dry-run and asks user for approval internally.

```
Lifecycle complete: audit -> complete -> cleanup
```
</step>

<step name="review_gate">
**Review gate: Pause for user review (Y/N/ENOUGH/CONTINUE to proceed):**

At this point, the build cycle should be complete:
- All phases planned and executed
- Worktree merged to main (if worktree workflow used)
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
- Worktree merged and cleaned up
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
- If new issues found, return to `setup_worktree` step (new worktree for new cycle)
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
- Worktree workflow: any issues with symlinks, merge, cleanup?

**Then propose concrete command improvements:**
- Which steps were unclear?
- Which missing instructions caused you to search/guess?
- Which recurring failure modes should be handled (status tracking, workspace detection, edge cases)?
- What user feedback suggests improvements?
- How can status tracking be improved?
- Were there worktree-specific issues (symlink setup, path resolution)?

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
     "worktree_active": false,
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
   Build Cycle Complete!

   All phases planned and executed
   Total phases: {N}
   All summaries created
   All commits made
   All open issues addressed (if applicable)
   Status file updated: .planning/.build-all-status.json

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
- [ ] Branch strategy recommended based on roadmap analysis (not asked blind)
- [ ] Pre-flight check completed (dependencies identified, PREFLIGHT.md generated)
- [ ] Blocking dependencies resolved (or user chose to skip)
- [ ] If worktree mode: Git worktree created in sibling directory (main branch untouched)
- [ ] If worktree mode: Symlinks set up in worktree (setup_workspace.sh or manual fallback)
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
- [ ] Worktree branch merged to main after cycle complete
- [ ] Worktree cleaned up after successful merge
- [ ] Lifecycle executed: audit -> complete -> cleanup
- [ ] Status file updated for external monitoring
- [ ] Review gate implemented with Y/N/ENOUGH/CONTINUE options
- [ ] CONTINUE option checks for new issues in ISSUES.md
- [ ] Post-evaluation completed and improvements applied
- [ ] Final summary shows completion status and open issues count
- [ ] Worktree recovery instructions documented in objective
</success_criteria>
</output>

