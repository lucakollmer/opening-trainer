---
prompt_id: PRM-OPENING-TRAINER-20260803-001
project_id: PRJ-CHESS-OPENING-TRAINER
framework_version: 1.1-trial
project_profile_version: 1.0
prompt_type: implementation
programme: MVP
phase: PHASE-0
repository: lucakollmer/opening-trainer
integration_branch: main
working_branch: phase-0-foundation
parent_prompt_id: null
supersedes_prompt_id: null
created_date_europe_london: 2026-08-03
status: issued
---

# PHASE-0 — Repository and application foundation

## Prompt type and exact terminal goal

Execute PHASE-0 only. Starting from verified current `origin/main` containing the agentic pack, create `phase-0-foundation`, establish the complete React/TypeScript/Vite/pnpm foundation and accepted dependency/quality gates defined in `plans.md`, run all PHASE-0 local validation, commit, push and open one draft PR into `main`, then stop at Luca's manual acceptance gate with the required self-contained report.

## Successful stopping state

The only successful status is `COMPLETE_FOR_MANUAL_REVIEW` after every applicable PHASE-0 acceptance criterion, validation command, diff audit, commit, push, draft PR and report requirement is complete. Planning, scaffolding, a partial dependency install, one passing test, a commit, a push or PR creation alone are intermediate states.

Allowed final statuses:

```text
COMPLETE_FOR_MANUAL_REVIEW
BLOCKED
INCOMPLETE
```

## Hard entry gate

Read, in order:

```text
AGENTS.md
context.md
plans.md
CODEX_START_HERE.md
CODEX_PROMPT_PROFILE.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
docs/ui/UI_AND_INTERACTION_CONTRACT.md
docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md
docs/dependencies/DEPENDENCY_AND_LICENSE_POLICY.md
```

Then verify repository/remote, clean tree, pack integrity and current `origin/main`. Stop before mutation if unexpected code, changes or repository coordinates exist.

## Authorised scope

Implement exactly the `PHASE-0` section of `plans.md`, including:

- Vite React TypeScript pnpm scaffold without overwriting the pack;
- current compatible stable accepted dependencies and lockfile;
- strict TypeScript, lint, formatting, Vitest/Testing Library and validation scripts;
- architecture folder boundaries;
- one MUI theme/provider and minimal integration shell;
- bounded board/tree/task placeholders using accepted libraries;
- focused chess.js, Dexie/fake-indexeddb, ts-fsrs-port and PWA/manifest smoke coverage;
- version/licence/environment documentation;
- production build and PHASE-0 validation;
- one intentional commit, push and draft PR.

## Explicit non-scope

Do not implement PHASE-1 responsive product UI, PHASE-2 training logic, repertoire graph/import, production Dexie schema, FSRS mapping, backend/cloud/auth/sync, engine, router, Redux, React Query, Electron, Tauri, Capacitor, deployment or native packaging.

Do not merge the PR or begin another phase.

## Completion contract

Continue through all repairable in-scope failures. A genuine blocker is an external condition that cannot be safely resolved within PHASE-0, such as inaccessible repository authority, unknown dirty work, missing package/network access after bounded diagnosis, incompatible accepted dependency requiring a product decision, or unsafe credentials/permissions.

## Reusable UI/UX inventory and reuse decisions

Before UI scaffolding, map toolbar/shell/tree/task/card/board placeholders to MUI, MUI X Tree View Community, react-chessboard or the smallest project-owned adapter. Default to reuse/compose. Do not create custom ordinary controls or a bespoke design system.

## Validation and reporting

Run every command and scenario required by PHASE-0. Record exact observed results. Use repository-relative paths. List every changed path exactly once with `changed_file_count`.

The completion report must use all headings and sentinel required by `AGENTS.md` and `docs/codex/COMPLETION_REPORT_TEMPLATE.md`. Luca performs the manual checklist; report its status as pending.

END_OF_CODEX_PROMPT
