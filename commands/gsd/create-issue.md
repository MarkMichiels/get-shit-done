---
name: gsd:create-issue
description: Create a new issue in ISSUES.md with proper numbering and format
allowed-tools:
  - Read
  - Bash
  - Edit
  - Write
  - AskUserQuestion
---

<objective>
Help the user document a bug, enhancement, or improvement they discovered during work.

Through conversation and investigation, understand the problem, synthesize an issue entry, and add it to `.planning/ISSUES.md` with proper ISS numbering and GSD format.

You are a thinking partner helping them articulate the issue, not an interviewer filling out a form. Investigate what you can, ask clarifying questions based on what they share, and synthesize the issue from the conversation.
</objective>

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

Use AskUserQuestion:
- header: "Issue Summary"
- question: "Does this capture the issue correctly?"
- options:
  - "Yes, create it" - Proceed to create
  - "Adjust description" - Let me refine it
  - "Add more details" - I have more to share
  - "Cancel" - Don't create issue
</step>

<step name="create_entry">
**Create issue entry:**

If user confirmed "Yes, create it" or provided refinements:

1. Read current `.planning/ISSUES.md`
2. Format the issue entry according to GSD template (using synthesized information from previous step)
3. Insert this entry into the "## Open Enhancements" section, after any existing issues
4. Write updated `.planning/ISSUES.md`

If user selected "Adjust description" or "Add more details":
- Use AskUserQuestion to gather the specific refinement
- Update the draft and present again (return to synthesize step)
- Loop until confirmed

If user selected "Cancel":
- Exit without creating issue
</step>

<step name="complete">
**Present completion and next steps:**

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
