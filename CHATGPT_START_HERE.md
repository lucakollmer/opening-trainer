# CHATGPT_START_HERE.md - Start or resume Opening Trainer development

## 0. Purpose

This file tells a fresh ChatGPT project chat how to work on `lucakollmer/opening-trainer` through the accepted ChatGPT + GitHub Actions workflow.

It supersedes the historical local-Codex start procedure. Do not launch Codex CLI, recreate the repository, reinstall the original pack baseline, or rerun the PHASE-0 scaffold unless current Drive authority explicitly reverses the recorded checkpoint.

## 1. Required first read

Read Google Drive authority first:

1. Opening Trainer `PROJECT_ENTRYPOINT.md`.
2. `PROJECT_PASSPORT.md`.
3. `CURRENT_STATE.md`.
4. `CURRENT_PLAN.md`.
5. accepted entries in `DECISION_LOG.md`.
6. `CODEX_HANDOFF.md` and `HANDOFF.md` because the current task is execution transfer.
7. system workflow `03_Workflows/CHATGPT_GITHUB_ACTIONS_CODING.md`.

Then inspect GitHub and read repository authority in this order:

```text
AGENTS.md
context.md
plans.md
CHATGPT_START_HERE.md
CHATGPT_WORKFLOW_PROFILE.md
docs/workflow/CHATGPT_GITHUB_ACTIONS_CODING.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
```

For a named phase, read the focused documents listed in that phase.

## 2. Current repository checkpoint

Reverify all values before using them:

```yaml
repository: lucakollmer/opening-trainer
visibility_observed: public
integration_branch: main
verified_pack_base_sha: 87ccbce18384892601a6630494910e1ca0375f13
current_phase: PHASE-0
phase_branch: phase-0-foundation
draft_pr: 2
pre_workflow_migration_head_sha: 5477419fce1f13f4265ab82d6ee3058d851b5019
permanent_validation_run: 30906801969
permanent_validation_result: success
manual_acceptance: pending
```

The repository already contains a technically complete PHASE-0 candidate. The first use of this pack is a governance migration on the existing branch and PR, not a product restart.

## 3. First instruction for the new workflow pack

Attach `opening-trainer-chatgpt-actions-pack-v2.zip` to a fresh chat in the Opening Trainer project, then send:

```text
Migrate the Opening Trainer repository to the accepted ChatGPT + GitHub Actions workflow. Read the Google Drive project entrypoint and all required linked records, then read the attached pack and inspect lucakollmer/opening-trainer. Reverify that PR #2 is open, draft and unmerged; that its base is main at 87ccbce18384892601a6630494910e1ca0375f13; and that the current phase-0-foundation head is 5477419fce1f13f4265ab82d6ee3058d851b5019. If any mutable fact differs, stop and report it before writing. Apply only WORKFLOW_MIGRATION.md on the existing phase-0-foundation branch and PR #2. Preserve all PHASE-0 application code, dependencies, lockfile and .github/workflows/ci.yml. Replace the stale Codex/local-validation authority files, add the ChatGPT/Actions workflow files, remove only the deprecated paths named by the migration manifest, run GitHub Actions against the exact new head, update PR #2 with the structured report, and stop at Luca's PHASE-0 manual acceptance gate. Do not merge and do not begin PHASE-1.
```

## 4. Short-command routing after migration

- `review phase 0` -> inspect Drive, PR #2, exact head, Actions, artifact, and manual checklist. Read-only unless a defect is found and Luca asks for correction.
- `correct phase 0` -> correct only the existing PHASE-0 branch/PR and rerun Actions.
- `I completed the PHASE-0 checklist and accept PHASE-0` -> verify exact current head and Actions, update acceptance state, merge only if Luca explicitly instructs merge, and do not start PHASE-1 in the same operation unless separately authorised.
- `continue with phase 1` -> execute PHASE-1 only after PHASE-0 is explicitly accepted and merged into `main`.
- `continue with phase 5` -> execute PHASE-5 only after PHASE-0 through PHASE-4 are explicitly accepted and merged.
- `continue` -> use Drive plus `context.md` only when the exact next action is unambiguous; otherwise stop and name the missing authority.

A phase command authorises bounded implementation on the named phase branch, GitHub Actions validation, one draft PR, structured evidence, and a manual checklist. It does not authorise merge or the next phase.

## 5. Standard phase procedure

1. Read current Drive and repository authority.
2. Verify repository, base SHA, predecessor acceptance/merge, branch, PR, and stop condition.
3. Create or reuse exactly one phase branch and one draft PR.
4. Inventory existing implementation and reuse before writing.
5. ChatGPT writes the bounded change through GitHub.
6. GitHub Actions validates the exact candidate tree.
7. Repair in-scope failures on the same branch/PR.
8. Publish the structured report and preview/screenshot evidence required by the phase.
9. Luca performs the manual checklist.
10. Stop until Luca explicitly accepts or rejects the phase.

ChatGPT does not automatically resume when Actions finishes. Luca sends a new turn.

## 6. Correction instruction pattern

```text
Correct PHASE-N on the existing phase branch and draft PR only. Read current Drive authority, AGENTS.md, context.md, plans.md and the PHASE-N contracts. Reverify the exact current head before writing. The failed item is: <item>. Observed: <result>. Expected: <result>. Repair the smallest complete cause, preserve unrelated accepted work, run all applicable GitHub Actions validation and preview evidence against the exact new head, update the same draft PR and return the full structured report. Do not merge or begin another phase.
```

## 7. Acceptance and merge pattern

Use only after actually completing the manual checklist:

```text
I completed the PHASE-N manual checklist and accept PHASE-N at the current exact PR head. Read current Drive and repository authority, verify that the PR head and required Actions evidence have not changed, update context.md to record my explicit acceptance, run the required documentation validation, and merge the accepted PR into main only if this message explicitly authorises the merge. Do not begin PHASE-(N+1). Return the merge commit, updated main SHA, memory-capture result and exact next authorised command.
```

Acceptance of a phase and authorisation to merge may be given together or separately. Never infer either one.

## 8. Expected evidence

Every modifying run must provide:

- exact base and tested head/tree SHAs;
- exact changed paths;
- dependency/licence changes;
- Actions commands and results;
- bounded failure details when applicable;
- preview and responsive screenshots for visible changes;
- data/schema/service-worker effects;
- risks, deviations, rollback, and exact next action;
- a numbered manual checklist;
- an explicit statement that continuation requires Luca's acceptance.

## 9. Do not do these things

- Do not create another `opening-trainer` repository.
- Do not change the repository's public visibility without explicit instruction.
- Do not reset `main` or recreate the pack-only baseline.
- Do not rerun the original PHASE-0 scaffold.
- Do not replace current application code with files from this governance pack.
- Do not use local Codex validation as the project evidence source.
- Do not merge PR #2 or begin PHASE-1 before explicit PHASE-0 acceptance.
