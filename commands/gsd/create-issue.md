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
Create a new issue entry in `.planning/ISSUES.md` with proper ISS numbering, format, and all required fields.

This command helps users log bugs, enhancements, or improvements discovered during work, ensuring they're properly documented and tracked.
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

<step name="gather_info">
**Gather issue information via AskUserQuestion:**

Ask the user for:
1. **Brief description** (title)
2. **Type** (Bug/Performance/Refactoring/UX/Testing/Documentation/Accessibility)
3. **Detailed description** (what's wrong, what should happen, what actually happens)
4. **Impact** (High/Medium/Low)
5. **Effort** (Quick/Medium/Substantial)
6. **Suggested phase** (specific phase number or "Future")
7. **Files to change** (optional, but helpful)

Use AskUserQuestion with appropriate options for each field.
</step>

<step name="create_entry">
**Create issue entry:**

Format the issue entry according to GSD template:

```markdown
### ISS-{NEXT_ISS}: {Brief description}

- **Discovered:** {Current date} (during {context - what user was doing})
- **Type:** {Type}
- **Description:** {Detailed description}
- **Impact:** {Impact}
- **Effort:** {Effort}
- **Suggested phase:** {Suggested phase}
- **Files to change:**
  - `path/to/file.py` - {What needs to change}
```

Insert this entry into the "## Open Enhancements" section of `.planning/ISSUES.md`, after any existing issues.
</step>

<step name="confirm">
**Confirm creation:**

Display the created issue entry to the user and ask for confirmation:

```
✓ Issue ISS-{NEXT_ISS} created in .planning/ISSUES.md

{Brief description}

Would you like to:
1. Create a phase to address this issue now
2. Review the issue entry
3. Continue with current work
```

Use AskUserQuestion to get user's choice.

If "Create phase": Offer to run `/gsd:add-phase` or `/gsd:insert-phase`.
</step>

</process>

<success_criteria>
- [ ] ISSUES.md exists (created if needed)
- [ ] Next ISS number correctly identified
- [ ] All required fields gathered from user
- [ ] Issue entry properly formatted and inserted
- [ ] User confirmed the entry
- [ ] Next steps offered (create phase, review, continue)
</success_criteria>

<anti_patterns>
- Don't skip the numbering check - always find the highest existing number
- Don't create duplicate ISS numbers
- Don't skip required fields - ask for all of them
- Don't modify existing issues without user permission
- Don't auto-commit - let user decide when to commit
</anti_patterns>

