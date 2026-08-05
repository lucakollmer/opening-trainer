# Starting Opening Trainer development with ChatGPT + GitHub Actions

## 1. What has already happened

Do not recreate the repository or rerun PHASE-0 scaffolding.

The current accepted checkpoint is an existing public repository, an exact pack-only `main` base, and a technically complete PHASE-0 candidate in draft PR #2. The application candidate has already passed permanent GitHub Actions validation. The remaining PHASE-0 work is:

1. migrate the repository authority from the historical Codex/local-run workflow to the accepted ChatGPT + GitHub Actions workflow;
2. validate that governance-only migration on the same branch and PR;
3. perform Luca's four-item manual PHASE-0 checklist;
4. explicitly accept or reject PHASE-0;
5. merge only after explicit acceptance;
6. begin PHASE-1 in a separate chat/turn only after the merge.

## 2. Create the new chat

Open a **new chat inside the Opening Trainer ChatGPT Project**. The project custom instructions must still point to the Google Drive project entrypoint.

Attach:

```text
opening-trainer-chatgpt-actions-pack-v2.zip
```

Do not attach or reinstall the historical `opening-trainer-codex-pack.zip` as a repository reset.

## 3. First message to paste

```text
Migrate the Opening Trainer repository to the accepted ChatGPT + GitHub Actions workflow. Read the Google Drive project entrypoint and all required linked records, including the accepted system workflow, then read the attached workflow pack and inspect lucakollmer/opening-trainer. Reverify that PR #2 is open, draft and unmerged; that its base is main at 87ccbce18384892601a6630494910e1ca0375f13; and that the current phase-0-foundation head is 5477419fce1f13f4265ab82d6ee3058d851b5019. If any mutable fact differs, stop and report it before writing. Apply only WORKFLOW_MIGRATION.md on the existing phase-0-foundation branch and PR #2. Preserve all PHASE-0 application code, dependencies, lockfile and .github/workflows/ci.yml. Replace the stale Codex/local-validation authority files, add the ChatGPT/Actions workflow files, remove only the deprecated paths named by the migration manifest, regenerate the repository integrity manifest with the existing project script, run GitHub Actions against the exact new head, update PR #2 with the structured report, and stop at Luca's PHASE-0 manual acceptance gate. Do not merge and do not begin PHASE-1.
```

An immutable copy is stored at:

```text
prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md
```

## 4. What the fresh chat must do before writing

The chat must:

1. read the Drive entrypoint first;
2. follow the current project read sequence;
3. read `03_Workflows/CHATGPT_GITHUB_ACTIONS_CODING.md` in Drive;
4. inspect current repository metadata, PR #2, its exact base/head and current Actions state;
5. compare the attached migration overlay with the repository authority files;
6. confirm there is no conflicting modifying workflow or moved PR head;
7. stop rather than guess when any required fact differs.

The attached ZIP does not override current Drive or GitHub facts.

## 5. What gets replaced

The migration replaces repository governance and handoff documents such as:

```text
AGENTS.md
context.md
plans.md
README.md
START_DEVELOPMENT.md
.github/pull_request_template.md
```

It adds:

```text
CHATGPT_START_HERE.md
CHATGPT_WORKFLOW_PROFILE.md
WORKFLOW_MIGRATION.md
docs/workflow/
prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md
```

It removes only the deprecated repository paths named in `WORKFLOW_MIGRATION.md`, including root `CODEX_*`, `docs/codex/`, and the original PHASE-0 Codex prompt.

## 6. What must be preserved

Do not replace or regenerate the PHASE-0 product foundation. Preserve:

```text
.github/workflows/ci.yml
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
vite.config.ts
tsconfig*.json
eslint.config.js
prettier.config.mjs
src/**
docs/architecture/PHASE-0-BOUNDARIES.md
docs/dependencies/INSTALLED_DEPENDENCIES.md
docs/ui/PHASE-0-REUSE-INVENTORY.md
scripts/check-pwa.mjs
scripts/update-integrity-manifest.mjs
scripts/write-dependency-record.mjs
```

The migration may update `scripts/verify-pack.mjs` and `PACK_MANIFEST.md` because they are part of the repository authority/integrity layer. After applying the overlay, use the repository's existing `scripts/update-integrity-manifest.mjs` to regenerate its full-tree `SHA256SUMS.txt`.

## 7. GitHub Actions evidence

After the governance commit is pushed to `phase-0-foundation`, the permanent validation workflow must run against the exact new head.

The report must include:

- branch and exact old/new head SHA;
- every changed/deleted/added path;
- workflow run ID and tested head;
- integrity, lint, strict typecheck, tests, production build, PWA and format results;
- dependency and licence effects, expected to be none;
- confirmation that PHASE-0 source code was preserved;
- PR #2 updated but still draft and unmerged;
- Luca's manual checklist still pending;
- `END_OF_COMPLETION_REPORT`.

If Actions is still running when the chat must return, the chat reports the run ID/status and stops. Start another user turn such as:

```text
Inspect the current Actions result for the Opening Trainer workflow migration and continue only with the existing migration/PHASE-0 review gate.
```

Ordinary ChatGPT does not resume by itself.

## 8. PHASE-0 manual review

After the migration workflow is green, perform the current four checks. A local clone is optional; GitHub Codespaces can be used if preferred.

Commands where a terminal is available:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Check:

1. The minimal MUI board/tree/task shell renders without an error overlay.
2. At phone width there is no horizontal page scroll.

Then:

```sh
pnpm build
pnpm preview
```

Check:

3. The same shell loads from the production preview.
4. One reload produces no service-worker loop or browser-console error.

This is foundation acceptance, not final PHASE-1 UI acceptance.

## 9. Report a failure

Use a new turn in the same project chat or a fresh project chat:

```text
Correct PHASE-0 on the existing phase-0-foundation branch and PR #2 only. Manual item <number> failed. Observed: <exact result>. Expected: <expected result>. Read Drive authority, the repository authority and current PR/Actions state. Diagnose and repair only the complete PHASE-0 cause, run the required GitHub Actions evidence on the exact new head, update the same draft PR, and stop for manual review. Do not merge or begin PHASE-1.
```

## 10. Accept PHASE-0

After all four checks pass, use a separate instruction:

```text
I completed the PHASE-0 manual checklist and accept PHASE-0 at the current exact PR #2 head. Read Drive authority and verify the PR head and required Actions evidence have not changed. Record the explicit acceptance in the repository execution context and Assistant Memory, update the same branch if required, and return the exact verified head and proposed merge action. Do not merge and do not begin PHASE-1 unless I explicitly authorise the merge in this message.
```

Then, in another explicit message:

```text
Merge accepted PHASE-0 PR #2 at the verified accepted head. Update Assistant Memory with the merge commit and PHASE-1 gate. Do not begin PHASE-1.
```

## 11. Begin PHASE-1

Only after PHASE-0 is accepted and merged into `main`, start a new chat or turn:

```text
Continue with phase 1.
```

The chat must re-read Drive, inspect `main`, prove the PHASE-0 acceptance and merge, create/use only `phase-1-responsive-shell`, author bounded changes, use Actions for technical evidence, and stop at manual acceptance.

Later commands retain the same form:

```text
Continue with phase 5.
```

PHASE-5 is refused unless PHASE-0 through PHASE-4 are explicitly accepted and merged.

## 12. Operating rules

- One phase, correction, migration, acceptance, or merge operation per instruction.
- One phase branch and one draft PR.
- No direct product mutation on `main`.
- No auto-merge.
- No new backend, accounts, cloud sync, engine, native wrapper, custom design system or opening dataset outside an accepted phase.
- GitHub Actions supplies technical evidence; Luca supplies visible acceptance.
- Each continuation requires a new user turn.
