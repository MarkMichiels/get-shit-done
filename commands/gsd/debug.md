---
name: gsd:debug
description: Systematic debugging with persistent state across context resets
argument-hint: [issue description]
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
user-invocable: true
---

<objective>
Debug issues using scientific method with subagent isolation.

**Orchestrator role:** Gather symptoms, spawn gsd-debugger agent, handle checkpoints, spawn continuations.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation. Main context stays lean for user interaction.
</objective>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-debugger — Diagnoses and fixes issues
</available_agent_types>

<context>
User's issue: $ARGUMENTS

Check for active sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```
</context>

<process>

## 0. Initialize Context

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract `commit_docs` from init JSON. Resolve debugger model:
```bash
debugger_model=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-debugger --raw)
```

## 1. Check Active Sessions

If active sessions exist AND no $ARGUMENTS:
- List sessions with status, hypothesis, next action
- User picks number to resume OR describes new issue

If $ARGUMENTS provided OR user describes new issue:
- Continue to symptom gathering

## 2. Gather Symptoms (if new issue)

Use AskUserQuestion for each:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

## 3. Spawn gsd-debugger Agent

Fill prompt and spawn:

```markdown
<objective>
Investigate issue: {slug}

**Summary:** {trigger}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/{slug}.md
</debug_file>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-debugger",
  model="{debugger_model}",
  description="Debug {slug}"
)
```

## 4. Handle Agent Return

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options:
  - "Fix now" - spawn fix subagent
  - "File as issue" - write to ISSUES.md (see step 6)
  - "Plan fix" - suggest /gsd:plan-phase --gaps
  - "Manual fix" - done

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- If checkpoint type is `human-verify`:
  - If user confirms fixed: continue so agent can finalize/resolve/archive
  - If user reports issues: continue so agent returns to investigation/fixing
- Spawn continuation agent (see step 5)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options:
  - "Continue investigating" - spawn new agent with additional context
  - "File what we know" - write partial findings as issue to ISSUES.md (see step 6)
  - "Manual investigation" - done
  - "Add more context" - gather more symptoms, spawn again

## 5. Spawn Continuation Agent (After Checkpoint)

When user responds to checkpoint, spawn fresh agent:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug file.
</objective>

<prior_state>
<files_to_read>
- .planning/debug/{slug}.md (Debug session state)
</files_to_read>
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="gsd-debugger",
  model="{debugger_model}",
  description="Continue debug {slug}"
)
```

## 6. File Issue and Signal Build-All

When the user chooses "File as issue" or "File what we know", create an issue in ISSUES.md
and optionally signal a watching build-all session.

**Write issue to ISSUES.md:**

```bash
# Find next ISS number
LAST_ISS=$(grep -oE 'ISS-[0-9]+' .planning/ISSUES.md 2>/dev/null | sort -t- -k2 -n | tail -1 | grep -oE '[0-9]+')
NEXT_ISS=$((${LAST_ISS:-0} + 1))
```

Append to the `## Open Enhancements` section of `.planning/ISSUES.md`:

```markdown
### ISS-{NEXT_ISS}: {Brief description from root cause}
- **Type:** Bug
- **Impact:** {High|Medium|Low — based on debug findings}
- **Root Cause:** {From debug session findings}
- **Debug Session:** .planning/debug/{slug}.md
- **Suggested Fix:** {From debug agent's recommendation}
```

Commit the issue:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: file ISS-${NEXT_ISS} from debug session ${slug}" --files .planning/ISSUES.md
```

**Signal build-all (if watching):**

Check if build-all is in watch mode:
```bash
STATUS=$(cat .planning/.build-all-status.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
```

**If `STATUS` is `watching`:**
```bash
GSD_DIR="$HOME/.claude/get-shit-done"
bash "$GSD_DIR/scripts/issue-signal.sh" .planning
```
```
Issue filed: ISS-{NEXT_ISS}
Build-all notified — it will pick up this issue automatically.
```

**If `STATUS` is NOT `watching` (or no status file):**
```
Issue filed: ISS-{NEXT_ISS}
No build-all session watching. Run /gsd:build-all to process this issue.
```

**Multiple issues:** If the user wants to file more issues before signaling, offer:
- "File another" — repeat step 6 without signaling yet
- "Signal now" — run issue-signal.sh to notify build-all
- "Done" — issues filed but no signal (user will signal manually or run build-all later)

</process>

<success_criteria>
- [ ] Active sessions checked
- [ ] Symptoms gathered (if new)
- [ ] gsd-debugger spawned with context
- [ ] Checkpoints handled correctly
- [ ] Root cause confirmed before fixing
- [ ] Issues filed to ISSUES.md when requested (step 6)
- [ ] Build-all signaled when in watch mode
</success_criteria>
