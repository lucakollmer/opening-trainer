# plans.md - Opening Trainer MVP programme

## 0. Active instruction to ChatGPT

Read Google Drive project authority first, then every repository file listed in `AGENTS.md` before changing GitHub.

The current authorised operation is **workflow governance migration on the existing PHASE-0 branch and PR #2**. It is not a PHASE-0 scaffold rerun.

Use:

```text
Migrate the repository to the accepted ChatGPT + GitHub Actions workflow.
```

Execute `WORKFLOW_MIGRATION.md` only after exact-state verification. Preserve the PHASE-0 application candidate and permanent validation workflow, update the same branch and draft PR, obtain Actions evidence for the exact new head, and stop at Luca's existing PHASE-0 manual acceptance gate.

After PHASE-0 is explicitly accepted and merged, a command such as `Continue with phase 1` authorises PHASE-1 only. `Continue with phase 5` authorises PHASE-5 only when PHASE-0 through PHASE-4 are all explicitly accepted and merged into current `main`.

Do not implement more than one phase in a branch or pull request. Do not mark a phase accepted, merge, or begin the next phase without Luca's explicit instruction.

## 1. Programme outcome

The MVP programme delivers:

- a tested React/TypeScript/Vite application;
- responsive Material UI shell with board, repertoire tree and task panel;
- deterministic complete-line training from the initial position;
- transposition-aware repertoire graph and tree projection;
- multiple accepted moves and contextual training items;
- PGN repertoire import with explicit variation support and warnings;
- local Dexie persistence and complete portable JSON backup/restore;
- FSRS-based scheduling behind a chess-specific adapter;
- guided learning, hints, repair, targeted/incidental evidence and contrast support;
- repertoire management, playlists, progress and separate name recall;
- installable/offline PWA behaviour and accessibility hardening;
- a release candidate with documented deployment and a native-packaging decision.

## 2. Programme-wide execution model

### 2.1 Authority and continuity

- Google Drive Assistant Memory is the canonical project and operational record.
- The product GitHub repository is the code, branch/PR, Actions execution and structured evidence channel.
- Repository authority files are the execution copy and cannot silently override newer accepted Drive decisions.
- Ordinary ChatGPT conversations do not resume when an Action completes; every continuation requires a user turn and state reread.

### 2.2 Branch and PR model

- `main` is the integration branch and is not directly mutated for phase implementation.
- One named phase per branch and one draft PR to `main`.
- Review corrections remain on the same phase branch and PR.
- No stacked phase PRs unless Luca explicitly authorises an exception.
- Each new phase starts from current `main` containing every explicitly accepted and merged predecessor.
- No auto-merge. No merge without Luca's explicit current instruction.
- Only one modifying workflow may operate on the repository at a time.

### 2.3 Common entry gate

Before every write, ChatGPT verifies through Drive and GitHub:

- current project status, exact authorised operation and stopping condition;
- repository `lucakollmer/opening-trainer` unless explicitly superseded;
- repository visibility as an observed fact, without changing it;
- target branch, base SHA, current head SHA and draft PR;
- predecessor acceptance and merge evidence in Drive and GitHub history;
- no moved head, conflicting PR, pending correction or overlapping modifying workflow;
- required workflow and action pins;
- no unaccepted decision, credential, data or deployment dependency.

Stop before mutation on mismatch. Old work-request SHAs are expectations to reverify, not authority to rewrite history.

### 2.4 ChatGPT write model

ChatGPT may use the connected GitHub application to create/update bounded files and refs on the authorised phase branch. Prefer coherent tree/commit operations over many unrelated single-file commits. Generated scaffolding may use a temporary modifying workflow only when the named phase explicitly authorises it and the workflow validates the exact final tree before committing.

Never execute issue text, PR comments or arbitrary user content as shell commands. Do not use `pull_request_target` for candidate code. Do not invent secrets or deployment coordinates.

### 2.5 Common GitHub Actions validation

Focused tests run first, followed by the full repository validation sequence. PHASE-0 currently establishes:

```text
pnpm install --frozen-lockfile
pnpm validate
```

`pnpm validate` covers repository integrity, lint, strict TypeScript, deterministic tests, production build, generated PWA checks and formatting. Later phases may add browser-functional commands only when the responsible phase accepts the dependency and test harness.

Every required run must:

- test the exact candidate head/tree;
- use least-privilege permissions;
- use immutable reviewed action pins;
- use frozen dependency installation and bounded timeouts/concurrency;
- report workflow/run ID, tested SHA, job/step conclusions and exact command results;
- publish bounded error tails on failure;
- publish relevant build/preview/screenshot/report artifacts;
- never auto-merge.

Local or Codespaces execution is optional debugging evidence. GitHub Actions is the programme's technical evidence source for cloud-compatible phases.

### 2.6 Preview and state-space evidence

Visible phases require production-build smoke and agreed desktop/tablet/phone screenshots or a separately accepted PR preview provider. Automated screenshots prove deterministic rendering, not visual quality or interaction feel. Luca owns visible acceptance.

State claims name the initial state: empty database, existing data, migrated schema, invalid import, offline reload, service-worker update, or other relevant condition. A seeded-state test never substitutes for first-run evidence.

### 2.7 Common report

Follow `docs/workflow/STRUCTURED_REPORT_TEMPLATE.md` and `AGENTS.md`. The report includes exact refs, every changed path once, dependency/licence/data effects, Actions runs/results/artifacts, preview/state evidence, reuse and duplication audits, rollback, manual checklist and exact next action. End with `END_OF_COMPLETION_REPORT`.

### 2.8 Common acceptance rule

Technical completion authorises manual review only. It never authorises merge or the next phase. Luca reports the manual result and explicitly accepts or rejects the exact PR head. Acceptance and merge are separate operations unless Luca explicitly combines them.

---

# GOVERNANCE-MIGRATION - Adopt ChatGPT + GitHub Actions

## Goal

Replace the historical local-Codex repository operating layer with the accepted ChatGPT + GitHub Actions workflow without replacing or reimplementing PHASE-0 product code.

## Branch and PR

```yaml
branch: phase-0-foundation
pull_request: 2
base_branch: main
expected_base_sha: 87ccbce18384892601a6630494910e1ca0375f13
expected_pre_migration_head: 5477419fce1f13f4265ab82d6ee3058d851b5019
```

All mutable values must be reverified. A mismatch blocks mutation until explained.

## Scope

Execute `WORKFLOW_MIGRATION.md`: replace stale authority/handoff files, add `docs/workflow/` and the immutable migration request, remove only named deprecated Codex paths, preserve the application candidate and `.github/workflows/ci.yml`, regenerate the repository full-tree integrity manifest with the existing project updater, and run permanent validation on the exact new head.

## Acceptance criteria

- no PHASE-0 application, dependency, lockfile, test or configuration regression;
- no stale repository instruction that treats Actions as incidental or makes the previous local-executor policy authoritative;
- no root `CODEX_*` or `docs/codex/` execution authority remains;
- permanent Actions validation passes on the exact new head;
- PR #2 is updated, still draft and unmerged;
- PHASE-0 remains `COMPLETE_FOR_MANUAL_REVIEW` with the same four-item manual checklist;
- no merge or PHASE-1.

## Rollback

Revert the single governance-migration commit on `phase-0-foundation`. Do not rewrite `main`, discard PHASE-0 code, or delete review evidence.

---

# PHASE-0 - Repository and application foundation

## Current status

PHASE-0 is already implemented and technically validated. Do not rerun its scaffold.

```yaml
base_sha: 87ccbce18384892601a6630494910e1ca0375f13
branch: phase-0-foundation
validated_head_before_governance_migration: 5477419fce1f13f4265ab82d6ee3058d851b5019
pull_request: 2
pull_request_state: open, draft, unmerged
permanent_validation_run: 30906801969
permanent_validation_result: success
review_artifact_id: 8891213897
review_artifact_digest: sha256:ac68b340c909073115c64ff3f989bd39c324492564c90f71e7080fb67a74a34d
gate: COMPLETE_FOR_MANUAL_REVIEW
```

The governance migration will create a later head on the same branch. The final accepted head must have green permanent validation and preserve the implemented scope below.

## Implemented scope to preserve

- Node 24 and exact pnpm package-manager lock;
- React, TypeScript and Vite root application;
- Material UI and MUI X Community integration shell;
- `react-chessboard`, `chess.js`, Dexie/fake-indexeddb and `ts-fsrs` adapter smoke boundaries;
- strict TypeScript, ESLint, Prettier and Vitest/jsdom gates;
- generated PWA manifest/service-worker proof;
- dependency/licence record and locked transitive graph;
- permanent read-only `.github/workflows/ci.yml` validation;
- no real training behaviour, repertoire graph, production persistence schema or scheduling policy.

## Required Actions evidence after governance migration

The current `ci.yml` runs against the new branch head and passes repository integrity, lint, strict type checking, tests, production build, PWA checks, formatting and whitespace. No dependency change is expected.

## Manual checklist for Luca

1. Run `pnpm install --frozen-lockfile && pnpm dev`; expected: minimal MUI board/tree/task shell without error overlay; persistence: no production user-data mutation; return console and screenshot evidence on failure.
2. Resize desktop to phone width; expected: no horizontal page scroll; persistence: none; return viewport and overflow evidence on failure.
3. Run `pnpm build && pnpm preview`; expected: the same bounded shell loads; persistence: no deletion; return commands and output on failure.
4. Reload once during preview; expected: no service-worker loop or browser-console error; persistence: documented demo state only; return console/service-worker evidence on failure.

## Gate

Luca explicitly accepts or rejects PHASE-0 at the exact current PR head. Keep PR #2 draft and unmerged. PHASE-1 remains blocked.

---

# PHASE-1 - Responsive board/tree/task training shell

## Goal

Deliver the accepted responsive single-surface UI using standard MUI components, synthetic typed fixture state and no real training persistence.

## Branch

```text
phase-1-responsive-shell
```

## Entry gate

- PHASE-0 explicitly accepted and merged into `main`.
- All PHASE-0 validation passes on current `main`.
- No unresolved foundation correction.

## Required reading

```text
docs/product/PRODUCT_CONTRACT.md
docs/ui/UI_AND_INTERACTION_CONTRACT.md
docs/architecture/ARCHITECTURE.md
docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md
docs/fixtures/FIXTURE_CATALOGUE.md
```

## Required inspection

- inventory PHASE-0 MUI/theme/shell/board/tree/task primitives and tests;
- inspect library APIs and accessible behaviour in installed versions;
- identify exact components to reuse/compose/extend/create;
- record any library limitation before designing around it.

## Scope

### Responsive shell

Implement desktop/tablet/phone composition from the UI contract.

- board-dominant CSS grid;
- persistent/collapsible desktop tree panel;
- task panel alongside board on wide layouts;
- phone board first and task below;
- tree in temporary/swipeable drawer on compact layouts;
- compact top toolbar with synthetic repertoire selector, Train/Browse toggle, due/session status and settings trigger.

### Chessboard adapter

Create a project-owned adapter around `react-chessboard` for:

- position;
- orientation;
- user-turn state;
- move callback;
- last move;
- hint/highlight overlays;
- promotion request boundary;
- disabled/busy state;
- accessible alternative move entry boundary if needed.

Use synthetic fixture commands only; no repertoire grading.

### Repertoire tree view

Use MUI X Tree View Community. Implement a typed tree item projection supporting:

- visible and masked labels;
- current path/current position;
- branch existence without answer label;
- status icon plus text;
- transposition marker;
- auto-scroll/focus of current item where reliable;
- Browse/Train presentation difference.

The answer must be absent from DOM/accessibility metadata when masked.

### Task panel

Implement explicit fixture-driven states defined in the UI contract. Use MUI `Paper/Card/Alert/Typography/Button` compositions.

### Component harness

Provide a development-only fixture selector or Storybook-equivalent only if PHASE-0 conventions already support it without adding a large tool. A simple internal development route is not allowed because no router is accepted; prefer test fixtures or a development panel gated from production.

## Tests

- desktop/phone component composition at representative media queries;
- tree drawer focus restoration;
- Train/Browse masking difference;
- masked answer absent from visible/accessibility DOM and test IDs;
- task-panel state matrix;
- board event emits typed command;
- promotion boundary;
- toolbar controls use shared commands;
- no horizontal overflow in a browser-capable layout test where practical;
- reduced-motion and colour-independent labels where implemented.

## GitHub Actions validation and evidence

Run focused tests and the repository's full `pnpm validate` sequence in GitHub Actions against the exact candidate head. The structured report records workflow/run IDs, tested SHA, job/step conclusions, command results, artifacts and bounded failure tails. Local or Codespaces runs may accelerate debugging but are not the phase evidence source.

Common full sequence plus focused UI tests. Build and preview.

## Manual checklist for Luca

1. Wide desktop: expected board dominant, tree and task panels readable, toolbar compact; persistence: none beyond harmless settings if explicitly implemented; failure evidence: viewport and screenshot/description.
2. Tablet width: expected one secondary panel collapses/reflows without crushing board; persistence: panel state only if documented; failure evidence: width and overlap.
3. Phone width/touch: expected board first, task directly below, tree opens in drawer and returns focus; persistence: none; failure evidence: device/browser and interaction.
4. Train fixture: expected already-played labels visible and future labels masked; persistence: no review evidence; failure evidence: any leaked move in UI, tooltip, screen-reader label or DOM inspection.
5. Browse fixture: expected full labels/navigation with no review state change; failure evidence: labels missing or evidence created.
6. Keyboard/focus: expected visible focus, tree keyboard behaviour, dialog/drawer escape/restore; failure evidence: exact key path.

## Acceptance criteria

- accepted responsive shell and component reuse;
- mask non-disclosure tests;
- no real session/repertoire/database logic hidden in UI;
- GitHub Actions technical validation pass;
- Luca accepts layout, density, focus and interaction feel.

## Non-scope

- real move grading/opponent/session;
- graph/import/database;
- final analytics/settings;
- PWA installation acceptance.

## Rollback

Revert phase branch/PR. No user data schema effects.

## Memory capture

Exact component inventory/reuse decisions, breakpoints, manual result, branch/head/PR and any accepted UI refinements.

---

# PHASE-2 - Deterministic training vertical slice

## Goal

Using FIX-01 and FIX-02, deliver one end-to-end in-memory training loop: complete-line replay, legal move input, deterministic repertoire opponent, masked tree progression, task feedback, hints and immediate repair. No durable review scheduling yet.

## Branch

```text
phase-2-training-vertical-slice
```

## Entry gate

PHASE-1 accepted/merged; responsive UI and masking behaviour are current.

## Required reading

```text
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
docs/domain/REPERTOIRE_DOMAIN_MODEL.md
docs/training/TRAINING_AND_SCHEDULING.md
docs/ui/UI_AND_INTERACTION_CONTRACT.md
docs/fixtures/FIXTURE_CATALOGUE.md
```

## Scope

### In-memory fixture model

Implement the smallest typed contextual line/branch representation needed for FIX-01/FIX-02. Do not prematurely implement PHASE-3 persistence/import graph in full, but align types with the domain contract.

### Chess adapter

Implement legal move application, SAN/UCI display, castling/promotion/en-passant where fixture tests require, position history and canonical position-key algorithm with FIX-07 tests.

### Session reducer

Implement explicit states/events for:

- session start;
- user turn;
- legal move classification;
- opponent turn/delay;
- correct/wrong/illegal feedback;
- hint progression;
- reveal;
- rewind/repair;
- line completion;
- session completion/abandonment.

Reducer is pure. Effects use injected clock/timer/opponent policy.

### Outcome classification

For in-memory fixture contexts, distinguish:

- accepted move;
- illegal move;
- legal outside fixture repertoire;
- known wrong sibling variation.

Multiple accepted moves and full transposition routing are PHASE-3, but the interfaces must permit them.

### Complete-line replay

Start every exercise from initial position. Opponent follows fixture route. Reveal the responded move in the tree and preserve future masking.

### Hints/repair

Implement all hint levels with fixture metadata and immediate repair. Add a delayed same-session retest queue in a minimal deterministic form, without FSRS updates.

### Evidence log

Record raw in-memory observations according to the training contract. Do not convert to FSRS yet.

## Tests

- full correct white line;
- full correct black line/orientation;
- illegal attempt then correct;
- legal outside repertoire;
- wrong sibling variation;
- each hint level and non-disclosure before request;
- reveal and immediate repair;
- delayed same-session retest separated by another exercise/decision;
- session abandon/restart in memory;
- deterministic opponent delay/clock/seed;
- reducer transition table;
- no React ownership of domain transitions.

## GitHub Actions validation and evidence

Run focused tests and the repository's full `pnpm validate` sequence in GitHub Actions against the exact candidate head. The structured report records workflow/run IDs, tested SHA, job/step conclusions, command results, artifacts and bounded failure tails. Local or Codespaces runs may accelerate debugging but are not the phase evidence source.

Common sequence; production build and controlled fixture flow tests.

## Manual checklist

1. Train white fixture from move one: expected opponent replies and correct feedback; evidence: in-memory target/incidental log only; failure: move path and panel text.
2. Make illegal move: expected no position advance and distinct feedback; evidence: illegal attempt count, no full review commit; failure details.
3. Play wrong sibling move: expected variation-confusion feedback, not illegal; evidence: confusion observation; failure details.
4. Use each hint: expected progressive disclosure, no earlier answer leak; evidence: monotonic hint level; failure details.
5. Reveal/wrong target: expected repair and later retest from line start; evidence: original failure plus repair/retest records; failure details.
6. Phone interaction: expected usable touch board/task/tree; no persistence required.

## Acceptance criteria

- working in-memory vertical slice with complete-line rhythm;
- pure reducer and adapter boundaries;
- error/hint/repair semantics correct;
- no Dexie production schema or FSRS update;
- Luca accepts training feel and feedback.

## Non-scope

- PGN import/transpositions/multiple accepted alternatives;
- durable persistence;
- scheduler intervals;
- progress management.

## Rollback

Revert phase PR; no persistent user data effects.

## Memory capture

Accepted training rhythm, state machine, outcome semantics, manual result, branch/head/PR, deviations and next gate.

---

# PHASE-3 - Repertoire graph, transpositions, playlists and PGN import

## Goal

Replace fixture-line assumptions with the canonical contextual repertoire graph, visible tree projections, multiple accepted moves, transpositions, playlists and transactional PGN import preview/commit.

## Branch

```text
phase-3-repertoire-domain-import
```

## Entry gate

PHASE-2 accepted/merged; training reducer contracts stable enough to consume domain queries.

## Required reading

```text
docs/domain/REPERTOIRE_DOMAIN_MODEL.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
docs/storage/OFFLINE_DATA_AND_PORTABILITY.md
docs/fixtures/FIXTURE_CATALOGUE.md
docs/dependencies/DEPENDENCY_AND_LICENSE_POLICY.md
```

## Mandatory parser decision

Inspect the installed `chess.js` PGN API and tests. Determine whether it preserves recursive annotation variations, comments and required source locations.

- If adequate, use it through a project adapter.
- If not, evaluate a maintained focused PGN parser under the dependency policy, record licence/size/reason and wrap it.
- Never silently flatten recursive variations.

## Scope

### Canonical graph

Implement positions, edges, contexts and contextual moves per the domain contract. Enforce uniqueness/integrity and deterministic IDs/order where required.

### Tree projection

Project contextual tree occurrences, current path, masking state, learning placeholders and transposition markers. Preserve PHASE-1 UI contracts.

### Accepted alternatives

Return normalized accepted move sets. Update the session to accept any valid move, replan continuation, and schedule/return a replacement target when an alternative diverts from the selected deep target.

### Transpositions

Implement FIX-03/FIX-04. Share position nodes, conditionally share normal-mode training identity metadata, preserve strict/contextual separation.

### Playlists

Implement pure playlist filtering by repertoire/context inclusion, colour, tags and max depth. Keep weighting simple and scheduler-independent.

### PGN import

- local file/text input;
- parse to isolated candidate;
- legal graph construction;
- variation/comment/NAG policy;
- preview summary and warnings;
- create-new-repertoire commit transaction interface;
- merge may be deferred unless safely specified;
- provenance/hash/parser version;
- cancellation/parse failure produces no mutation.

Persistence may use a temporary/in-memory repository or the minimal Dexie layer necessary for import commit; PHASE-4 owns full durable schema/migrations. Do not scatter provisional writes.

### Training integration

Run vertical slice against graph queries, multiple alternatives and transpositions.

## Tests

- every domain invariant in `REPERTOIRE_DOMAIN_MODEL.md`;
- FIX-01–FIX-10;
- deterministic tree projection;
- accepted alternative preserves/diverts target correctly;
- transposition sharing/non-sharing;
- same position/different castling not merged;
- recursive PGN preserved or explicit pre-commit unsupported error;
- illegal PGN location/report;
- duplicate branch consolidation;
- import preview/commit/cancel atomicity;
- playlist filters;
- no answer leakage after graph integration.

## GitHub Actions validation and evidence

Run focused domain/component/infrastructure tests and the repository full `pnpm validate` sequence in GitHub Actions against the exact candidate head. Record workflow/run IDs, tested SHA, command results, artifacts, state isolation and bounded failure tails. Use synthetic fixtures and isolated databases. Local/Codespaces runs are optional debugging evidence.

## Manual checklist

1. Import recursive synthetic PGN: preview shows expected lines/variations/comments/warnings; commit creates one repertoire; failure evidence file/report.
2. Cancel preview: no repertoire/data change.
3. Train position with two accepted moves: both accepted and continuation replans; data result records chosen branch without false error.
4. Exercise transposition: expected tree marker/path and correct shared/separate behaviour from fixture; failure evidence path/item IDs.
5. Edit playlist inclusion: expected training excludes branch; persisted result according to temporary/current repository boundary documented.
6. Browse imported tree at desktop/phone.

## Acceptance criteria

- canonical graph/context model and import boundary;
- recursive variations not silently lost;
- alternatives and transpositions correct;
- playlist filtering;
- vertical slice runs on domain model;
- Luca accepts import preview/tree semantics.

## Non-scope

- full production database migration/backup;
- FSRS scheduling;
- advanced repertoire editor or drag/drop;
- remote explorer API.

## Rollback

Revert PR. Any phase-only development database must be clearly disposable and exportable if manual testing created content.

## Memory capture

Parser/dependency decision, canonical schemas/keys, transposition policy, import warnings, branch/head/PR, validation/manual results.

---

# PHASE-4 - Offline persistence, recovery and portability

## Goal

Make user repertoire, playlists, sessions and raw review evidence durably local with Dexie; add tested schema/migrations, interrupted-session idempotency, complete JSON export and transactional restore.

## Branch

```text
phase-4-offline-persistence
```

## Entry gate

PHASE-3 accepted/merged; canonical domain/import shapes accepted.

## Required reading

```text
docs/storage/OFFLINE_DATA_AND_PORTABILITY.md
docs/domain/REPERTOIRE_DOMAIN_MODEL.md
docs/training/TRAINING_AND_SCHEDULING.md
docs/architecture/ARCHITECTURE.md
docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md
```

## Scope

### Dexie schema

Implement explicit initial production schema and indexes from actual query needs. Document table ownership and schema version.

### Repositories/transactions

Implement typed repository/use-case operations. Move any provisional PHASE-3 storage behind these ports. No UI direct table writes.

### Boot and first run

- truly absent database creates current schema;
- clear empty/import/demo state;
- no review creation from browsing;
- isolated database name per environment/test.

### Durable session/review evidence

Persist session state, target IDs, seed/policy, pending repairs and committed observation IDs. Review commit is idempotent across crash/reload.

### Backup export

Implement complete versioned JSON export with stable ordering where practical and all semantic tables/settings/scheduler-neutral raw evidence.

### Restore

Preview and validate into staging; show counts/warnings/version; commit atomically; post-commit integrity check; invalid/future/corrupt backup leaves active database unchanged.

### PGN portability

Add repertoire-only PGN export where representable and clearly label it incomplete for review history/settings.

### Recovery UI

Use MUI dialogs for export/import/restore confirmation and errors. No custom file-manager UI.

## Tests

- absent database first run;
- repository CRUD/query transactions;
- graph import commit across tables;
- branch inclusion/training-item effects atomic;
- interrupted session reload;
- duplicate observation commit prevented;
- complete populated export;
- clean restore canonical equivalence using FIX-11;
- invalid/future backup rejection with no mutation;
- simulated transaction failure rollback;
- schema migration fixture when schema changes during phase;
- cache/data reset distinction at API level.

## GitHub Actions validation and evidence

Run focused tests and the repository's full `pnpm validate` sequence in GitHub Actions against the exact candidate head. The structured report records workflow/run IDs, tested SHA, job/step conclusions, command results, artifacts and bounded failure tails. Local or Codespaces runs may accelerate debugging but are not the phase evidence source.

Common sequence plus repository/round-trip tests. Run browser reload smoke using isolated profile/harness if available.

## Manual checklist

1. Import/create repertoire, reload browser: visible tree/playlist remains; database counts/IDs stable.
2. Begin session, interrupt/reload: expected recovery or explicit abandon prompt; no duplicate review observation.
3. Export complete JSON: file clearly versioned and includes repertoire/reviews/settings; no secret data.
4. Restore into clean profile/database: same canonical content/progress; source database unchanged.
5. Attempt invalid/future backup: clear rejection; active data unchanged.
6. PGN export: repertoire moves/variations represented; UI states it is not complete backup.

## Acceptance criteria

- durable local data and transactions;
- complete tested portable backup/restore;
- crash/reload idempotency;
- no silent destructive reset;
- Luca accepts recovery/import/export flow.

## Non-scope

- cloud sync/accounts;
- FSRS interval application;
- service-worker update/offline release hardening;
- native filesystem plugins.

## Rollback

Revert PR. Before testing rollback against manually created data, export the phase database. Never instruct automatic deletion of unknown browser data.

## Memory capture

Exact Dexie schema/version, database name, backup version, restore strategy, idempotency keys, branch/head/PR, validation/manual results.

---

# PHASE-5 - FSRS adapter and adaptive session generator

## Goal

Implement the versioned chess-to-FSRS adapter, scheduler state persistence, due/new/weak candidate selection, targeted versus incidental evidence, branch/prefix balancing, same-session repair/retest and deterministic simulations.

## Branch

```text
phase-5-fsrs-session-generator
```

## Entry gate

- PHASE-0 through PHASE-4 explicitly accepted and merged into fetched `main`.
- The current database schema and complete backup/restore are accepted.
- Canonical training-item identity and raw review evidence are present.
- No unresolved data-loss or duplicate-review defect.

## Required reading

```text
docs/training/TRAINING_AND_SCHEDULING.md
docs/domain/REPERTOIRE_DOMAIN_MODEL.md
docs/storage/OFFLINE_DATA_AND_PORTABILITY.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md
docs/fixtures/FIXTURE_CATALOGUE.md
```

## Mandatory pre-implementation audit

1. Inspect installed `ts-fsrs` API/version/licence and its serialization requirements.
2. Inventory raw observation types and persisted training-item fields from PHASE-4.
3. Verify no UI component currently assigns FSRS grades directly.
4. Verify clocks, seeds and response timing are injectable.
5. Build a simulation plan before changing scheduler state.
6. Identify schema migration/backup-version impact before writing data.

Stop if PHASE-4 cannot preserve old raw observations during the migration.

## Scope

### Scheduler port and adapter

Implement project-owned scheduler types and `ts-fsrs` adapter. The rest of the app does not import `ts-fsrs` directly.

Persist:

- project scheduler state;
- adapter/library version;
- policy/mapping version;
- due time;
- stability/difficulty/repetition/lapse fields needed for exact round trip;
- raw observation and resulting scheduler decision separately.

Add a tested migration from PHASE-4 training items. Update complete backup version/schema and round-trip tests.

### Chess observation mapping

Implement a versioned policy from the training contract. Initial policy must explicitly handle:

- instant correct;
- ordinary correct;
- hesitant correct;
- each hint level;
- full reveal;
- wrong sibling variation;
- legal outside repertoire;
- illegal attempts plus eventual outcome;
- repair-correct;
- new versus mature item restrictions on Easy.

No component may directly select `Again/Hard/Good/Easy`.

### Response-time policy

Use injected monotonic durations. Define conservative configurable bands with tests. Avoid one universal magic threshold; allow item/state-aware or simple documented bands. Store the evidence used.

### Targeted/incidental policy

- Targeted observations may update FSRS.
- Positive incidental observations are stored but do not extend FSRS intervals in MVP.
- Incidental failure queues/promotes a targeted review and records weakness/confusion.
- Traversing a mature prefix repeatedly cannot multiply its interval.
- A target may still fail even if the containing line later completes after repair.

### Candidate selection

Create a deterministic session generator heuristic with explicit version:

1. pending same-session repair/retest obligations according to separation rules;
2. overdue/due failed or weak items;
3. ordinary due items;
4. bounded new items;
5. contrast candidates where eligible;
6. optional non-due reinforcement only when session settings allow.

Score/tie-break using due time, retrievability, recent failure, branch coverage, target depth, repeated-prefix cost, recent exercise cooldown and seeded stable tie-breaker.

Document formula/ordering. Do not use an opaque optimizer.

### Route batching and prefix cost

Permit an exercise to cover several explicitly targeted decisions on one route when efficient. Record targets before play. Do not grant full review merely because a due item was traversed incidentally.

Avoid consecutive exercises with identical long prefixes when equally urgent alternatives exist. Preserve accepted complete-line replay; do not silently start from an isolated deep position.

### Accepted alternative handling

When a valid accepted move diverts from selected targets:

- score any target actually answered at that position;
- replan reachable remaining targets;
- create replacement exercise tickets for displaced targets;
- do not mark valid move wrong;
- keep deterministic session count/accounting.

### Same-session repair/retest

Implement minimum separation, maximum attempts and unresolved-session summary. Original failure, repair and retest remain separate evidence. A repair does not erase lapse.

### Contrast candidates

Aggregate wrong-variation confusion relations. Use a documented threshold/time window to create contrast eligibility. The full contrast UI may remain minimal until PHASE-6, but generator/domain tests and a bounded task-panel flow are required.

### User/session settings

Support bounded settings:

- target item count or approximate duration;
- new-item limit;
- desired retention only if the installed FSRS adapter safely exposes it and UX remains bounded;
- opponent delay independent of scheduler;
- strict/guided/normal mode filtering.

Do not expose raw FSRS internals as routine UI.

### Statistics/summary

Update line/session summary with targeted outcomes, hints, confusions, repaired/unresolved and next due indications. Do not create a rating/gamification score.

## Required simulations

Use injected fixed clocks/seeds. Provide readable simulation fixtures/reports for:

1. new item: Again, Hard, Good and conservative Easy;
2. mature instant correct;
3. hesitant correct;
4. each hint cap;
5. full reveal, immediate repair, delayed retest;
6. wrong sibling variation and contrast eligibility;
7. legal outside repertoire;
8. several illegal attempts then correct;
9. 20 repeated positive incidental prefix traversals with no FSRS interval inflation;
10. incidental negative promotion to target;
11. deep due item with long mature prefix;
12. several due targets sharing one route;
13. two equally urgent branches with prefix balancing;
14. accepted alternative preserving target;
15. accepted alternative displacing target and replacement exercise;
16. equivalent transposition sharing item;
17. strict/contextual transposition not sharing;
18. interrupted review commit/reload idempotency;
19. backup export/restore preserving scheduler state and raw evidence;
20. policy-version migration/replay boundary.

Do not assert exact future interval numbers unless they are observed from the locked dependency and intentionally part of the adapter contract. Prefer invariant/range/snapshot tests tied to policy version.

## UI scope

Use existing task/session/progress components. Add only:

- due/new/session settings needed to start a scheduled session;
- concise next-due/session summary;
- minimal contrast prompt state;
- clear unresolved repair state.

No dashboard or detailed charts.

## Reusable UI/UX inventory

The report must map every UI addition to current MUI/project primitives. Scheduling logic remains outside React. Any new session settings composition is shared rather than duplicated in toolbar/dialog surfaces.

## GitHub Actions validation and evidence

Run focused tests and the repository's full `pnpm validate` sequence in GitHub Actions against the exact candidate head. The structured report records workflow/run IDs, tested SHA, job/step conclusions, command results, artifacts and bounded failure tails. Local or Codespaces runs may accelerate debugging but are not the phase evidence source.

- focused scheduler/unit simulations;
- persistence migration/backup round trip;
- full common sequence;
- production build;
- deterministic fixture session smoke;
- first-run with existing PHASE-4 database migration;
- clean new database;
- interrupted session reload;
- `git diff --check` and duplication audit.

## Manual checklist for Luca

1. Start a due session with mixed new/due items; expected visible order feels coherent and starts each exercise from initial position; persisted result: only targeted items receive full scheduler updates, review log records policy version; failure evidence: exported debug/session report and item IDs.
2. Repeat deep lines sharing a prefix; expected no tedious identical-prefix run when alternatives exist; persisted result: prefix items' due/stability do not inflate from incidental positives; failure evidence: before/after item export.
3. Use a hint and full reveal; expected feedback/repair/retest flow; persisted result: raw hint/failure/repair/retest observations and scheduler grade caps; failure evidence: item review log.
4. Play wrong sibling variation twice/threshold case; expected distinct confusion and later contrast candidate; persisted result: confusion relation/eligibility; failure evidence.
5. Choose an accepted alternative that diverts from selected target; expected no false error and replacement exercise later; persisted result: answered item scored, displaced target remains/returns due; failure evidence.
6. Interrupt during/after a target and reload; expected recoverable session with no duplicate scheduler update; persisted result: one idempotent review commit; failure evidence counts/IDs.
7. Export and restore backup into clean profile; expected same due queue/next dates; persisted result: scheduler/raw evidence canonical equality; failure evidence diff.
8. Review session summary; expected understandable outcomes without raw FSRS jargon or game score.

## Acceptance criteria

- all required simulations pass;
- scheduler dependency isolated behind port;
- mapping/policy versioned and documented;
- raw evidence retained;
- targeted/incidental policy enforced;
- deterministic adaptive generator and prefix balancing;
- migration/backup compatibility;
- same-session repair/retest and accepted alternatives correct;
- no UI-owned grading;
- Luca accepts session selection and review rhythm.

## Non-scope

- FSRS parameter optimisation from a large personal history;
- cloud sync;
- push notifications/background reviews;
- extensive analytics dashboard;
- engine-driven difficulty;
- changing complete-line replay principle.

## Rollback

Before manual testing, create a PHASE-4-compatible complete export. Rollback code by reverting/closing the phase PR. Do not downgrade/mutate a real migrated database automatically; provide restore-from-export instructions and retain migration/version evidence.

## Assistant Memory capture proposal

Record exact `ts-fsrs` version/API, scheduler serialization and policy versions, mapping table, simulation outcomes, schema/backup migration, generator heuristic, manual result, branch/head/PR and accepted next gate.

---

# PHASE-6 - Repertoire management, progress and opening-name recall

## Goal

Complete practical Browse/manage workflows, playlists/branch inclusion/notes, decision-level progress summaries, contrast drill UX and separately scheduled opening-name recall.

## Branch

```text
phase-6-repertoire-management
```

## Entry gate

PHASE-5 accepted/merged; scheduler/session semantics stable.

## Required reading

Product, UI, domain, training, storage and test contracts.

## Scope

- Browse mode full tree navigation with board synchronisation and no review evidence;
- repertoire list/create/rename/archive;
- branch inclusion/exclusion and notes/purpose editing;
- playlist create/edit/archive with bounded filters;
- import history/warning view and repertoire-only PGN export;
- branch/decision progress summaries: new/learning/due/mature, weak descendants, never-trained;
- confusion list and complete contrast drill UI;
- opening-name metadata and separate name-recall training items/scheduling;
- settings/import/export entry points consolidated without a dashboard;
- empty/loading/error/archive states.

Do not implement drag-and-drop tree editing unless measured need and Community component support make it trivial; branch ordering may remain source/deterministic.

## Tests

- browse never writes review evidence;
- management transactions and archived references;
- branch inclusion effect on sessions without historical review loss;
- playlist filters/weights;
- notes hidden/revealed correctly;
- progress derived from weakest/deep decisions;
- name items independent from move items;
- contrast flow and scheduling separation;
- import/export/management responsive/accessibility tests;
- no duplicate dialog/selector/state patterns.

## GitHub Actions validation and evidence

Run focused domain/component/infrastructure tests and the repository full `pnpm validate` sequence in GitHub Actions against the exact candidate head. Record workflow/run IDs, tested SHA, command results, artifacts, state isolation and bounded failure tails. Use synthetic fixtures and isolated databases. Local/Codespaces runs are optional debugging evidence.

## Manual checklist

Create/manage repertoire and playlist; include/exclude branch; browse board/tree; edit note and confirm hint reveal; inspect progress with weak deep item; complete name recall without altering move interval; complete contrast drill; archive/restore; phone workflow.

Each item includes persisted results and failure evidence in the completion report.

## Acceptance criteria

Practical repertoire ownership and progress without dashboard sprawl; separate name scheduling; Luca accepts management/navigation clarity.

## Non-scope

Remote catalogue/explorer, collaboration, coach tools, paid content, advanced analytics.

## Rollback

Complete backup before testing; revert PR; preserve/export any manually created data.

## Memory capture

Accepted management/progress/name/contrast behaviours, schemas, manual result, branch/head/PR.

---

# PHASE-7 - PWA, mobile, accessibility and operational hardening

## Goal

Prove installable/offline/update behaviour, add browser-functional coverage, harden mobile/touch/keyboard/accessibility, and establish release-grade local data safety.

## Branch

```text
phase-7-pwa-hardening
```

## Entry gate

PHASE-6 accepted/merged; core feature set frozen for hardening.

## Required reading

UI, storage, testing, dependency and architecture contracts.

## Scope

### PWA

- final manifest/name/icons/theme/display settings with licensed/original assets;
- explicit service-worker update strategy and UI;
- offline app-shell reload after first load;
- IndexedDB preserved across app update;
- cache reset separate from data reset;
- graceful unsupported-install environment;
- optional persistent-storage request/status where supported.

### Browser functional suite

Add Playwright (or accepted equivalent) and cover synthetic core flows at desktop and mobile viewport:

- first run empty state;
- import fixture;
- Train correct/error/hint/repair;
- accepted alternative/transposition;
- reload/persistence;
- export/restore clean profile;
- offline reload;
- service-worker update harness where practical;
- Browse/manage/name/contrast smoke;
- keyboard route and answer masking DOM audit.

No screenshot pixel-diff gate is required. Luca owns visual acceptance.

### Accessibility

- automated axe-style checks if a small compatible tool is accepted;
- keyboard/focus audit;
- board alternative move-entry route when needed;
- live-region audit;
- masked-answer accessible-tree audit;
- touch target and orientation tests;
- reduced-motion;
- colour-independent status.

### Performance/large fixtures

Use bounded synthetic datasets to identify obvious tree/import/session bottlenecks. Add virtualization only if measured and available under accepted Community/licence boundaries.

### Recovery

Document browser data backup/reset/update recovery. Test quota/transaction failure handling through fakes where possible.

## GitHub Actions validation and evidence

Run focused tests and the repository full validation in GitHub Actions against the exact candidate head. Record run IDs, tested SHA, command results, browser artifacts and bounded failure tails. Local/Codespaces execution is optional debugging evidence.

Common sequence plus `pnpm test:e2e`, `pnpm test:pwa`, clean browser profiles, offline mode and production build/preview. Record tested browsers/environments and omissions honestly.

## Manual checklist

Install on desktop/mobile where supported; first load/import/train; offline relaunch; update to new build without data loss; touch board/drawer; keyboard/focus/screen reader spot check; export before/reset/restore; unsupported install fallback.

## Acceptance criteria

Functional PWA installation/offline/update and robust accessible responsive flow; data preserved; browser suite passing; Luca accepts real-device experience.

## Non-scope

Native wrapper/app stores, cloud sync, notifications, remote telemetry.

## Rollback

Preserve backup; unregister/revert service-worker code through release rollback guidance; do not clear IndexedDB.

## Memory capture

Manifest/update policy, browser matrix, accessibility decisions, performance observations, manual device results, branch/head/PR.

---

# PHASE-8 - Release candidate, deployment and packaging decision

## Goal

Create a reproducible release candidate, deploy the PWA to an accepted static host, verify recovery/documentation, and make an explicit evidence-based PWA-only versus Capacitor decision without automatically adding native projects.

## Branch

```text
phase-8-release-candidate
```

## Entry gate

PHASE-7 accepted/merged; hosting target and repository deployment authority explicitly supplied by Luca.

## Mandatory decisions before mutation

- public/private access expectation;
- hosting provider/domain/base path;
- deployment credential handling outside repository;
- release/version convention;
- privacy statement scope;
- whether the PWA is sufficient for current use;
- concrete unmet requirement, if any, motivating Capacitor.

Stop if deployment authority/coordinates are absent. Documentation-only packaging comparison may proceed, but no guessed deployment.

## Scope

- version/release notes/changelog;
- production build reproducibility;
- static-host configuration and base-path validation;
- deployment documentation and rollback;
- full clean-profile acceptance suite against release build;
- backup/restore and update-from-previous-build test;
- dependency/licence inventory and notices;
- user guide: import, train, browse, export, recovery, update;
- maintenance guide: local development, validation, schema/backup versions;
- PWA/native packaging decision record.

### Packaging decision

Recommend PWA-only unless real evidence requires native capabilities/distribution. Compare:

- install/discovery needs;
- offline/storage behaviour;
- file import/export;
- background/notification requirements;
- app-store requirement;
- maintenance/release cost.

Capacitor setup is a separate post-MVP phase requiring Luca's explicit acceptance. PHASE-8 does not install it by default.

## GitHub Actions validation and evidence

Run the release suite in GitHub Actions against the exact candidate/release head and publish the release artifact inventory, hashes, browser evidence and structured report. Deployment execution requires the accepted provider/credential boundary.

- clean clone/install/validate/build;
- release artifact hash/inventory;
- static server/base path;
- clean first launch;
- populated previous build update to release build without data loss;
- offline release launch;
- complete backup/restore;
- licence notice check;
- all automated/browser suites;
- `git diff --check` and clean tree.

## Manual checklist

Use deployed release on desktop and mobile, install where supported, import/train/offline/update/export/restore, inspect user docs/privacy/licences, decide PWA sufficiency.

## Acceptance criteria

Reproducible deployable release candidate, documented recovery/rollback, Luca release acceptance, explicit packaging decision. No claim of production launch until Luca confirms deployment/manual results.

## Rollback

Document exact prior deployment restoration and service-worker cache update implications. Never roll back by deleting IndexedDB.

## Memory capture

Release version/artifact/deployment coordinates, validation/device results, licence inventory, packaging decision, known limitations and post-MVP next action.

---

# Post-MVP roadmap — not execution-authorised

Potential separately accepted programmes:

- Capacitor/native packaging;
- optional cloud sync and multi-device conflict resolution;
- opening-explorer-assisted branch prioritisation;
- shared/coach repertoires;
- notifications/background reminders;
- richer analytics;
- engine-assisted optional explanation/novelty workflows;
- public repertoire/catalogue features.

Do not implement these under an MVP phase.

## Final programme stop rule

Completion of a phase authorises only review and acceptance of that phase. It never implicitly authorises merge, the next phase or a post-MVP programme.
