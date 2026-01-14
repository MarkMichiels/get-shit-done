---
name: gsd:debug-example
description: Example debug workflow command (template for creating debug workflows)
---

<objective>
Example command showing how to create a debug workflow that coordinates with build-all.

**Key principles:**
1. Use status files for external monitoring (`.planning/.debug-status.json`)
2. Interactive workflow - continues until user says "enough"
3. Review gate after each cycle for user feedback
4. Post-evaluation to improve the command itself
5. Coordinate with build-all via status files

**Workflow pattern:**
1. Debug/analyze → Create issues → Update status: "ready"
2. Wait for review (Y/N/ENOUGH/CONTINUE)
3. If CONTINUE: Check if build-all resolved issues → Restart if needed
4. If ENOUGH: Mark status "done" → End workflow
5. Post-evaluation: Improve command based on experience
</objective>

<process>

<step name="setup">
**Setup and initialization:**

1. **Detect repository:**
   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
   ```

2. **Create initial status:**
   ```bash
   cat > .planning/.debug-status.json <<EOF
   {
     "status": "active",
     "phase": "setup",
     "timestamp": "$(date -Iseconds)"
   }
   EOF
   ```
</step>

<step name="debug_workflow">
**Main debug workflow:**

1. **Analyze problem**
2. **Create issues** (if bugs found)
3. **Fix user errors** (if any)
4. **Document findings**

After each cycle, update status:
```bash
cat > .planning/.debug-status.json <<EOF
{
  "status": "ready",
  "phase": "review",
  "timestamp": "$(date -Iseconds)",
  "issues_created": ["ISS-XXX", "ISS-YYY"],
  "errors_fixed": 3
}
EOF
```
</step>

<step name="review_gate">
**Review gate: Pause for user review (Y/N/ENOUGH/CONTINUE):**

Show summary and ask:
- **Y** = proceed to final step
- **N** = collect corrections, apply fixes, repeat review
- **ENOUGH** = stop debugging, mark status "done", end workflow
- **CONTINUE** = check if build-all resolved issues, restart if needed

**If CONTINUE:**
- Check if issues were resolved (by build-all)
- If resolved, restart from `debug_workflow` step
- If not resolved, ask user what to do
</step>

<step name="final">
**Final step (only after Y approval):**

1. Commit changes
2. Update status: `"status": "done"`
3. Clean up temp files
</step>

<step name="post_evaluation">
**Post-evaluation: Retrospective + improve command:**

1. Write summary of what was done
2. Identify what was tricky/slow
3. Propose command improvements
4. Apply improvements to this command file
5. Ask YES/NO to commit command changes
</step>

</process>

<success_criteria>
- [ ] Status file created and updated at each phase
- [ ] Review gate implemented with Y/N/ENOUGH/CONTINUE options
- [ ] CONTINUE option checks for resolved issues and restarts if needed
- [ ] Post-evaluation completed and improvements applied
- [ ] Command changes committed (if user approved)
</success_criteria>
