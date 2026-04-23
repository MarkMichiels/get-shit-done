# Fork Sync Report — get-shit-done — 2026-04-23

**Fork:** `/home/mark/Repositories/get-shit-done`
**Upstream branch:** `upstream/main`
**Run mode:** normal
**Max commits:** 100 (pilot cap)
**Tmp branch:** `upstream-sync-2026-04-23`
**Backup branch:** `backup-before-upstream-20260423`

---

## Summary

**Result:** NEEDS REVIEW

| Metric | Value |
|--------|-------|
| Commits in scope | 100 (of 627 behind) |
| Clusters | 12 |
| Clusters approved | 2 (runtime-support, workstreams) |
| Clusters rejected | 6 (roadmap-phase, features, verifier, tests, security, version-bump) |
| Clusters escalated | 4 (other, bugfix, skills-hooks, docs) |
| Commits cherry-picked | 6 |
| Commits skipped (empty merge commits) | 3 |
| Commits conflict-aborted | 1 (b12d6849 opencode — depends on rejected SDK cluster) |
| Merge conflicts (triviaal auto-resolved) | 0 |
| Merge conflicts (escalated) | 1 (opencode install.js — module-export collision with unmerged SDK features) |
| Tests | ❌ 5 failing (but pre-existing — main had 6 failing; tmp branch net-improvement −1) |
| Push | stayed on tmp branch `upstream-sync-2026-04-23` |

**Report generated:** 2026-04-23
**Blocker summary:** 4 clusters escalated + 1 conflict-abort + test suite pre-existing-red. Fork requires manual reconciliation before pushing to origin/main.

---

## Preflight

- Repo: `/home/mark/Repositories/get-shit-done` ✅
- Working tree: only `.fork-sync-2026-04-23.log` (0-byte orchestrator artifact, treated as owned by `check_forks.sh`) — clean enough to proceed
- Default branch: `main` ✅
- Remotes: `origin` (MarkMichiels/get-shit-done) + `upstream` (glittercowboy/get-shit-done) ✅
- `git fetch upstream` → successful
- Behind count: **627 commits** (5 more than the 622 snapshot in FORK-VS-UPSTREAM.md)
- Backup branch created: `backup-before-upstream-20260423`
- Tmp branch created: `upstream-sync-2026-04-23`

---

## Cluster Plan

12 clusters from the first 100 chronological upstream commits (2026-03-25 → 2026-04-01):

| Cluster | Count | First 3 subjects |
|---------|------:|------------------|
| other | 23 | 1.30.0 / CodeRabbit review integration / feat: add /gsd:docs-update command |
| bugfix | 13 | fix(slug): add --raw flag / fix: enforce plan file naming / fix: resolve gsd-tools.cjs |
| roadmap-phase | 12 | feat: project_code config / fix(branching): decimal phase regex / fix(next): remove complete-phase ref |
| features | 11 | feat: GSD SDK headless CLI (#1408) / feat: --sdk flag in installer / feat: auto --init flag |
| skills-hooks | 9 | feat: Headless prompt overhaul / fix(hooks): shared cache dir / manager: Skill pipeline delegate |
| verifier | 8 | fix(verifier): human_needed status / fix(verifier): load ROADMAP SCs / fix(sdk): skip advance on gaps |
| runtime-support | 6 | fix(windsurf): trailing slash / fix(install): Codex .claude path / merge #1436 |
| docs | 5 | docs: v1.30.0 README+changelog / docs(workflows): CodeRabbit / docs: CodeRabbit in cross-AI options |
| tests | 5 | test: secure-phase validation suite (42 tests) / test(hooks): shared cache / test(config): roundtrip |
| workstreams | 4 | fix: remove duplicate workstreams.md / feat: GSD_PROJECT env var / fix: workstream set name arg |
| security | 3 | feat: security-first enforcement / fix: adversarial review tag+gate / merge #1380 |
| version-bump | 1 | chore: bump 1.31.0 |

Overlap with FORK-VS-UPSTREAM.md §2a substantieel files:
- `get-shit-done/workflows/execute-phase.md` — touched by 4 clusters (other, bugfix, features, verifier, security)
- `agents/gsd-verifier.md` — touched by verifier
- `agents/gsd-executor.md` — touched by runtime-support (frontmatter line only), security
- `.gitignore` — touched by features

---

## Cluster Verdicts

### runtime-support → APPROVE (confidence 0.90) ✅

Six commits touching Windsurf / Codex / Gemini / Opencode runtime paths. §5 explicitly greenlights "installer hardening" and the README markets multi-runtime support. The one touch of `agents/gsd-executor.md` (9ddf0043) removes a single frontmatter line (`permissionMode: acceptEdits`) at line 5 — nowhere near the fork's AxaBio MERGE-NOTE-protected block.

Citation: FORK-VS-UPSTREAM.md §5 "Cherry-pick upstream clusters that are net-positive and low-conflict: security hardening, performance, Windows fixes, installer hardening".

Result: **3 commits picked clean** (windsurf trailing slash, codex .claude path, Gemini permissionMode fix), **2 merge commits skipped as empty** (#1436 merge, #1545 merge), **1 commit aborted** (#781 opencode — module-export conflict, see Merge Conflicts below).

### workstreams → APPROVE (confidence 0.82) ✅

Four commits. §5-approved "bugfix" category with one triviaal overlap (`commands/gsd/workstreams.md` §2c Low severity). GSD_PROJECT env-var conceptually aligns with fork's cross-project `/gsd:create-issue` ping-pong.

Citation: FORK-VS-UPSTREAM.md §4 "workstreams.md | +1 | +18/-12 | Low".

Result: **3 commits picked clean** (remove duplicate workstreams.md, add GSD_PROJECT env var, require name arg for set), **1 merge commit skipped as empty** (#1543).

Followup: re-apply `user-invocable: true` on `commands/gsd/workstreams.md` if §2c open question settles on keeping the convention.

### roadmap-phase → REJECT (confidence 0.78) ❌

Mixes safe bugfixes (decimal-phase regex, dangling /gsd:complete-phase reference) with two fork-hostile features: `--full` semantics redefinition (fork README documents different meaning) and `project_code` config that restructures `.planning/phases/` paths fork's `gsd-update-docs.js` hook depends on. Core-lib churn on `core.cjs`/`phase.cjs`/`commands.cjs` is the §3-cluster-#3 risk zone.

Citations: FORK-VS-UPSTREAM.md §3 cluster #3 warns refactors "overlap heavily with fork's 57 frontmatter-touched commands"; README documents `/gsd:quick --full` semantics upstream would invalidate.

Followup: cherry-pick bugfixes individually later; skip feature refactors pending explicit fork-side decision.

### features → REJECT (confidence 0.86) ❌

GSD SDK + 10 heterogeneous feats touching 126 files including §4 rank #1 `execute-phase.md` and `sdk/prompts/agents/gsd-executor.md` (mirrors fork's MERGE-NOTE-protected executor). §5 explicitly says skip this territory.

Followup: decompose into SDK / Kilo runtime / researcher provenance / worktree-discuss sub-clusters before re-judging.

### skills-hooks → ESCALATE (confidence 0.78) ⚠️

Architectural re-platform masquerading as a cluster merge. Skills migration (Claude Code 2.1.88+) is a **survival requirement** — without it the fork breaks on newer Claude Code — but the installer-cleanup step would erase fork-exclusive commands (`build-all`, `build-phase`, `vision-check`, `create-issue`, `publish-version`) unless manually ported to `skills/gsd-*/SKILL.md` format. Headless-prompt-overhaul creates `sdk/prompts/agents/gsd-executor.md` as a parallel copy of the fork's MERGE-NOTE-protected executor.

### verifier → REJECT (confidence 0.92) ❌

Exact scenario §5 names non-mergeable. 6 of 8 commits modify verifier behavior on **both** §2a substantieel files (`agents/gsd-verifier.md` + `get-shit-done/workflows/execute-phase.md`). Cherry-picking would overwrite the fork's signature adversarial-verifier philosophy (default-assume-failure, 5-dimension quality rubrics).

Followup: schema-drift detection commit (7f11543) might be extractable as a separate micro-cluster touching only `bin/lib/schema-detect.cjs` + test file.

### other → ESCALATE (confidence 0.55) ⚠️

Heterogeneous 23-commit catch-all spanning bug fixes, 3 commits totaling ~122 lines on execute-phase.md, net-new features (docs-update +2559 lines, CodeRabbit integration, --full refactor, workstreams.md delete), and a version bump. Needs splitting into 3+ sub-clusters before a grounded verdict is possible.

### bugfix → ESCALATE (confidence 0.72) ⚠️

§5 endorses bugfixes but cluster touches execute-phase.md (§4 rank #1 Critical). Mixed safe/risky — one commit's execute-phase.md diff must be inspected against fork's adversarial-verifier plumbing region before the safe 12 can be approved in isolation.

### docs → ESCALATE (confidence 0.72) ⚠️

§3 cluster #8 warns "will conflict with any fork-side README patch" — the fork's lines 1–12 preamble is the exact region v1.30/v1.31 release commits touch. CodeRabbit additions to `workflows/review.md` are a behavioral change, not docs drift. Needs per-commit splitting.

### tests → REJECT (confidence 0.86) ❌

Tests assert on `gsd-security-auditor` agent, `commands/gsd/secure-phase.md`, `USE_WORKTREES` wiring, `workflow.subagent_timeout` / `context_window` config keys — **all features the fork lacks**. Cherry-picking would turn the (mostly-green) test suite red.

### security → REJECT (confidence 0.78) ❌

§5 greenlights security hardening but this specific cluster edits **both** §2a substantieel files (`agents/gsd-executor.md` MERGE-NOTE region + `execute-phase.md` §4 rank #1 Critical). Safe new-file additions (gsd-security-auditor.md, secure-phase command/workflow, SECURITY/VALIDATION templates) are bundled with dangerous overlap edits.

Followup: split into (a) safe new-file additions → approve; (b) substantieel-overlap edits → hand-reconcile.

### version-bump → REJECT (confidence 0.78) ❌

§5 approve-list omits version bumps. Adopting 1.31.0 while 627 commits behind misrepresents fork state. Fork owns release cadence via `/gsd:publish-version`.

---

## Cherry-Pick Log

Landed on `upstream-sync-2026-04-23` branch (in pick order):

| # | SHA | Subject | Cluster | Result |
|---|-----|---------|---------|--------|
| 1 | `0e034d4f` | fix(windsurf): remove trailing slash from .windsurf/rules path | runtime-support | picked |
| 2 | `355b5756` | fix(install): add .claude path replacement for Codex runtime | runtime-support | picked |
| 3 | — | Merge pull request #1436 | runtime-support | skipped (empty) |
| 4 | `fe6ef05d` | fix(agents): remove permissionMode that breaks Gemini CLI agent loading (#1522) | runtime-support | picked |
| 5 | — | Merge pull request #1545 | runtime-support | skipped (empty) |
| 6 | `b12d6849` | fix(opencode): guard string-valued permission config (#781) | runtime-support | **CONFLICT → aborted** |
| 7 | `92d80b21` | fix(commands): remove duplicate workstreams.md from plugin directory | workstreams | picked |
| 8 | `516a86aa` | feat: add GSD_PROJECT env var for multi-project workspace support | workstreams | picked |
| 9 | `793df2f9` | fix(workstream): require name arg for set, add --clear flag (#1527) | workstreams | picked |
| 10 | — | Merge pull request #1543 | workstreams | skipped (empty) |

**6 commits committed on tmp branch.**

---

## Merge Conflicts

### ESCALATED: b12d6849 (fix(opencode): guard string-valued permission config)

**File:** `bin/install.js` (classification: unclassified — not in §2a/§2c)

**Nature:** Module-export block adds `installSdk`, `promptSdk`, `configureOpencodePermissions` — functions that do not exist in the fork because they are introduced by the rejected `features` cluster (GSD SDK). Applying upstream-wins would export undefined symbols → runtime error on install.

**Rule applied:** cherry-pick aborted (`git cherry-pick --abort`). Upstream-wins default is unsafe here because the fix depends on sibling commits we deliberately rejected.

**To re-evaluate:** either (a) also cherry-pick the SDK / opencode-permissions feature commits that introduce those functions (requires reconciling with the rejected `features` cluster), or (b) port just the opencode permission guard logic manually to the fork's `bin/install.js` without the module-exports block.

---

## Tests

Command: `npm test` (node scripts/run-tests.cjs)
Duration: ~9.3 s
Exit code: 1

**Tmp branch result:** 5 failures of 1513 tests.
**Main branch baseline:** 6 failures of 1511 tests (pre-existing).
**Net effect of cherry-picks:** −1 failure (the Gemini CLI `permissionMode` fix resolved one pre-existing test).

Failing tests (all pre-existing on main, NOT introduced by this sync):

| # | Test | Notes |
|---|------|-------|
| 1 | HDOC: anti-heredoc instruction (agent-frontmatter) | Pre-existing fork divergence |
| 3 | HOOK: hooks frontmatter pattern (agent-frontmatter) | Pre-existing — related to fork-exclusive hooks |
| 75 | E2E: Copilot full install verification | Pre-existing |
| 158 | installed .md files contain no resolved absolute paths | Pre-existing |
| 180 | codebase prompt injection scan | Pre-existing — fork's adversarial-verifier may trip scanner |

Tests are NOT a push-path blocker for this run (no regression), but they are a separate fork-side issue Mark should address.

---

## Push Decision

**Result: FAIL PATH — stayed on tmp branch `upstream-sync-2026-04-23`.**

`main` untouched. No push to `origin/main`.

**Blockers:**
1. 4 ESCALATION entries (other, bugfix, skills-hooks, docs)
2. 1 cherry-pick aborted due to dependency on rejected cluster (b12d6849 opencode)
3. Pre-existing test failures (not regressed, but unresolved)

The 6 landed cherry-picks are valid on the tmp branch — Mark can merge them manually after reviewing the escalations.

---

## Review Instructions

Mark, when you review this run, the tmp branch already carries 6 clean cherry-picks (3 runtime-support + 3 workstreams). To accept just those without touching the rest:

```bash
cd /home/mark/Repositories/get-shit-done
git checkout main
git merge --ff-only upstream-sync-2026-04-23  # 6 commits forward-only
git push origin main
```

### ESCALATION: skills-hooks (highest priority — survival issue)

**Reason:** Claude Code 2.1.88+ deprecated `commands/` discovery in favor of `skills/*/SKILL.md`. The fork's `commands/gsd/build-all.md`, `build-phase.md`, `create-issue.md`, `publish-version.md`, `vision-check.md` will stop loading once you (or anyone using the fork) upgrades Claude Code past that line.

**Judge verdict:** escalate (0.78) — "Architectural re-platform, not cherry-pick".

**To inspect:**
```bash
cd /home/mark/Repositories/get-shit-done
git show 01fda70a  # skills migration commit
git show eeb692dd  # manager workflow Skill-pipeline delegate
git show 38c18ac6  # headless prompt overhaul (introduces sdk/prompts/)
```

**Decision needed:**
- **(a)** Dedicated "skills-replatform" milestone that ports the 5 fork-exclusive commands to `skills/gsd-*/SKILL.md`, abandons `user-invocable: true` frontmatter (open §5 question), and reconciles fork's `agents/gsd-executor.md` MERGE NOTE against the new `sdk/prompts/agents/gsd-executor.md` location.
- **(b)** Declare the fork pinned to pre-2.1.88 Claude Code in README and defer.

**Recommended:** (a). The fork is already drifting into variant status; skills-replatform is the natural next milestone.

### ESCALATION: bugfix (second priority — low-hanging fruit)

**Reason:** 13 commits, 12 likely safe per §5 approve-list, 1+ touches execute-phase.md.

**Judge verdict:** escalate (0.72) — "Split cluster".

**To identify the risky SHA(s):**
```bash
cd /home/mark/Repositories/get-shit-done
for sha in $(python3 -c "import json; print('\n'.join(x['sha'] for x in [c for c in json.load(open('/tmp/gsd-fork-syncer-clusters.json')) if c['label']=='bugfix'][0]['commits']))"); do
    if git show --name-only --pretty= "$sha" | grep -q 'execute-phase.md'; then
        echo "RISKY: $sha $(git log -1 --format='%s' $sha)"
    fi
done
```

**Followup:** batch-apply the 12 safe commits in a single re-run with `max_commits=12` and an explicit exclude-list of the execute-phase.md touchers; hand-inspect the risky one(s) separately.

### ESCALATION: docs (third priority)

**Reason:** README v1.30/v1.31 release commits will collide with fork's preamble (lines 1-12). CodeRabbit additions to `workflows/review.md` are a separate user-facing decision.

**Followup:**
- Approve CHANGELOG.md + multilingual READMEs (no fork conflict)
- Manually port v1.30 + v1.31 release notes into the fork's README preserving fork preamble
- Defer CodeRabbit adoption decision separately

### ESCALATION: other (lowest priority — needs split first)

**Reason:** 23-commit grab-bag mixing bugfixes, 3 execute-phase.md touches, and net-new features (docs-update +2559 lines, workstreams.md delete, CodeRabbit, --full refactor).

**Followup:** regex-split into sub-clusters before re-running vision-check. The docs-update (+2559 lines) and workstreams.md-delete each need individual decisions — they are not bugfixes.

### CONFLICT: b12d6849 (opencode module exports)

**To apply manually:**
```bash
cd /home/mark/Repositories/get-shit-done
git checkout upstream-sync-2026-04-23
# Option A: take just the permission-guard logic, skip the exports block
git show b12d6849 -- bin/install.js | less
# Option B: pull in the opencode-SDK-permissions feature commits that introduce
# installSdk/promptSdk/configureOpencodePermissions (requires reconciling with
# the rejected `features` cluster).
```

### Skipped clusters (reject) — no action needed unless you disagree

- **roadmap-phase** (0.78): core.cjs/phase.cjs churn overlaps fork's 57 frontmatter commands; `--full` semantic redefinition collides with README.
- **features** (0.86): bundles SDK + 10 heterogeneous feats; execute-phase.md + sdk/prompts/agents/gsd-executor.md overlaps.
- **verifier** (0.92): would overwrite the fork's signature adversarial-verifier rewrite.
- **tests** (0.86): asserts on features the fork lacks; would turn suite red.
- **security** (0.78): mixes safe new-file additions with substantieel-overlap edits.
- **version-bump** (0.78): adopting 1.31.0 while 627 behind misrepresents fork state.

Each is re-evaluable by re-submitting as a finer-grained cluster. The rejects are NOT permanent — they are "not in this form, not in this bundle".

### Rerun suggestion

Next Sunday's run will re-consider the same 100-commit window plus any new upstream commits. If you'd like to act on the runtime-support + workstreams picks first and then widen the pilot cap, run:

```bash
cd /home/mark/Repositories/get-shit-done
git merge --ff-only upstream-sync-2026-04-23 main
git push origin main
# Then next run can widen max_commits to pick up more of the 627-commit gap
```

---

## Audit Trail

```jsonl
{"cluster_label":"other","verdict":"escalate","confidence":0.55,"reasoning":"Heterogeneous catch-all of 23 commits spanning bug fixes, execute-phase.md touches (3 commits, ~122 lines on §2a substantieel), net-new features (docs-update +2559 lines), and version bump. Needs split before judgment.","followup":"Split into: (1) execute-phase.md touches, (2) pure bugfixes, (3) net-new features."}
{"cluster_label":"bugfix","verdict":"escalate","confidence":0.72,"reasoning":"§5 endorses bugfixes, but cluster touches execute-phase.md (§4 rank #1 Critical). Mixed safe/risky — needs split.","followup":"Identify SHAs touching execute-phase.md, batch the other 12 for approval."}
{"cluster_label":"roadmap-phase","verdict":"reject","confidence":0.78,"reasoning":"Mixes safe bugfixes with fork-hostile features: --full semantics redefinition conflicts with fork README, project_code restructures .planning/ paths that fork hooks depend on.","followup":"Cherry-pick bugfixes individually; skip feature refactors."}
{"cluster_label":"features","verdict":"reject","confidence":0.86,"reasoning":"Bundles GSD SDK with 10 other heterogeneous feats touching 126 files including §4 rank #1 execute-phase.md and sdk/prompts/agents/gsd-executor.md (mirrors fork's MERGE-NOTE-protected executor). §5 explicitly says skip.","followup":"Decompose into SDK, Kilo runtime, researcher provenance, worktree/discuss subclusters."}
{"cluster_label":"skills-hooks","verdict":"escalate","confidence":0.78,"reasoning":"Skills migration (Claude Code 2.1.88+) is survival requirement but would erase fork-exclusive commands (build-all, vision-check, etc.) unless manually ported to SKILL.md. Architectural re-platform, not cherry-pick.","followup":"Mark must decide: re-platform to skills format OR pin fork to pre-2.1.88."}
{"cluster_label":"verifier","verdict":"reject","confidence":0.92,"reasoning":"Exact scenario §5 names non-mergeable. 6 of 8 commits modify verifier behavior on BOTH §2a substantieel files. Cherry-picking would overwrite fork's adversarial verifier — the fork's signature divergence.","followup":"Skip. Only schema-drift detection SHA might be extractable as separate micro-cluster."}
{"cluster_label":"runtime-support","verdict":"approve","confidence":0.90,"reasoning":"§5 explicitly greenlights installer hardening + Windows fixes. The one gsd-executor.md touch removes a frontmatter line nowhere near fork's AxaBio block. Low-collision, high-value for multi-runtime positioning.","followup":null}
{"cluster_label":"docs","verdict":"escalate","confidence":0.72,"reasoning":"§3 cluster #8 warns docs will conflict with fork-side README patch (lines 1-12 fork preamble). CodeRabbit additions are behavioral, not docs drift. Needs per-commit splitting.","followup":"Split: approve CHANGELOG+multilingual READMEs; skip README.md header commits; defer CodeRabbit decisions."}
{"cluster_label":"tests","verdict":"reject","confidence":0.86,"reasoning":"Tests assert on gsd-security-auditor agent, secure-phase command, USE_WORKTREES/subagent_timeout config — all features the fork lacks. Cherry-picking would turn green test suite red.","followup":"Skip entire cluster; only e0b953d9 hooks cache test is potentially extractable."}
{"cluster_label":"workstreams","verdict":"approve","confidence":0.82,"reasoning":"Pure §5-approved cluster: cleanup, multi-project env-var, CLI bugfix. Only overlap workstreams.md is §2c triviaal/Low severity. GSD_PROJECT conceptually aligns with fork's cross-project ping-pong ambitions.","followup":null}
{"cluster_label":"security","verdict":"reject","confidence":0.78,"reasoning":"§5 greenlights security hardening but this specific cluster edits BOTH §2a substantieel files (gsd-executor MERGE-NOTE region + execute-phase.md §4 rank #1 Critical). Safe new-file additions bundled with dangerous overlap edits.","followup":"Split: approve new-file additions (security-auditor, secure-phase cmd/workflow, SECURITY/VALIDATION templates); hand-reconcile executor + execute-phase edits separately."}
{"cluster_label":"version-bump","verdict":"reject","confidence":0.78,"reasoning":"§5 approve-list omits version bumps. Adopting 1.31.0 while 602 commits behind misrepresents fork state. Fork owns release via /gsd:publish-version.","followup":"Skip; let fork's /gsd:publish-version workflow pick next version."}
```

---

## Machine-Readable Result

```json
{
  "fork_name": "get-shit-done",
  "result": "needs_review",
  "picked": 6,
  "skipped": 3,
  "conflict_aborted": 1,
  "escalated_clusters": 4,
  "rejected_clusters": 6,
  "approved_clusters": 2,
  "pushed": false,
  "report": "/home/mark/Repositories/get-shit-done/SYNC-REPORT-2026-04-23.md",
  "tmp_branch": "upstream-sync-2026-04-23",
  "backup_branch": "backup-before-upstream-20260423"
}
```
