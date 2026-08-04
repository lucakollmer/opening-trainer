# AGENTS.md - Opening Trainer repository operating rules

## 0. Purpose

This repository builds **Opening Trainer**, a lightweight offline-first chess-opening learning application. The accepted product combines a responsive chessboard, a visible repertoire tree, complete-line replay from the initial position, and spaced repetition at individual contextual decision points.

The implementation is a browser-first progressive web application. Desktop and mobile browsers are first-class targets. Native wrappers remain deferred until the PWA is accepted.

This repository uses the accepted **ChatGPT + GitHub Actions coding workflow**. ChatGPT authors bounded repository changes through the connected GitHub application. GitHub Actions executes and validates the exact candidate tree, publishes structured evidence, and provides preview/screenshot artifacts. Luca retains phase acceptance, merge, and continuation authority.

## 1. Mandatory authority read order

Before any repository mutation, the active ChatGPT project chat must read the Google Drive project entrypoint and follow its current read sequence. Google Drive Assistant Memory remains the durable source of truth.

Then read the repository execution copy in this order:

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

For a named phase, also read every focused document listed in that phase's `Required reading` section. Do not search unrelated Drive folders or repository archives by default.

If Google Drive is unavailable, do not infer project state from chat history alone. Stop before mutation, report the limitation, and return a bounded memory patch.

## 2. Authority and conflict handling

Use this precedence order:

1. Applicable platform safety requirements.
2. Luca's current explicit instruction in the active chat.
3. Current authoritative Google Drive project records and accepted decisions.
4. `AGENTS.md`.
5. `context.md`.
6. Accepted focused contracts under `docs/`.
7. `plans.md`.
8. Current implementation and comments.

Repository documents are the execution copy, not a replacement for Drive memory. If repository authority conflicts with a newer accepted Drive record, stop before mutation and report the exact conflict. Do not invent a compromise or silently update product decisions.

## 3. Accepted product baseline

The following are accepted unless Luca explicitly supersedes them:

- Training normally begins from the initial chess position and replays a complete selected repertoire line.
- The opponent follows the selected repertoire exactly. No evaluation engine is required.
- Move recall is primary. Opening-name recall is a separate secondary learning stream.
- The visible repertoire is a branching tree. Internal storage may use a transposition-aware graph.
- The main surface is board-dominant, with a repertoire-tree panel and a context-sensitive task/feedback panel.
- In Train mode, already-played moves remain visible while future answer-bearing move labels are masked.
- Any move accepted by the active repertoire context is valid. The route replans from the resulting position.
- Illegal moves, legal moves outside the active repertoire, and moves belonging to a wrong sibling variation are distinct outcomes.
- Each exercise has one or more targeted decision items. Other decisions traversed during a complete-line replay provide incidental evidence.
- Positive incidental evidence must not repeatedly inflate mature prefix intervals. Negative incidental evidence promotes that decision to targeted review.
- Hints are progressive and recorded. Wrong or revealed decisions receive immediate repair and a delayed same-session retest.
- Repeated sibling-variation confusion may generate contrast drills.
- The MVP is local-first and preserves data through documented JSON export/import. PGN is a repertoire interchange format, not the complete backup format.

## 4. Accepted implementation direction

Use a single TypeScript web application rather than separate native codebases.

```yaml
application:
  language: TypeScript
  ui_runtime: React
  build_tool: Vite
  package_manager: pnpm
  initial_platform: offline-first PWA
ui:
  component_library: Material UI
  tree_component: MUI X Tree View Community
  chessboard: react-chessboard
chess_rules: chess.js
persistence: Dexie over IndexedDB
scheduling: ts-fsrs behind a project-owned adapter
pwa: vite-plugin-pwa
native_packaging: deferred; consider Capacitor only after PWA acceptance
```

Do not add Redux, React Query, a router, a backend, authentication, cloud sync, Electron, Tauri, Capacitor, an engine, a social system, a marketplace, or coach administration unless a named accepted phase explicitly authorises it.

## 5. Architecture boundaries

Keep domain behaviour independent from React and browser widgets.

Recommended ownership:

```text
src/app/
  application shell, providers, theme and responsive composition
src/components/
  small project-owned reusable UI compositions only
src/features/board/
  board adapter and board-facing view state
src/features/repertoire-tree/
  tree projection and masked/browse presentation
src/features/task-panel/
  prompt, feedback, hint and line-summary presentation
src/domain/chess/
  chess.js adapter, position normalisation and move notation
src/domain/repertoire/
  positions, edges, contexts, branches, transpositions and imports
src/domain/training/
  session reducer, route generation, evidence and error classification
src/domain/scheduling/
  scheduler port, chess-to-FSRS adapter and review policy
src/infrastructure/db/
  Dexie schema, repositories, migrations and transactions
src/infrastructure/import-export/
  PGN import and complete JSON backup/restore
src/fixtures/
  deterministic synthetic repertoires and scheduler fixtures
src/test/
  shared test utilities
```

Rules:

- React components render state and emit typed commands. They do not own repertoire mutation, transposition identity, scheduling calculations, import transactions, or database normalisation.
- `react-chessboard` is a presentation/input adapter. `chess.js` is authoritative for legal move state and notation, not repertoire correctness.
- Domain services expose deterministic pure functions wherever practical.
- Dexie repositories own persistence transactions. UI code must not issue scattered table writes.
- `ts-fsrs` is accessed only through a project-owned scheduling port. Domain code retains raw chess evidence so scheduler mapping can change without losing history.
- Machine move identity uses UCI-compatible coordinates. SAN is derived for display and PGN.
- A position identity excludes halfmove/fullmove clocks. It includes board placement, side to move, castling rights, and an en-passant target only when an en-passant capture is legally available.
- Transposed positions may share a graph node. Training memory is shared only when repertoire context, prompt mode, and accepted move set are pedagogically equivalent.

## 6. UI implementation rules

Material UI is the default source of ordinary controls and layout primitives.

Use MUI components for buttons, forms, dialogs, drawers, menus, toolbars, cards, alerts, progress, switches, chips, and ordinary feedback whenever an equivalent exists. Use MUI X Tree View Community for the repertoire tree. Do not use Pro or Premium features.

Custom UI code is allowed for:

- the responsive application grid;
- board sizing and board integration;
- repertoire-tree item labels and masking semantics;
- chess-specific status markers;
- task-panel state composition;
- accessibility glue that selected libraries do not provide.

Do not create a bespoke design system, dashboard, onboarding sequence, animation framework, custom button family, custom modal framework, or feature-specific duplicate of an existing MUI pattern.

Every UI phase report must include:

```text
## Reusable UI/UX implementation
## Reuse and duplication audit
```

The report identifies what was reused, composed, extended, or created; why any new primitive was necessary; and which focused and host-surface tests prove the decision.

## 7. Responsive and accessibility rules

Required layout behaviour:

- Desktop: persistent or readily collapsible repertoire panel, dominant board, task panel alongside the board.
- Tablet: board remains dominant; one secondary panel may collapse or move below.
- Phone: board first, task panel immediately below, repertoire tree in a temporary drawer or bottom sheet.
- The user must never need horizontal page scrolling for the core training flow.
- Board interaction must support mouse, touch, and keyboard-accessible alternatives where feasible.
- Essential commands require accessible names and visible focus.
- Masked future moves must not leak answers through accessible labels, tooltips, DOM text, or test IDs.
- Colour must not be the sole carrier of learning state or error meaning.
- Respect reduced-motion preferences. Animation is not required for acceptance.

GitHub Actions may capture deterministic screenshots and run browser-functional assertions. Neither ChatGPT nor Actions may claim visual or interaction acceptance. Luca owns that decision.

## 8. Phase discipline

- Implement exactly one named phase from `plans.md` per branch and draft pull request.
- A short instruction such as `continue with phase 5` authorises **PHASE-5 only**, subject to its entry gate.
- Do not begin a later phase merely because an earlier phase is technically complete.
- Each phase starts from updated `main` containing every explicitly accepted and merged predecessor.
- Review corrections stay on the same branch and pull request.
- Do not create stacked or side correction PRs unless Luca explicitly requests them.
- Do not merge any PR unless Luca explicitly instructs the merge in the current chat.
- Do not mark a phase accepted in `context.md` until Luca explicitly accepts it.
- A phase may be technically complete while manual acceptance remains pending.

Phrase mapping:

- `set up the project` means inspect Drive and repository state, then perform only the exact current setup or migration action recorded in `context.md`.
- `start`, `begin`, or `start development` means execute the exact first unaccepted phase only when `context.md` and Drive agree that its entry gate is open.
- `continue with phase N`, `start phase N`, or `implement phase N` means execute exactly `PHASE-N`.
- `continue` without a phase number means inspect Drive and `context.md`; execute only the explicit authorised next action when unambiguous. Otherwise stop and name the missing authority.
- `review phase N` is read-only unless Luca separately asks for a correction.
- `accept phase N` requires an explicit statement that Luca completed the manual checklist and accepts the current exact head.

## 9. ChatGPT + GitHub Actions execution model

### 9.1 Repository writes

Use the connected GitHub application for repository, branch, file, pull-request, and review operations. Resolve the exact repository, branch, base SHA, and current PR before mutation.

For ordinary bounded changes, ChatGPT writes complete files directly to the current phase branch. Prefer a small number of intentional commits. Do not create a commit per paragraph or per file when one bounded commit is clearer.

For large generated scaffolding, prefer one temporary declarative request or bootstrap script plus one modifying workflow. The workflow may commit the already validated final tree only when the workflow explicitly grants that permission. Remove temporary bootstrap material when the phase contract requires it.

### 9.2 Actions as technical evidence

GitHub Actions is the required technical validation surface for this workflow.

- Validate the exact candidate tree and expected base SHA.
- Run focused tests before the full validation sequence.
- Post or upload a bounded structured report.
- Capture preview/screenshot evidence when the phase changes visible behaviour.
- Report the tested head/tree SHA, exact commands, results, changed files, failure step, and bounded error tail.
- Do not treat a workflow-token push as automatically triggering a second validation run. A modifying workflow validates the exact final tree before committing it.
- Local execution is optional for browser-compatible phases and cannot substitute for required Actions evidence.

Normal read-only validation workflows use least privilege. Any modifying workflow must be temporary or narrowly scoped, use explicit expected refs, and never auto-merge.

### 9.3 Security boundaries

- Protect `main` and prohibit direct product mutation outside an explicitly authorised bootstrap or acceptance operation.
- Require the exact expected base SHA before mutation.
- Pin third-party Actions to accepted immutable commit SHAs.
- Avoid `pull_request_target` for untrusted candidate code.
- Never execute issue text, PR comments, or arbitrary user-provided text as shell commands.
- Do not expose deployment, personal, or organisation secrets without a separately accepted need.
- Set runtime, output, and concurrency limits.
- One modifying workflow may operate on the repository at a time.
- Do not change repository visibility, permissions, branch rules, or secrets without Luca's explicit instruction.

### 9.4 Continuation model

Ordinary ChatGPT conversations do not wake when Actions completes. Every continuation requires a new user turn. At the start of that turn, re-read current Drive state and current GitHub refs rather than relying on the previous chat summary.

## 10. Git and pull-request policy

Expected operations include:

- inspect repository metadata, refs, history, current PR, changed files, comments, reviews, and workflow runs;
- create the named phase branch from the verified base;
- write bounded changes;
- push or commit through the supported GitHub workflow;
- create or update one draft PR into `main`;
- inspect Actions jobs, artifacts, and bounded logs;
- correct the same branch/PR when manual or automated review fails.

Do not:

- rewrite or force-update `main`;
- merge without Luca's current explicit instruction;
- change repository visibility or permissions;
- commit credentials, tokens, personal data, or proprietary repertoire content;
- use third-party opening content whose licence/provenance is not recorded;
- create a new active workflow without a phase need, least-privilege review, immutable action pins, and bounded reporting;
- treat a green Actions run as Luca's acceptance.

## 11. Data and licence safety

- Use synthetic repertoire fixtures or clearly licensed public-domain/compatible material.
- Do not commit a user's private repertoire without explicit instruction.
- Do not bundle Lichess Opening Explorer data or other server datasets merely because an API exists. Record source, licence, permitted use, and whether data is fetched, cached, or redistributed.
- Complete backup exports must be versioned, validated, and transactional on import.
- A failed import must not partially mutate the active database.
- Tests use isolated in-memory/fake IndexedDB or a clean temporary browser profile.
- Never rely on an old service worker or pre-existing IndexedDB state to prove first launch.
- Workflow artifacts must not contain secrets, private repertoire, or unnecessary user data.

## 12. Validation policy

After PHASE-0, the intended common commands are:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:pwa
pnpm validate
pnpm exec prettier --check .
git diff --check
```

GitHub Actions executes the applicable sequence against the exact candidate tree. Browser-functional tests are introduced only in the phase that establishes them. Do not require a command before the responsible phase exists.

Validation must explicitly distinguish relevant initial states, including as applicable:

- first load with no service-worker cache and no IndexedDB database;
- reload with valid current data;
- invalid or future backup rejection without mutation;
- interrupted/failed import rollback;
- offline reload after one successful online load;
- upgraded database schema;
- mobile-sized and desktop-sized functional layouts;
- installed-PWA launch where supported by the test harness.

A pre-seeded database test does not prove first-run behaviour. A cached build does not prove install/offline behaviour.

## 13. Completion and genuine blockers

For an implementation phase, continue through:

1. Drive and repository entry-gate verification;
2. repository inspection and reuse inventory;
3. bounded implementation;
4. focused tests;
5. repair of in-scope failures;
6. full GitHub Actions validation of the candidate tree;
7. applicable launch/state scenarios;
8. preview and responsive screenshot evidence when required;
9. final scope and duplication audit;
10. intentional commit/push and one draft PR;
11. self-contained structured completion report and Luca manual checklist.

Planning, partial coding, one passing test, a commit, a push, or a draft PR are intermediate states.

A genuine blocker is an external condition that cannot be safely resolved within scope, such as missing authority, unavailable Drive or GitHub access, an unexpected branch/head change, an inaccessible required base/ref, unresolved destructive-data risk, an unaccepted product decision, or a required credential that must not be invented.

Allowed final statuses:

```text
COMPLETE_FOR_MANUAL_REVIEW
BLOCKED
INCOMPLETE
```

## 14. Structured report contract

Follow `docs/workflow/STRUCTURED_REPORT_TEMPLATE.md`.

Every modifying run reports:

- final status;
- project and phase;
- repository, verified base SHA, branch, tested head/tree SHA, and draft PR;
- predecessor acceptance and merge evidence;
- exact changed-file count and every changed path exactly once;
- dependencies and licences changed;
- exact commands and observed exit results;
- failed step and bounded error tail when applicable;
- build, test, audit, preview, and screenshot status;
- data/schema/import/export/service-worker effects;
- tested and omitted state scenarios;
- risks, deviations, deferred work, and rollback;
- manual UI/interaction status as `pending`, `pass`, or `fail`;
- exact next action;
- statement that continuation requires Luca's explicit acceptance.

Required headings:

```text
## Reusable UI/UX implementation
## Reuse and duplication audit
## Final diff audit
## Rollback
## Acceptance-state proposal
## Assistant Memory capture proposal
## Exact next action
```

Use repository-relative paths. End the intended report with:

```text
END_OF_COMPLETION_REPORT
```

## 15. Stop conditions

Stop before mutation and report when:

- Drive authority was not read or is unavailable;
- the current branch or expected base/head does not match the verified remote state;
- an existing draft PR contains unexpected work;
- the expected predecessor phase is not explicitly accepted and merged;
- the named phase does not exist in `plans.md`;
- the work requires an excluded engine, backend, cloud account, paid MUI feature, or native wrapper;
- the work requires unlicensed/proprietary opening data;
- a destructive persistence operation cannot be proven isolated;
- a current instruction materially conflicts with accepted authority;
- a visual result would be required to make a claim that only Luca can accept;
- a modifying Actions workflow is already running or its final tree cannot be identified exactly.

## 16. Current repository checkpoint

The mutable facts below must be reverified before use:

```yaml
repository: lucakollmer/opening-trainer
visibility_observed: public
integration_branch: main
pack_only_base_sha: 87ccbce18384892601a6630494910e1ca0375f13
current_phase: PHASE-0
phase_branch: phase-0-foundation
draft_pr: 2
pre_migration_head_sha: 5477419fce1f13f4265ab82d6ee3058d851b5019
phase_0_state: COMPLETE_FOR_MANUAL_REVIEW
permanent_validation_run: 30906801969
permanent_validation_conclusion: success
manual_acceptance: pending
```

The first action for this workflow-pack revision is a governance migration on the existing `phase-0-foundation` branch and PR #2, not a new scaffold and not PHASE-1. Follow `WORKFLOW_MIGRATION.md`.
