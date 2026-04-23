<purpose>
Run an independent vision-alignment judgment on a target (phase / plan / artifact path / build-all checkpoint). Spawns a fresh-context Opus judge (gsd-vision-judge) that reads the project's vision documents as its primary rubric and returns a verdict: approve / reject / escalate.

This workflow is the execution body backing `/gsd:vision-check`. Two callers:
1. **User** — `/gsd:vision-check 11` or `/gsd:vision-check path/to/artifact.md` — get an independent second opinion.
2. **Build-all** — `SlashCommand("/gsd:vision-check --auto --checkpoint /tmp/foo.json")` — delegate checkpoint decisions to the judge instead of rubber-stamping.
</purpose>

<core_principle>
The judge is NOT a Mark-emulator and NOT a rubber-stamp auto-approver. It answers ONE question: **"does this work measurably move the project toward its stated North Star, or is it just filling in checkboxes?"**

Fresh context window, reads vision docs first, returns JSON with citations. If it cannot cite a vision document it defaults to `escalate` — vision-alignment without vision-grounding is feel, and feel is why rubber-stamping happens.
</core_principle>

<process>

<step name="parse_args" priority="first">
Parse `$ARGUMENTS`:

- First positional token → `TARGET` (integer phase, plan-id like `11-02`, or path)
- `--auto` → set `AUTO_MODE=1` (JSON-only stdout)
- `--checkpoint <json-file>` → set `CHECKPOINT_FILE` (structured payload from build-all)
- `--reason <text>` → free-form framing passed verbatim to the judge

If both `--checkpoint` and a positional target are given, the checkpoint file wins: its `phase` / `plan` fields are the target.

If no target and no checkpoint: error with usage and exit 1.
</step>

<step name="resolve_target">
Normalize `TARGET` into a concrete set of artifacts the judge must read.

```bash
# Case 1: --checkpoint — trust the payload
if [ -n "$CHECKPOINT_FILE" ] && [ -f "$CHECKPOINT_FILE" ]; then
    TARGET_KIND="checkpoint"
    PHASE=$(jq -r '.phase // empty' "$CHECKPOINT_FILE")
    PLAN=$(jq -r '.plan // empty' "$CHECKPOINT_FILE")
    QUESTION=$(jq -r '.question // empty' "$CHECKPOINT_FILE")
    ARTIFACT_REFS=$(jq -r '.artifacts[]? // empty' "$CHECKPOINT_FILE" | paste -sd',' -)
# Case 2: integer phase (e.g. "11")
elif echo "$TARGET" | grep -qE '^[0-9]+$'; then
    TARGET_KIND="phase"
    PHASE_DIR=$(ls -d .planning/phases/$(printf "%02d" "$TARGET")-* 2>/dev/null | head -1)
# Case 3: plan id (e.g. "11-02")
elif echo "$TARGET" | grep -qE '^[0-9]+-[0-9]+$'; then
    TARGET_KIND="plan"
    PLAN_PHASE=$(echo "$TARGET" | cut -d- -f1)
    PLAN_DIR=$(ls -d .planning/phases/$(printf "%02d" "$PLAN_PHASE")-* 2>/dev/null | head -1)
    PLAN_FILE=$(ls "$PLAN_DIR"/${TARGET}-*-PLAN.md 2>/dev/null | head -1)
# Case 4: arbitrary path
elif [ -e "$TARGET" ]; then
    TARGET_KIND="artifact"
else
    echo "ERROR: cannot resolve target '$TARGET'" >&2
    exit 1
fi
```

Record the resolved artifact list (absolute paths) in `RESOLVED_ARTIFACTS` — the judge receives these in its `<files_to_read>` block.
</step>

<step name="collect_vision_rubric">
Locate vision documents in priority order. The judge receives this list and MUST cite at least one sentence from it.

```bash
VISION_DOCS=()

# Primary: project PROJECT.md (vision + metric)
[ -f .planning/PROJECT.md ] && VISION_DOCS+=("$(pwd)/.planning/PROJECT.md")

# Milestone goal (from ROADMAP.md — active milestone section)
[ -f .planning/ROADMAP.md ] && VISION_DOCS+=("$(pwd)/.planning/ROADMAP.md")

# PROJECT.md may declare upstream vision docs via frontmatter `vision_refs:`
if [ -f .planning/PROJECT.md ]; then
    python3 - <<'EOF' 2>/dev/null
import re, pathlib, yaml
p = pathlib.Path('.planning/PROJECT.md').read_text()
m = re.match(r'^---\n(.*?)\n---\n', p, re.S)
if m:
    try:
        fm = yaml.safe_load(m.group(1)) or {}
        for ref in (fm.get('vision_refs') or []):
            print(ref)
    except Exception:
        pass
EOF
fi | while read -r ref; do
    # Resolve ref relative to repo root
    [ -f "$ref" ] && VISION_DOCS+=("$(readlink -f "$ref")")
done

# Opportunistic: well-known vision doc paths
for candidate in \
    docs/strategy/VISION.md \
    docs/vision/VISION.md \
    docs/VISION.md \
    VISION.md \
    docs/strategy/ai-automation-vision.md; do
    [ -f "$candidate" ] && VISION_DOCS+=("$(readlink -f "$candidate")")
done
```

If `VISION_DOCS` is empty:
- In `--auto` mode: emit `{"verdict":"escalate","confidence":0.0,"reasoning":"No vision docs found — cannot judge alignment without rubric","red_flags":["missing vision docs"],"vision_citations":[],"followup":"Create .planning/PROJECT.md with a Vision/North-Star section"}` and exit 0.
- Otherwise: print an error telling the user to create PROJECT.md, exit 1.
</step>

<step name="spawn_judge">
Spawn the `gsd-vision-judge` subagent in a fresh context window with Opus model.

The spawn uses the Task tool with these parameters:
- `subagent_type`: `gsd-vision-judge`
- `model`: `opus`
- `description`: `vision-alignment judgment: <TARGET_KIND> <TARGET>`
- `prompt`: a self-contained brief built from:
  - `TARGET_KIND`, `TARGET`, `QUESTION` (if checkpoint)
  - `<files_to_read>` block: `VISION_DOCS` + `RESOLVED_ARTIFACTS` + (if CHECKPOINT_FILE) the checkpoint JSON
  - Explicit instruction: "Your verdict JSON MUST include at least one entry in `vision_citations` quoting a vision doc. If you cannot cite one, your verdict defaults to `escalate`."
  - Explicit instruction: "Do NOT read `.planning/STATE.md` or velocity metrics — those encourage completion-bias."
  - Explicit instruction: "You MAY Grep/Glob/Read the codebase and run `rag_cli.py query` if available, capped at ~10K tokens of research."
  - Required output: JSON matching the schema in `<json_output_schema>` of the skill file.

Wait for the agent result. Extract the JSON from the agent's final message (the agent returns JSON as its final output, possibly preceded by tool calls).
</step>

<step name="parse_verdict">
Parse the JSON the judge returned.

```bash
# VERDICT_RAW is the last JSON block in the agent's message
DECISION=$(echo "$VERDICT_RAW" | jq -r '.verdict')
CONFIDENCE=$(echo "$VERDICT_RAW" | jq -r '.confidence')
REASONING=$(echo "$VERDICT_RAW" | jq -r '.reasoning')
CITATIONS=$(echo "$VERDICT_RAW" | jq -r '.vision_citations | length')
RED_FLAGS=$(echo "$VERDICT_RAW" | jq -r '.red_flags // []')
FOLLOWUP=$(echo "$VERDICT_RAW" | jq -r '.followup // null')
```

Validation:
- If `.verdict` is not in {approve, reject, escalate} → force `escalate` with red_flag "malformed verdict"
- If `CITATIONS < 1` → force `escalate` with red_flag "no vision citations" (per golden rule in skill)
- If `CONFIDENCE` is null or outside [0, 1] → force `escalate`

Write the validated JSON to `/tmp/gsd-verdict-$$.json` for downstream consumers.
</step>

<step name="apply_decision_policy">
Per `<decision_policy>` in the skill file. This workflow does NOT itself execute followups — it returns the verdict to the caller, which applies the policy:

| Verdict | Confidence | Caller action |
|---------|-----------|---------------|
| `approve` | ≥ 0.80 | Continue autonomously |
| `approve` | 0.60–0.80 | Continue, flag for post-hoc review |
| `approve` | < 0.60 | Escalate (judge signals own uncertainty) |
| `reject` | any | Execute `followup` |
| `escalate` | any | Wake user |

The callers (build-all, fork-syncer, user) read the JSON verdict and act on it. This workflow's job is to produce a trustworthy JSON verdict, not to carry out the consequences.
</step>

<step name="audit_log">
Append a JSONL entry to `.planning/vision-decisions.jsonl` — the learning substrate.

```bash
AUDIT_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Compose entry (include caller context, target, verdict, outcome fields to be filled by nightly Dream hook)
python3 - "$AUDIT_ID" "$TS" "$TARGET_KIND" "$TARGET" <<PYEOF >> .planning/vision-decisions.jsonl
import json, sys
audit_id, ts, kind, target = sys.argv[1:5]
verdict = json.loads(open('/tmp/gsd-verdict-$$.json').read())
entry = {
    "audit_entry_id": audit_id,
    "ts": ts,
    "target_kind": kind,
    "target": target,
    "verdict": verdict.get("verdict"),
    "confidence": verdict.get("confidence"),
    "reasoning": verdict.get("reasoning"),
    "vision_citations": verdict.get("vision_citations", []),
    "red_flags": verdict.get("red_flags", []),
    "followup": verdict.get("followup"),
    "outcome_verified_at": None,
    "outcome_correct": None,
}
print(json.dumps(entry))
PYEOF
```

Ensure `.planning/` exists in the current working directory; if not (user pointed vision-check at an artifact outside a GSD project), fall back to `$HOME/.claude/vision-decisions.jsonl`.
</step>

<step name="format_output">
**If `AUTO_MODE=1`:**

Print the verdict JSON as the single line of stdout. Nothing else. Callers parse it with `jq`.

```json
{"target":"phase-11","verdict":"approve","confidence":0.82,"reasoning":"...","vision_citations":["PROJECT.md: '...'"],"red_flags":[],"followup":null,"audit_entry_id":"<uuid>"}
```

**If interactive (no `--auto`):**

Human-readable report:

```
╭─ Vision Check ─────────────────────────────────────────╮
│ Target: {TARGET_KIND} {TARGET}                         │
│ Verdict: {DECISION} (confidence {CONFIDENCE})          │
╰────────────────────────────────────────────────────────╯

Reasoning:
  {REASONING}

Vision citations:
  • {citation 1}
  • {citation 2}

Red flags:
  • {flag 1}

Followup (if rejected):
  {FOLLOWUP}

Audit: .planning/vision-decisions.jsonl#{AUDIT_ID}
```
</step>

</process>

<success_criteria>
- [ ] `$ARGUMENTS` parsed: target resolved OR checkpoint file loaded
- [ ] Vision docs located (at least PROJECT.md) — empty list auto-escalates in --auto mode
- [ ] `gsd-vision-judge` subagent spawned with Opus model, fresh context, explicit `<files_to_read>` brief
- [ ] Judge's JSON validated: verdict in {approve, reject, escalate}, confidence in [0, 1], ≥1 vision citation
- [ ] Entry appended to `.planning/vision-decisions.jsonl` with uuid audit_entry_id
- [ ] Output format matches invocation mode (JSON for --auto, readable report otherwise)
- [ ] Workflow does NOT execute followups — returns verdict for caller to apply
- [ ] Workflow never reads STATE.md / velocity metrics (completion-bias avoidance)
</success_criteria>
