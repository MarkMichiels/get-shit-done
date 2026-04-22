# Fork vs Upstream — MarkMichiels/get-shit-done

**Upstream:** [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done)
**Fork point:** `604a78b3` — "1.29.0" release commit (2026-03-25 upstream tag — first divergence in fork history predates this; the shared ancestor git finds is the v1.29.0 release)
**Divergence (2026-04-22):** 59 commits ahead · 602 commits behind · 12 files added · 62 files modified · 0 deleted

This document classifies every difference between the fork and upstream so a merge can be planned deliberately rather than blindly.

---

## 1. Fork-Exclusive Additions (12 files)

Pure fork work. Zero conflict-risk on merge. Several are plausible upstream-PR candidates; others are AxaBio-specific workflow glue.

| # | File | First appeared | Commit | Purpose |
|---|------|----------------|--------|---------|
| 1 | `AUTO_INSTALL_HOOK.md` | 2026-01-14 | `cdad4d8a` | Docs for the post-commit auto-install hook |
| 2 | `commands/gsd/build-all.md` | 2026-01-13 | `c3d1ca1b` | Autonomous build-all: plan → execute each phase sequentially, then daemon loop for issue resolution + repo improvement |
| 3 | `commands/gsd/build-phase.md` | 2026-01-13 | `c3d1ca1b` | Plan and execute a phase in one command |
| 4 | `commands/gsd/create-issue.md` | 2026-01-12 | `62d26472` | Create issues in `ISSUES.md`; includes cross-project ping-pong protocol |
| 5 | `commands/gsd/publish-version.md` | 2026-01-15 | `5e61f022` | Automate version releases with changelog generation |
| 6 | `commands/gsd/vision-check.md` | 2026-04-22 | `64aba9c5` | Fresh-context judge agent that tests artifacts against `PROJECT.md` vision, not local completion criteria |
| 7 | `.cursor/commands/gsd` → `commands/gsd` | 2026-01-16 | `8fec73ae` | Symlink that gives Cursor access to the same command set as Claude Code |
| 8 | `get-shit-done/references/external-tools.md` | 2026-01-13 | `73757a3f` | Exa/neural-search integration reference for research phases |
| 9 | `get-shit-done/workflows/publish-version.md` | 2026-01-15 | `72bc8c74` | Workflow body backing `/gsd:publish-version` |
| 10 | `hooks/gsd-auto-verify.js` | 2026-01-27 | `f4dedf58` | PostToolUse hook that auto-runs tests after Edit/Write on code files |
| 11 | `hooks/gsd-update-docs.js` | 2026-01-27 | `f4dedf58` | Stop hook that regenerates `FEATURES.md` / `COVERAGE.md` after Claude finishes |
| 12 | `hooks/post-commit` | 2026-01-16 | `8fec73ae` | Auto-installs GSD globally on commits that touch GSD files |

**Upstream-PR candidates:** `build-all`, `build-phase`, `vision-check`, `create-issue`, `external-tools.md`. These are generalisable features that match upstream's design language.
**Fork-specific, not PR material:** `AUTO_INSTALL_HOOK.md`, `hooks/post-commit`, `.cursor/commands/gsd` (developer-ergonomics glue for Mark's dev loop), `gsd-update-docs.js` (regenerates AxaBio-specific `FEATURES.md` / `COVERAGE.md`).

---

## 2. Modified Upstream Files (62 files) — 3-way classification

Method: for each M-file, compare `common-ancestor..HEAD` (fork side) against `common-ancestor..upstream/main` (upstream side). Common ancestor = `604a78b3`.

### 2a. Substantieel (5 files — logic-bearing, real merge work)

Fork has diverged in ways that will require manual reconciliation. Upstream has also touched most of these files, so both edits must be reconciled.

| File | Fork diff | Upstream diff | Summary of fork changes |
|------|-----------|---------------|--------------------------|
| `agents/gsd-executor.md` | +177 | +133/-39 | Adds an entire "AxaBio Traceability & Documentation Sync" section between `</state_updates>` and `<final_commit>`. Generates `.planning/FEATURES.md` + `.planning/COVERAGE.md` from requirements YAML after each plan. The section contains an explicit MERGE NOTE instructing future merges to preserve it. |
| `agents/gsd-verifier.md` | +289/-16 | +171/-41 | Rewrites the verifier from "auditor" into **adversarial red-team evaluator**. Adds 5-dimension quality rubrics (completeness / correctness / integration / edge_cases / code_quality, 1-10 scored, overall = minimum of the 5). Changes `tools: Read, Write, Bash, Grep, Glob` → adds `Edit`. Flips role from "verify success" to "default-assume failure, find evidence to change your mind". |
| `get-shit-done/workflows/execute-phase.md` | +23/-8 | +846/-70 | Rewires the verifier invocation: changes the Task() prompt to explicitly adversarial mode, adds quality-score parsing (`grep "overall:"`), and surfaces quality scores in the human-UAT output block. Upstream has done an 846-line overhaul on the same file — **this is the highest-risk merge file.** |
| `get-shit-done/references/git-integration.md` | +14/-2 | +5/-5 | Extends the git detection block to recognise nested repos (parent-repo case). Sets a new code path `PARENT_GIT_EXISTS` so GSD commits go to the parent repo when running inside one. |
| `.gitignore` | +5 | +29 | Fork adds `.planning/`, `.history/` (Cursor/VS Code), and `/research.history/`. Upstream has added 29 unrelated entries. Mechanical merge likely. |

### 2b. Redundant (0 files)

None. Upstream has **not** adopted a `user-invocable:` frontmatter key or any equivalent, so the fork's 57 single-line additions cannot be dropped as "upstream has it already".

### 2c. Triviaal (57 files — mechanical `user-invocable: true` frontmatter insertion)

Every one of these files has a **single-line fork change** inserting `user-invocable: true` into the YAML frontmatter. The intent is to mark which commands appear in interactive pickers vs are only callable by other commands.

**High-risk triviaal** (file rewritten upstream — merge will drop into a very different file structure):

| File | Upstream churn |
|------|----------------|
| `commands/gsd/debug.md` | +180/-90 |
| `commands/gsd/reapply-patches.md` | +250/-42 |
| `commands/gsd/thread.md` | +143/-43 |
| `commands/gsd/quick.md` | +129/-3 |
| `commands/gsd/workstreams.md` | +18/-12 |
| `commands/gsd/add-backlog.md` | +17/-14 |

**Low-risk triviaal** (minor or no upstream churn) — the remaining 51 files:

`add-phase.md`, `add-tests.md`, `add-todo.md`, `audit-milestone.md`, `audit-uat.md`, `autonomous.md`, `check-todos.md`, `cleanup.md`, `complete-milestone.md`, `discuss-phase.md`, `do.md`, `execute-phase.md`, `fast.md`, `forensics.md`, `health.md`, `help.md`, `insert-phase.md`, `join-discord.md`, `list-phase-assumptions.md`, `list-workspaces.md`, `manager.md`, `map-codebase.md`, `milestone-summary.md`, `new-milestone.md`, `new-project.md`, `new-workspace.md`, `next.md`, `note.md`, `pause-work.md`, `plan-milestone-gaps.md`, `plan-phase.md`, `plant-seed.md`, `pr-branch.md`, `profile-user.md`, `progress.md`, `remove-phase.md`, `remove-workspace.md`, `research-phase.md`, `resume-work.md`, `review-backlog.md`, `review.md`, `session-report.md`, `set-profile.md`, `settings.md`, `ship.md`, `stats.md`, `ui-phase.md`, `ui-review.md`, `update.md`, `validate-phase.md`, `verify-work.md`.

Whether `user-invocable: true` is still the right marker post-merge depends on whether upstream has introduced an alternative convention (none detected as of 2026-04-22). **Open question for Mark:** does anything downstream actually read `user-invocable`, or is it dead metadata?

---

## 3. Upstream Commits Missing from Fork (602 commits)

Clustered by commit-message prefix and subject pattern. Counts overlap (a single commit may belong to several themes).

| # | Cluster | ~Count | Impact if merged |
|---|---------|-------:|------------------|
| 1 | Bug fixes (`fix:` prefix) | 257 | The bulk of the 602 — cross-cutting reliability work |
| 2 | Features (`feat:` prefix) | 129 | New capabilities across all surfaces |
| 3 | Milestone/roadmap/phase/requirement refactors | 101 | Changes to the core planning loop; overlaps heavily with fork's 57 frontmatter-touched commands |
| 4 | Skills + hooks infrastructure | 66 | Skills-first plumbing (Codex/Antigravity), hook registration, lifecycle |
| 5 | Installer hardening (`fix(installer)`, `feat(installer)`) | 62 | Multi-runtime install flow, SDK install flags, drift guards |
| 6 | Multi-runtime runtime support (OpenCode/Codex/Gemini/Copilot/Cursor/Windsurf/Antigravity) | 53 | New runtimes added to `npx get-shit-done-cc`; fork's `.cursor` symlink predates this |
| 7 | Version bumps & release automation (1.29 → 1.38.2 / 1.39-rc) | 53 | **5+ releases missed**: v1.30, v1.34, v1.36, v1.37.x, v1.38.x |
| 8 | Docs (`docs:` prefix) | 52 | README, CHANGELOG, ARCHITECTURE — will conflict with any fork-side README patch |
| 9 | GSD SDK + registry (`gsd-sdk`, `init.*` handlers, registry drift guards) | 44 | Major new module: canonical artifact registry, schema-driven config, SDK query call-sites |
| 10 | Test suite / coverage expansion (`test:` prefix, coverage) | 44 | Injection scanner, filesystem-backed parity tests, structural tests for new commands |
| 11 | Plan / discuss / research flow improvements | 34 | Ultraplan, discussion modes, researcher refinements |
| 12 | Ship / PR / review flow | 29 | PR-branch improvements, ship-time read-injection scanner |
| 13 | UAT / verifier improvements | 22 | Upstream evolved their verifier too — directly conflicts with fork's adversarial rewrite of `gsd-verifier.md` |
| 14 | New commands: `/gsd-ingest-docs`, pattern-mapper, spike/sketch, ultraplan, prompt-thinning, learnings extract | 21 | Net-new surfaces absent from fork |
| 15 | Workstreams / workspaces | 16 | Workstream command rewritten upstream (+18/-12) |
| 16 | Security: prompt injection + sensitive-file handling | 15 | Defense-in-depth improvements referenced in upstream README |
| 17 | Performance (`perf:`) | 9 | Caching, single-pass scans, prior-phase context pruning |
| 18 | Windows compatibility fixes | 6 | Windows-specific path/shell fixes |

Notable specific commits the fork is missing: pattern-mapper (#2121), prompt-thinning (#2111), `/gsd-ingest-docs` (#2389, #2437), installer SDK hardening (#2449), registry drift guard (#2442), conflict-engine extraction.

---

## 4. Overlap / Potential Conflicts

These are files edited on **both** sides since the common ancestor — the real merge-conflict candidates. Ranked by combined churn.

| Rank | File | Fork | Upstream | Conflict severity |
|-----:|------|------|----------|-------------------|
| 1 | `get-shit-done/workflows/execute-phase.md` | +23/-8 | +846/-70 | **Critical** — upstream rewrote the whole file; fork adds adversarial-verifier plumbing |
| 2 | `agents/gsd-verifier.md` | +289/-16 | +171/-41 | **Critical** — both sides rewrite the same agent with incompatible intent (adversarial vs upstream's audit-style evolution) |
| 3 | `agents/gsd-executor.md` | +177 | +133/-39 | **High** — fork inserts a whole new block; upstream modifies lines in the same region |
| 4 | `commands/gsd/reapply-patches.md` | +1 | +250/-42 | **High** — triviaal fork change lands on a heavily-rewritten file |
| 5 | `commands/gsd/debug.md` | +1 | +180/-90 | **High** — same pattern as above |
| 6 | `commands/gsd/thread.md` | +1 | +143/-43 | **High** |
| 7 | `commands/gsd/quick.md` | +1 | +129/-3 | **Medium** |
| 8 | `.gitignore` | +5 | +29 | **Low** — mechanical merge, disjoint entries |
| 9 | `get-shit-done/references/git-integration.md` | +14/-2 | +5/-5 | **Low-Medium** — same region edited but conceptually compatible |
| 10 | `commands/gsd/workstreams.md` | +1 | +18/-12 | **Low** |

Beyond the top 10, there are 31 more triviaal+upstream-touched files; all are low-severity (single-line frontmatter addition against small upstream edits).

---

## 5. Strategic Recommendation

**The fork is no longer "upstream + extras" — it is drifting into an independent variant.**

Evidence:
1. **5+ upstream releases missed** (v1.30 → v1.38.2). 602 behind is structural, not tactical.
2. **Two agent files (`gsd-executor`, `gsd-verifier`) carry opinionated rewrites** that conflict with upstream's own evolution of the same files. The executor even has a self-documenting MERGE NOTE begging future merges not to drop it — that's the signature of a permanent divergence, not a soon-to-be-merged patch.
3. **The adversarial-verifier rewrite and quality-rubric gating in `execute-phase.md` is a philosophical difference**, not a feature the fork could send upstream. Upstream's verifier is becoming a careful auditor; Mark's wants a red-team skeptic.
4. **57 single-line `user-invocable: true` changes** are mechanical but load-bearing: any merge must decide whether to re-apply the flag to every new upstream command or abandon the convention.
5. **Fork-exclusive workflow commands** (`build-all` with daemon loop, `vision-check`, cross-project `create-issue` ping-pong, `publish-version`, auto-verify + update-docs hooks) are where recent fork development has concentrated — all 5 of Mark's last commits as of 2026-04-22 are on `build-all`/`vision-check`.

**Recommendation: Option B — Selective merge, with a formal variant declaration.**

- **Cherry-pick upstream clusters that are net-positive and low-conflict:** security hardening (#11), performance (#17), Windows fixes (#18), installer hardening (#5), docs drift fixes (#8 where they don't conflict with a fork-side README patch).
- **Skip or carefully reconcile** the clusters that intersect fork-exclusive logic: `gsd-verifier.md` evolution (#13 UAT/verifier), the `execute-phase.md` workflow overhaul, and anything touching the executor's final-commit section.
- **Declare variant status** in `README.md` (done in a paired commit with this document) so contributors and future-Mark understand: this fork is tracking upstream selectively, not wholesale.
- **Either abandon `user-invocable: true`** (if no runtime consumes it) or **script its application** so it can be re-applied to any new upstream command in one pass.
- **Revisit the 5 upstream-PR candidates** from §1 — `build-all`, `build-phase`, `vision-check`, `create-issue`, `external-tools.md` — and file upstream PRs where the design language matches. That's the healthiest way to shrink the divergence surface over time.

**Option A (clean merge in one go) is not viable** — conflict severity on `execute-phase.md`, `gsd-verifier.md`, and `gsd-executor.md` alone means the merge would produce a file-by-file reconciliation session that is effectively the selective-merge workflow under a different name.

**Option C (declare variant, stop tracking upstream entirely) is premature** — the 15 upstream clusters include 300+ bug fixes, security hardening, and Windows compatibility work that is directly useful. Zero-tracking forgoes that.

---

## Appendix: Commands used

For reproducibility. Run from `/home/mark/Repositories/get-shit-done`.

```bash
# Divergence counts
git remote -v
git rev-list --count upstream/main..HEAD        # 59 (ahead)
git rev-list --count HEAD..upstream/main        # 602 (behind)

# Common ancestor
COMMON=$(git merge-base upstream/main HEAD)     # 604a78b3
git show --stat --format='%H %ai %s' "$COMMON"

# All differences
git diff --name-status upstream/main...HEAD | sort

# Fork-exclusive birth dates
for f in <A-files>; do
  git log --reverse --format='%H %ai %s' -- "$f" | head -1
done

# Per-file diff size (fork side and upstream side)
for f in <M-files>; do
  git diff --shortstat "$COMMON..HEAD"          -- "$f"   # fork edits
  git diff --shortstat "$COMMON..upstream/main" -- "$f"   # upstream edits
done

# Upstream cluster buckets
git log upstream/main --not HEAD --format='%s' \
  | awk -F'[:(]' '{print $1}' | sort | uniq -c | sort -rn

# Grep-based themed counts
git log upstream/main --not HEAD --format='%s' | grep -iE '<theme regex>' | wc -l
```
