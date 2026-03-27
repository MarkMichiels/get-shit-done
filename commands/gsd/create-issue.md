---
name: gsd:create-issue
description: Create a new issue in ISSUES.md with proper numbering and format
allowed-tools:
  - Read
  - Bash
  - Edit
  - Write
  - AskUserQuestion
user-invocable: true
---

<objective>
Help the user document a bug, enhancement, or improvement they discovered during work.

Through conversation and investigation, understand the problem, synthesize an issue entry, and add it to `.planning/ISSUES.md` with proper ISS numbering and GSD format.

You are a thinking partner helping them articulate the issue, not an interviewer filling out a form. Investigate what you can, ask clarifying questions based on what they share, and synthesize the issue from the conversation.
</objective>

<cross_project_protocol>
## Cross-Project Issue Pingpong

**This is the core mechanism for projects to collaborate.** When your project needs something from another project (data, API, feature, bugfix), the coordination happens through issues — not through direct code changes in the other project.

**The cycle works like human ticket systems:**

```
PROJECT A (requester)                    PROJECT B (provider)
─────────────────────                    ─────────────────────
1. Discovers need for data/fix
   from Project B

2. Creates issue in PROJECT B's
   .planning/ISSUES.md with:
   - Full context of what's needed
   - WHY it's needed (not just what)
   - Expected output format/contract
   - Reference back: "Requested by:
     {project-a} ISS-{N}"
                                         3. Picks up issue (daemon or manual)
                                            Plans + executes fix

                                         4. Creates RETURN issue in
                                            PROJECT A's .planning/ISSUES.md:
                                            "ISS-{X} from {project-b}:
                                             Your request ISS-{N} is resolved.
                                             Verify: {what to check}"

5. Picks up return issue
   Tests if it meets expectations
   - If OK: closes both issues
   - If not OK: updates Project B's
     issue with feedback, cycle repeats
```

**Key rules for cross-project issues:**

1. **Be extremely detailed.** The other project has no context about YOUR project. Explain the problem as if writing to a new team member. Include: what you tried, what failed, what you expect, and where to find the relevant code.

2. **Specify the contract.** Don't say "I need status data." Say "I need a `status.json` at `private/integrations/whatsapp/status.json` with fields: `{last_sync: ISO8601, message_count: int, errors: string[]}`."

3. **Always include a return path.** Tell the provider WHERE to report back: "When done, create an issue in `{path-to-your-ISSUES.md}` with what was changed and how to verify."

4. **The return issue triggers re-verification.** When you receive a return issue, don't just close it — test that the fix actually works for YOUR use case. If it doesn't, update the original issue with specific feedback.

**Cross-project issue format:**

```markdown
### ISS-{N}: {Brief description}

- **Type:** Feature (cross-project dependency)
- **Requested by:** {source_project_path} ISS-{M}
- **Impact:** {High|Medium|Low}
- **Description:** {Detailed explanation — WHY this is needed, not just WHAT}
- **Expected output:**
  - File: `{path/to/expected/artifact}`
  - Format: {description or JSON schema}
  - Contract: {specific fields/behavior required}
- **Return to:** Create issue in `{source_project_planning_path}/ISSUES.md` when resolved
- **Verification:** {How the requester will verify this works}
```

**Return issue format:**

```markdown
### ISS-{N}: [Return] {Original issue brief} resolved

- **Type:** Notification (cross-project return)
- **From:** {provider_project_path} ISS-{M}
- **Original request:** {requester_project_path} ISS-{K}
- **What was done:** {Brief description of changes}
- **How to verify:** {Specific steps — file paths, commands, expected output}
- **Files changed:** {List of files modified in the provider project}
```

</cross_project_protocol>

<context>
@.planning/ISSUES.md
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

<step name="verify">
**Verify project structure:**

Check if `.planning/ISSUES.md` exists:
```bash
[ -f .planning/ISSUES.md ] && echo "EXISTS" || echo "NOT_FOUND"
```

If NOT_FOUND:
```
No ISSUES.md file found.

Creating new ISSUES.md file with template...
```

Create `.planning/ISSUES.md` using template from `~/.claude/get-shit-done/templates/issues.md` if available, or use default template.
</step>

<step name="find_number">
**Find next ISS number:**

Read `.planning/ISSUES.md` and extract all ISS numbers:
```bash
grep -o 'ISS-[0-9]\+' .planning/ISSUES.md | sed 's/ISS-//' | sort -n | tail -1
```

If no numbers found, start with ISS-001.
Otherwise, increment the highest number by 1.

Store the new number as `$NEXT_ISS`.
</step>

<step name="discover">
**1. Open (FREEFORM — do NOT use AskUserQuestion):**

Ask inline: "What did you discover? What problem did you find?"

Wait for their freeform response. This gives you the context needed to understand the issue and ask intelligent follow-up questions.
</step>

<step name="investigate">
**2. Investigate and understand:**

Based on their response, investigate what you can:

- **If they mention specific files/code:** Read those files, understand the context
- **If they mention behavior:** Search codebase for related functionality
- **If they mention errors:** Look for error handling, test scenarios
- **If they mention workflow problems:** Understand the current workflow

**Try to reproduce or understand the problem yourself before asking more questions.**

Use codebase_search, grep, read_file to build understanding.
</step>

<step name="follow_thread">
**3. Follow the thread (NOW use AskUserQuestion):**

Based on their response and your investigation, use AskUserQuestion to clarify:

- header: "[Aspect they mentioned]"
- question: "You mentioned [X] — can you describe what you're seeing?"
- options: 2-3 interpretations based on your investigation + "Something else"

**Examples:**
- If they mention a bug: "Is this happening every time, or only in specific cases?"
- If they mention performance: "Is this blocking your work, or just noticeable?"
- If they mention missing feature: "Is this something you need now, or can it wait?"

**Don't ask about things you can figure out yourself** (file paths, code structure, etc.)
</step>

<step name="synthesize">
**4. Synthesize the issue:**

Based on the conversation and your investigation, determine:

- **Brief description** (title) - From what they described
- **Type** - Infer from context (Bug/Performance/Refactoring/UX/Testing/Documentation/Accessibility)
- **Detailed description** - Synthesize their explanation with your investigation findings
- **Impact** - Infer from context (High if blocking, Medium if noticeable, Low if minor)
- **Effort** - Estimate based on files involved and complexity (Quick/Medium/Substantial)
- **Suggested phase** - Check roadmap for natural fit, or "Future"
- **Files to change** - From your investigation

**Present a draft issue entry:**

```
### ISS-{NEXT_ISS}: {Brief description}

- **Discovered:** {Current date} (during {context})
- **Type:** {Type}
- **Description:** {Synthesized description}
- **Impact:** {Impact}
- **Effort:** {Effort}
- **Suggested phase:** {Suggested phase}
- **Files to change:**
  - `path/to/file.py` - {What needs to change}
```

**Write immediately to ISSUES.md** so the user can review it in the actual file:

1. Read current `.planning/ISSUES.md`
2. Format the issue entry according to GSD template
3. Insert this entry into the "## Open Enhancements" section, after any existing issues
4. Write updated `.planning/ISSUES.md`

```
Issue ISS-{NEXT_ISS} written to .planning/ISSUES.md — review it there.
```

**Refinement loop:**

Use AskUserQuestion:
- header: "Issue ISS-{NEXT_ISS}"
- question: "Review the issue in ISSUES.md. Refine or submit?"
- options:
  - "Submit" — Issue is final. Signal build-all if watching.
  - "Refine" — I want to adjust something.
  - "Cancel" — Remove this issue from ISSUES.md.

**If "Refine":**
1. Ask (inline, NOT AskUserQuestion): "What needs to change?"
2. User provides feedback
3. Update the issue entry in `.planning/ISSUES.md` (Edit tool)
4. Show: "Updated ISS-{NEXT_ISS} in ISSUES.md"
5. Present same Submit/Refine/Cancel options again
6. Repeat until "Submit" or "Cancel"

**If "Cancel":**
- Remove the issue entry from `.planning/ISSUES.md`
- Show: "ISS-{NEXT_ISS} removed."
- Exit

**If "Submit":**
- Proceed to `complete` step (signal build-all if watching)
</step>

<step name="complete">
**Present completion and next steps:**

**Check if build-all is watching:**
```bash
BUILD_STATUS=$(cat .planning/.build-all-status.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
```

**If build-all is watching (`BUILD_STATUS` = `watching`):**
```
✓ Issue ISS-{NEXT_ISS} created in .planning/ISSUES.md

{Brief description}

Impact: {Impact} | Effort: {Effort} | Suggested: {Suggested phase}

Build-all is watching for new issues.
```

Use AskUserQuestion:
- header: "Next"
- question: "Build-all is in watch mode. Signal it to pick up this issue?"
- options:
  - "Signal build-all" — Run `bash "$HOME/.claude/get-shit-done/scripts/issue-signal.sh" .planning`, then show "Build-all notified — it will pick up this issue automatically."
  - "Create another issue first" — Run /gsd:create-issue again (collect more issues before signaling)
  - "Signal later" — Don't signal yet, back to work. User runs `issue-signal.sh` manually when ready.
  - "Create phase instead" — Run /gsd:add-phase or /gsd:insert-phase (bypass build-all, plan directly)

**If build-all is NOT watching (or no status file):**
```
✓ Issue ISS-{NEXT_ISS} created in .planning/ISSUES.md

{Brief description}

Impact: {Impact} | Effort: {Effort} | Suggested: {Suggested phase}
```

Use AskUserQuestion:
- header: "Next"
- question: "What would you like to do?"
- options:
  - "Create phase to fix this" - Run /gsd:add-phase or /gsd:insert-phase
  - "Continue working" - Issue logged, back to work
  - "Review issue" - Show the full entry
  - "Create another issue" - Run /gsd:create-issue again

If "Create phase": Offer appropriate command based on urgency and roadmap context.
</step>

</process>

<success_criteria>
- [ ] ISSUES.md exists (created if needed)
- [ ] Next ISS number correctly identified
- [ ] Problem understood through conversation and investigation
- [ ] Issue entry synthesized from conversation (not interrogated)
- [ ] User confirmed the synthesized entry
- [ ] Issue entry properly formatted and inserted
- [ ] Next steps offered (create phase, review, continue)
</success_criteria>

<anti_patterns>
- Don't skip the numbering check - always find the highest existing number
- Don't create duplicate ISS numbers
- Don't ask about things you can figure out yourself (file paths, code structure, etc.)
- Don't interrogate with a checklist - follow their explanation naturally
- Don't skip investigation - understand the problem before asking questions
- Don't modify existing issues without user permission
- Don't auto-commit - let user decide when to commit
- Don't ask for all fields upfront - synthesize from conversation
</anti_patterns>
