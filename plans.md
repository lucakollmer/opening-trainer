# plans.md — Opening Trainer MVP programme

## 0. Active instruction to Codex

Read every file listed in `AGENTS.md` before changing the repository.

Implement only the phase explicitly named by Luca. If Luca says only `start`, execute:

```text
PHASE-0 — Repository and application foundation
```

A command such as `continue with phase 5` authorises PHASE-5 only, and only when PHASE-0 through PHASE-4 have been explicitly accepted and their accepted commits are present in fetched `origin/main`.

Do not implement more than one phase in a branch or pull request. Do not mark a phase accepted in `context.md`, merge its PR or begin the next phase without Luca's explicit instruction.

## 1. Programme outcome

The MVP programme delivers:

- a tested React/TypeScript/Vite application;
- responsive Material UI shell with board, repertoire tree and task panel;
- deterministic complete-line training from the initial position;
- transposition-aware repertoire graph and tree projection;
- multiple accepted moves and contextual training items;
- PGN repertoire import with explicit variation support/warnings;
- local Dexie persistence and complete portable JSON backup/restore;
- FSRS-based scheduling behind a chess-specific adapter;
- guided learning, hints, repair, targeted/incidental evidence and contrast support;
- repertoire management, playlists, progress and separate name recall;
- installable/offline PWA behaviour and accessibility hardening;
- a release candidate with documented deployment and a native-packaging decision.

## 2. Programme-wide execution model

### 2.1 Branch and PR model

- `main` is the integration branch.
- One phase per branch and one draft PR to `main`.
- Phase branch names are fixed below unless a verified naming conflict requires a reported alternative.
- Review corrections remain on the same phase branch/PR.
- No stacked phase PRs.
- A phase begins from fetched `origin/main` after every accepted predecessor has been merged.
- No merge without Luca's explicit instruction.

### 2.2 Common entry gate

Before every phase:

```powershell
git status --short --branch
git remote -v
git fetch --all --prune --tags
git rev-parse origin/main
git log -1 --oneline origin/main
```

Verify:

- repository is `lucakollmer/opening-trainer` unless Luca changed it explicitly;
- working tree contains no unexpected changes;
- current branch/base is known;
- predecessor acceptance is recorded in current authority;
- predecessor accepted commit is in `origin/main`;
- no open correction remains for the predecessor;
- the selected phase has not already been implemented on another branch/PR.

Stop before mutation on mismatch.

### 2.3 Common validation

Run focused tests first. Then use the repository scripts established by PHASE-0. Intended common sequence:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec prettier --check .
git diff --check
```

Add `pnpm test:pwa`, `pnpm test:e2e` or other scripts only after the responsible phase creates them.

Before completion:

- inspect `git diff --stat` and `git diff --name-only`;
- audit scope and dependency changes;
- search for duplicated components/state machines/listeners/hard-coded theme values when UI changed;
- verify no secrets, private repertoire or unlicensed content;
- commit intentionally;
- verify clean tree;
- push branch and create/update one draft PR.

### 2.4 Common report

Follow `docs/codex/COMPLETION_REPORT_TEMPLATE.md` and `AGENTS.md`. Every manual checklist item includes action, expected visible result, expected persisted/domain result and failure evidence.

### 2.5 Common acceptance rule

Technical completion authorises manual review only. It never authorises merge or the next phase. Luca reports the manual result and explicitly accepts/rejects the phase.

---

# PHASE-0 — Repository and application foundation

## Goal

Create a clean, reproducible React/TypeScript/Vite/pnpm foundation, install and record the accepted dependency stack, establish architecture folders and quality gates, and prove a minimal library-integration shell without implementing the training product.

## Branch

```text
phase-0-foundation
```

Base:

```text
origin/main containing this agentic pack only
```

## Entry gate

- This pack is committed and pushed on `main`.
- `node scripts/verify-pack.mjs` passes before application scaffolding.
- No application implementation already exists except deliberately committed pack files.
- Node 24 LTS and pnpm are available.

## Required reading

```text
AGENTS.md
context.md
CODEX_PROMPT_PROFILE.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
docs/ui/UI_AND_INTERACTION_CONTRACT.md
docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md
docs/dependencies/DEPENDENCY_AND_LICENSE_POLICY.md
```

## Required repository inspection

- confirm repository root and default branch;
- inspect every existing file because the initial repository is intentionally small;
- verify pack hashes and line-ending rules;
- record exact Node, npm and pnpm versions;
- inspect current package metadata/licences for each candidate before installing.

## Scope

### Application scaffold

Establish a Vite React TypeScript application at repository root without overwriting the agentic pack.

Required baseline:

- `package.json` and `pnpm-lock.yaml`;
- Vite config;
- strict TypeScript configuration;
- React entry point;
- MUI theme/provider;
- Vitest/jsdom and Testing Library;
- ESLint current flat configuration where compatible;
- Prettier configuration;
- scripts for `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `test:pwa` placeholder/real manifest check as appropriate, `validate`;
- `.editorconfig`, `.gitattributes`, `.gitignore` preserved/refined;
- no router or global state library.

### Dependencies

Install current compatible stable versions and record exact resolved versions/licences for:

```text
react
react-dom
vite
TypeScript
Material UI and Emotion peers
MUI icons
MUI X Tree View Community
react-chessboard
chess.js
Dexie and dexie-react-hooks
ts-fsrs
vite-plugin-pwa
Vitest and Testing Library stack
fake-indexeddb
ESLint/TypeScript ESLint
Prettier
```

A small runtime schema library may be added only with explicit justification in the PR/report and licence record.

### Architecture skeleton

Create the folders from `ARCHITECTURE.md` with small index/readme files only where useful. Avoid empty speculative abstractions.

Create project-owned ports/types sufficient to prove compilation boundaries, without implementing repertoire or scheduler behaviour.

### Minimal integration shell

Render a minimal MUI application shell that proves:

- theme provider works;
- a placeholder board adapter can render `react-chessboard` in a bounded area;
- a placeholder MUI Tree View renders synthetic non-answer data;
- a placeholder task card renders;
- layout is not the final PHASE-1 UI.

Instantiate `chess.js` in a focused adapter test. Instantiate a test Dexie database with fake IndexedDB. Instantiate the scheduling adapter boundary without committing policy.

### PWA foundation

Configure a valid development/production manifest and basic service-worker generation using `vite-plugin-pwa`, but defer update UX, offline acceptance and full icons to PHASE-7.

### Documentation

Update:

- `context.md` with observed environment and PHASE-0 technical state proposal, not acceptance;
- dependency licence/version record;
- architecture document only for verified deviations;
- root README with install/dev/validate commands.

## Reusable UI/UX inventory and reuse decisions

Codex must report a map for toolbar/shell/tree/task/card/board placeholders. All ordinary controls use MUI. The board is the only specialised visual primitive. Do not build custom alternatives.

## Tests

At minimum:

- application renders under theme;
- error boundary or boot state test;
- chess adapter legal move smoke;
- canonical position-key test skeleton includes at least one real invariant;
- Dexie isolated create/read/delete smoke with fake IndexedDB;
- scheduler port adapter construction/serialization smoke without asserting final mapping;
- manifest/build configuration check;
- pack verifier remains passing.

## Local validation

```powershell
node scripts/verify-pack.mjs
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:pwa
pnpm validate
pnpm exec prettier --check .
git diff --check
```

Run a production preview smoke through a non-interactive request/harness if repository conventions support it. Do not claim visual acceptance.

## Manual checklist for Luca

1. Run `pnpm dev`; expected visible result: minimal MUI shell with board placeholder, tree placeholder and task card, no obvious error overlay; expected persisted result: only an isolated demo/test database if the shell intentionally creates one, clearly named and documented; failure evidence: console output and screenshot/description.
2. Resize desktop to phone width; expected visible result: content remains usable without horizontal page scroll, acknowledging this is a foundation shell; expected persisted result: none; failure evidence: viewport and overflow description.
3. Run the production build/preview commands; expected visible result: same minimal shell; expected persisted result: no user data deletion; failure evidence: exact commands/errors.
4. Reload once; expected visible result: app loads and no service-worker loop/error; expected persisted result: test/demo state behaviour matches documentation; failure evidence: console/service-worker state.

## Acceptance criteria

- clean reproducible install and lockfile;
- accepted dependencies present, versions/licences recorded;
- strict type/lint/test/build/format gates pass;
- architecture boundaries are visible but not overbuilt;
- minimal MUI/board/tree/chess/Dexie/FSRS/PWA integrations compile and have smoke coverage;
- no PHASE-1 product UI or PHASE-2 training logic;
- one draft PR and self-contained report;
- Luca accepts foundation/manual shell before PHASE-1.

## Non-scope

- final responsive UI;
- real repertoire graph;
- move grading/session state machine;
- PGN import;
- permanent database schema;
- scheduler mapping;
- native packaging;
- deployment.

## Rollback

Close the draft PR and delete only the phase branch if rejected. The pack-only `main` remains intact.

## Assistant Memory capture proposal

Report exact environment versions, dependency licences, scripts, final branch/head/PR, validation results, deviations and next-phase gate.

---

# PHASE-1 — Responsive board/tree/task training shell

## Goal

Deliver the accepted responsive single-surface UI using standard MUI components, synthetic typed fixture state and no real training persistence.

## Branch

```text
phase-1-responsive-shell
```

## Entry gate

- PHASE-0 explicitly accepted and merged into `origin/main`.
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

## Local validation

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
- local automated validation pass;
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

# PHASE-2 — Deterministic training vertical slice

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

## Local validation

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

# PHASE-3 — Repertoire graph, transpositions, playlists and PGN import

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

# PHASE-4 — Offline persistence, recovery and portability

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

## Local validation

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

# PHASE-5 — FSRS adapter and adaptive session generator

## Goal

Implement the versioned chess-to-FSRS adapter, scheduler state persistence, due/new/weak candidate selection, targeted versus incidental evidence, branch/prefix balancing, same-session repair/retest and deterministic simulations.

## Branch

```text
phase-5-fsrs-session-generator
```

## Entry gate

- PHASE-0 through PHASE-4 explicitly accepted and merged into fetched `origin/main`.
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

## Local validation

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

# PHASE-6 — Repertoire management, progress and opening-name recall

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

# PHASE-7 — PWA, mobile, accessibility and operational hardening

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

## Validation

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

# PHASE-8 — Release candidate, deployment and packaging decision

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

## Tests/validation

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
