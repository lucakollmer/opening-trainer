# Opening Trainer ChatGPT + GitHub Actions workflow pack

This is a **workflow migration overlay** for `lucakollmer/opening-trainer`. It replaces the historical local-Codex operating layer with the accepted ChatGPT-browser + GitHub Actions trial workflow while preserving the existing PHASE-0 application candidate.

It is not a fresh repository scaffold and must not be copied over the repository indiscriminately.

## Current checkpoint

At pack creation, the verified checkpoint was:

```yaml
repository: lucakollmer/opening-trainer
visibility: public
base_branch: main
base_sha: 87ccbce18384892601a6630494910e1ca0375f13
phase_branch: phase-0-foundation
phase_head: 5477419fce1f13f4265ab82d6ee3058d851b5019
pull_request: 2
pull_request_state: open, draft, unmerged
permanent_validation_run: 30906801969
permanent_validation_result: success
review_artifact_id: 8891213897
phase_gate: COMPLETE_FOR_MANUAL_REVIEW
```

These are verification expectations, not permission to assume mutable GitHub state. The executing chat must re-read Drive and GitHub before writing.

## Start here

1. Read `CHATGPT_START_HERE.md`.
2. Read `WORKFLOW_MIGRATION.md`.
3. Attach this ZIP to a fresh Opening Trainer project chat.
4. Paste the exact migration request from `CHATGPT_START_HERE.md`.
5. Apply the overlay only on the existing `phase-0-foundation` branch and PR #2 after exact-state verification.
6. Let GitHub Actions validate the new head.
7. Stop for Luca's PHASE-0 manual acceptance. Do not merge or begin PHASE-1.

## Main files

- `AGENTS.md` - durable repository operating rules.
- `context.md` - current verified execution checkpoint.
- `plans.md` - detailed PHASE-0 to PHASE-8 programme and gates.
- `CHATGPT_START_HERE.md` - fresh-chat orientation and exact first request.
- `CHATGPT_WORKFLOW_PROFILE.md` - bounded work-request contract.
- `WORKFLOW_MIGRATION.md` - exact preserve/replace/add/delete migration map.
- `docs/workflow/` - Actions security, evidence, phase-command, prompt and report contracts.
- `prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md` - immutable first migration request.
- `scripts/verify-pack.mjs` - overlay/repository integrity and stale-authority checks.

## Current application commands

After the overlay is applied, the PHASE-0 application remains a Node 24/pnpm project:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm validate
pnpm build
pnpm preview
```

GitHub Actions runs `pnpm validate` as the technical evidence gate. Local or Codespaces commands are for interactive review and debugging.

## Critical boundary

The overlay must preserve the current application implementation, package/lockfiles, tests, PHASE-0 documents and `.github/workflows/ci.yml`. It must not overwrite the repository's generated full-tree `SHA256SUMS.txt` with this transfer archive's checksum file. Follow `WORKFLOW_MIGRATION.md` exactly.
