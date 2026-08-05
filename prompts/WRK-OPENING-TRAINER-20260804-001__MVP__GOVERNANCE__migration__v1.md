---
request_id: WRK-OPENING-TRAINER-20260804-001
project_id: PRJ-CHESS-OPENING-TRAINER
programme: MVP
operation: GOVERNANCE-MIGRATION
version: 1
repository: lucakollmer/opening-trainer
expected_base_branch: main
expected_base_sha: 87ccbce18384892601a6630494910e1ca0375f13
working_branch: phase-0-foundation
expected_head_sha: 5477419fce1f13f4265ab82d6ee3058d851b5019
pull_request: 2
status: issued
---

# Migrate Opening Trainer to ChatGPT + GitHub Actions

Read the Google Drive project entrypoint first and follow its current read sequence. Read the accepted system workflow `03_Workflows/CHATGPT_GITHUB_ACTIONS_CODING.md`. Then read the attached workflow pack in the order defined by `AGENTS.md` and inspect the current GitHub repository and PR.

Before mutation, reverify all mutable expectations in the front matter. Required current state is:

- repository `lucakollmer/opening-trainer`;
- PR #2 open, draft, unmerged and targeting `main`;
- PR base `87ccbce18384892601a6630494910e1ca0375f13`;
- branch `phase-0-foundation` at `5477419fce1f13f4265ab82d6ee3058d851b5019`;
- no overlapping modifying workflow;
- PHASE-0 remains `COMPLETE_FOR_MANUAL_REVIEW`, not accepted or merged.

If any mutable fact differs, stop before writing and report the exact discrepancy.

Execute `WORKFLOW_MIGRATION.md` only. Preserve all PHASE-0 application code, dependencies, lockfile, tests, configuration, focused PHASE-0 records and `.github/workflows/ci.yml`. Replace only the stale repository authority and handoff files listed by the migration map. Add the ChatGPT/Actions workflow files. Delete only the explicitly deprecated Codex paths.

Do not overwrite the repository's full-tree `SHA256SUMS.txt` with the transfer archive's checksum file. After applying the overlay, run the existing repository integrity-manifest updater and verify the exact candidate tree.

Push one intentional governance-migration commit to the existing `phase-0-foundation` branch. Run the permanent GitHub Actions validation against the exact new head. Do not weaken workflow permissions, unpin actions, use `pull_request_target`, execute untrusted text, add secrets, publish a public deployment, or auto-merge.

Update PR #2 with a structured report using `docs/workflow/STRUCTURED_REPORT_TEMPLATE.md`. It must prove:

- only governance/workflow files changed;
- PHASE-0 source and dependency tree were preserved;
- dependency, licence, schema and user-data effects are none;
- Actions validated the exact final head;
- the PR remains draft and unmerged;
- Luca's four-item PHASE-0 manual checklist remains pending;
- PHASE-1 is blocked.

If Actions is still running when returning, report the run ID/status and stop. Ordinary ChatGPT cannot resume automatically.

Do not merge. Do not mark PHASE-0 accepted. Do not begin PHASE-1.

END_OF_WORK_REQUEST
