---
name: gsd:vision-check
description: Independent vision-alignment judgment for checkpoints, plans, or artifacts — spawns a fresh-context judge agent that tests against PROJECT.md/VISION docs, not against local completion criteria
argument-hint: "<phase|plan|artifact-path> [--checkpoint <json-file>] [--auto]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
user-invocable: true
---

<objective>
Run an independent vision-alignment judgment on a target (phase, plan, checkpoint artifact, or arbitrary work-product). The judge agent spawns in a **fresh context window**, reads the project's vision documents as its primary rubric, and returns a verdict: approve / reject-with-followup / escalate.

**Design intent:** This is NOT a Mark-emulator or a rubber-stamp autoapprover. It's a **vision-alignment judge** — answering the question "does this work measurably move the project toward its stated Nord Star, or is it just filling in checkboxes?"

**Two invocation paths:**

1. **User-invoked** (`/gsd:vision-check 11` or `/gsd:vision-check path/to/artifact.md`) — Mark manually asks for an independent second opinion on a phase, plan, or artifact before committing further resources.

2. **Build-all-invoked** (via `SlashCommand("/gsd:vision-check ... --auto --checkpoint X")`) — `/gsd:build-all` calls this at every `autonomous: false` checkpoint instead of auto-approving. The judge decides; only genuine uncertainty escalates to Mark.

**Output:** JSON verdict to stdout + append to `.planning/vision-decisions.jsonl` for audit + learning.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/vision-check.md
</execution_context>

<context>
**Target resolution from `$ARGUMENTS`:**

- Integer (e.g., `11`) → phase → reads phase dir `.planning/phases/{NN}-*` including PLAN.md, SUMMARY.md, CONTEXT.md
- Plan ID (e.g., `11-02`) → specific plan file
- Path (e.g., `private/people/ali.md`) → arbitrary artifact
- `--checkpoint <json-file>` → structured checkpoint payload from build-all (plan-id, phase, artifact refs, question-for-judge)
- `--auto` → machine-readable JSON-only output (for build-all consumption). Without `--auto`: human-readable report.

**Vision documents (primary rubric — the judge reads these FIRST):**

In priority order:
1. `.planning/PROJECT.md` — Nord Star for THIS project
2. `.planning/PROJECT.md`'s "Vision Metric" section if present (formula + current baseline)
3. Upstream vision docs referenced by PROJECT.md (e.g., `docs/strategy/VISION.md`, `VISION_ADDENDUM_*.md`, ai-automation-vision.md)
4. `.planning/ROADMAP.md` milestone goal for current milestone

**Judge independence constraints:**

- Fresh Task subagent (new context window) — never inline in the invoking orchestrator
- Judge does NOT read `STATE.md` progress/velocity metrics (those encourage completion-bias)
- Judge MAY do research (RAG queries, codebase scan, git log of relevant files) to ground its assessment
- Judge MUST cite at least one vision document sentence in its reasoning — if it can't, it's not doing vision-alignment, it's doing feel
</context>

<process>
Execute the vision-check workflow from @~/.claude/get-shit-done/workflows/vision-check.md end-to-end.

Key phases:
1. **Resolve target** — parse $ARGUMENTS, gather all relevant artifacts
2. **Collect vision rubric** — locate PROJECT.md vision section, upstream vision docs, milestone goal
3. **Spawn judge** — fresh Task with `subagent_type: gsd-vision-judge`, model: opus (this IS the quality gate)
4. **Parse verdict** — expect `{decision, confidence, reasoning, red_flags, followup, vision_citations}`
5. **Apply decision policy** (see `<decision_policy>` below)
6. **Audit log** — append to `.planning/vision-decisions.jsonl`
7. **Format output** — JSON if `--auto`, readable report otherwise
</process>

<decision_policy>
## How build-all (and the user) should act on the verdict

| Verdict | Confidence | Build-all action | User action |
|---------|-----------|------------------|-------------|
| `approve` | ≥ 0.80 | Continue autonomously | Info-only report, no action needed |
| `approve` | 0.60–0.80 | Continue + flag in status.json for post-hoc review | Read the report, decide if further review warranted |
| `approve` | < 0.60 | Escalate (judge itself signals uncertainty) | Review required before proceeding |
| `reject` | any | Execute `followup` (typically: re-iterate upstream, fix prompt, re-run with different params) | Apply `followup` or override |
| `escalate` | any | Wake user with judge's summary + red_flags | Make the decision yourself |

**Golden rule**: if the judge can't cite a vision document in its reasoning, its verdict defaults to `escalate` regardless of confidence. Vision-alignment without vision-grounding is feel, and feel is why rubber-stamping happens.
</decision_policy>

<learning_loop>
## How the judge improves over time

Every verdict is appended to `.planning/vision-decisions.jsonl`:

```json
{
  "ts": "2026-04-22T10:30:00Z",
  "target": "phase-11",
  "verdict": "reject",
  "confidence": 0.88,
  "reasoning": "Phase 11 must-haves are 10 pilot dossiers. VISION metric is ~100% RAG retrieval on email questions. Dossiers on a persons-tabel that's missing 95.6% of contacts give +3% retrieval vs ~15% intended. This is motion without progress.",
  "vision_citations": ["PROJECT.md: 'Target: ~100% retrieval on relevant questions'"],
  "red_flags": ["downstream data source (persons tabel) is structurally broken"],
  "followup": "Run phase-12 first to fix persons tabel; re-evaluate phase-11 after",
  "outcome_verified_at": null,
  "outcome_correct": null
}
```

**Nightly Dream/Ralph hook** (separate issue):

- Scan recent decisions where `outcome_correct` is still null
- Check git log: was the judge's `followup` applied? Did the phase succeed afterwards?
- If the judge was wrong (approved something that turned out bad, or rejected something that should have proceeded): append a `feedback_vision_judge_*` memory with the correction
- Judge reads those memories on its next invocation → calibration drifts toward Mark's actual standard over time

**This is how the judge stops being "generic LLM reasoning about goals" and becomes "the judge that has learned what Mark's definition of 'aligned with the vision' actually means in practice."**
</learning_loop>

<json_output_schema>
When invoked with `--auto`, stdout is exactly this JSON (no prose):

```json
{
  "target": "phase-11",
  "verdict": "approve | reject | escalate",
  "confidence": 0.0,
  "reasoning": "one paragraph max, vision-grounded",
  "vision_citations": ["PROJECT.md: '...'", "VISION.md: '...'"],
  "red_flags": ["specific concerns"],
  "followup": "concrete next step if rejected, else null",
  "audit_entry_id": "uuid-of-jsonl-line"
}
```

Without `--auto`, the output is a human-readable report with banners (see `ui-brand.md`).
</json_output_schema>

<success_criteria>
- [ ] Target resolved (phase | plan | artifact path | --checkpoint file)
- [ ] Vision rubric collected (PROJECT.md + upstream vision docs + milestone goal)
- [ ] gsd-vision-judge subagent spawned with fresh context and Opus model
- [ ] Judge output validated against expected JSON schema
- [ ] At least one vision citation present in reasoning (else auto-escalate)
- [ ] Verdict applied per decision_policy
- [ ] Audit entry appended to .planning/vision-decisions.jsonl
- [ ] Output formatted per --auto flag (JSON or readable report)
</success_criteria>

<related>
- `/gsd:build-all` invokes this at every checkpoint (replaces blanket auto-approve)
- `/gsd:review` — different purpose: cross-AI peer review of plan QUALITY (will it work?). `/gsd:vision-check` asks VISION-ALIGNMENT (does it matter?). Complementary.
- `/gsd:verify-work` — validates built features from user's perspective. `/gsd:vision-check` validates whether the work deserved to be built in the first place.
</related>

<open_questions>
Items for the implementer (left open deliberately — judge-design requires careful thought, not hasty scaffolding):

1. **Model choice**: Opus default feels right (this is the quality gate), but Haiku might be sufficient for simple checkpoints. Benchmark both on 20 real cases before hardcoding.
2. **Escalation UX**: when judge escalates, how is Mark summoned? Telegram via Sero? Desktop notify? Depends on build-all's current orchestration context.
3. **Vision-doc auto-discovery**: PROJECT.md should declare its upstream vision docs explicitly. Needs a `vision_refs:` frontmatter field proposal.
4. **Confidence calibration over time**: the learning loop described above assumes a way to verify judge-outcomes. Define `outcome_correct` signals concretely — is it git revert? Explicit Mark correction? Test re-run?
5. **Judge's research budget**: fresh context + research access is powerful but can burn tokens. Cap at what — 10K tokens of research per verdict? Per day?

These do NOT block shipping the skill file — they're pinned here so the implementer (or the judge itself, recursively) can answer them at build time.
</open_questions>
