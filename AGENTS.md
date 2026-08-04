# AGENTS.md — Opening Trainer repository rules

## 0. Purpose

This repository builds **Opening Trainer**, a lightweight offline-first chess-opening learning application. The accepted product combines a responsive chessboard, a visible repertoire tree, complete-line replay from the initial position, and spaced repetition at individual contextual decision points.

The first implementation is a browser-first progressive web application. Desktop and mobile browsers are first-class targets. Native wrappers are deferred until the PWA is accepted.

Before changing the repository, Codex must read these files in order:

```text
AGENTS.md
context.md
plans.md
CODEX_START_HERE.md
CODEX_PROMPT_PROFILE.md
docs/product/PRODUCT_CONTRACT.md
docs/architecture/ARCHITECTURE.md
```

For a named phase, also read every focused document listed in that phase's `Required reading` section and no unrelated archive by default.

## 1. Authority and conflicts

Use this precedence order:

1. Luca's current explicit instruction in the active Codex chat.
2. `AGENTS.md`.
3. `context.md`.
4. Accepted focused contracts under `docs/`.
5. `plans.md`.
6. Current implementation and comments.

Google Drive Assistant Memory is the durable project source of truth. These repository files are the execution copy. Codex is not required to access Drive. When Luca supplies a newer pack or an explicit correction, install it through a bounded documentation change. When repository authority conflicts with a newer accepted record supplied by Luca, stop before mutation and report the conflict rather than inventing a compromise.

## 2. Accepted product baseline

The following are accepted unless Luca explicitly supersedes them:

- Training normally begins from the initial chess position and replays a complete selected repertoire line.
- The opponent follows the selected repertoire exactly. No evaluation engine is required.
- Move recall is primary. Opening-name recall is a separate secondary learning stream.
- The visible repertoire is a branching tree. Internal storage may use a transposition-aware graph.
- The main surface is board-dominant, with a repertoire-tree panel and a context-sensitive task/feedback panel.
- In training mode, already-played moves remain visible while future answer-bearing move labels are masked.
- Any move accepted by the active repertoire context is valid. The route replans from the resulting position.
- Illegal moves, legal moves outside the active repertoire, and moves belonging to a wrong sibling variation are distinct outcomes.
- Each exercise has one or more targeted decision items. Other decisions traversed during a complete-line replay provide incidental evidence.
- Positive incidental evidence must not repeatedly inflate mature prefix intervals. Negative incidental evidence promotes that decision to targeted review.
- Hints are progressive and recorded. Wrong or revealed decisions receive immediate repair and a delayed same-session retest.
- Repeated sibling-variation confusion may generate contrast drills.
- The MVP is local-first and preserves data through documented JSON export/import. PGN is a repertoire interchange format, not the complete backup format.

## 3. Accepted implementation direction

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

## 4. Architecture boundaries

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

- React components render state and emit typed commands. They do not own repertoire mutation, transposition identity, scheduling calculations, import transactions or database normalisation.
- `react-chessboard` is a presentation/input adapter. `chess.js` is authoritative for legal move state and notation, not repertoire correctness.
- Domain services expose deterministic pure functions wherever practical.
- Dexie repositories own persistence transactions. UI code must not issue scattered table writes.
- `ts-fsrs` is accessed only through a project-owned scheduling port. Domain code must retain raw chess evidence so scheduler mapping can change without losing history.
- Machine move identity uses UCI-compatible coordinates. SAN is derived for display and PGN.
- A position identity excludes halfmove/fullmove clocks. It includes board placement, side to move, castling rights and an en-passant target only when an en-passant capture is legally available.
- Transposed positions may share a graph node. Training memory is shared only when repertoire context, prompt mode and accepted move set are pedagogically equivalent.

## 5. UI implementation rules

Material UI is the default source of ordinary controls and layout primitives.

Use MUI components for buttons, forms, dialogs, drawers, menus, toolbars, cards, alerts, progress, switches, chips and ordinary feedback whenever an equivalent exists. Use MUI X Tree View Community for the repertoire tree. Do not use Pro or Premium features.

Custom UI code is allowed for:

- the responsive application grid;
- board sizing and board integration;
- repertoire-tree item labels and masking semantics;
- chess-specific status markers;
- task-panel state composition;
- accessibility glue that the selected libraries do not provide.

Do not create a bespoke design system, dashboard, onboarding sequence, animation framework, custom button family, custom modal framework or feature-specific duplicate of an existing MUI pattern.

Every UI phase must include a section in its completion report titled:

```text
## Reusable UI/UX implementation
## Reuse and duplication audit
```

The report must identify what was reused, composed, extended or created; why any new primitive was necessary; and what component and host-surface tests prove the decision.

## 6. Responsive and accessibility rules

Required layout behaviour:

- Desktop: persistent or readily collapsible repertoire panel, dominant board, task panel alongside the board.
- Tablet: board remains dominant; one secondary panel may collapse or move below.
- Phone: board first, task panel immediately below, repertoire tree in a temporary/swipeable drawer or bottom sheet.
- The user must never need horizontal page scrolling for the core training flow.
- Board interaction must support mouse, keyboard-accessible alternatives where feasible, and touch.
- Essential commands require accessible names and visible focus.
- Masked future moves must not leak answers through accessible labels, tooltips, DOM text or test IDs.
- Colour must not be the sole carrier of learning state or error meaning.
- Respect reduced-motion preferences. Animation is not required for acceptance.

Luca owns genuine visual and interaction acceptance. Codex may run component/integration/browser-functional tests but must not claim visual acceptance without Luca's report.

## 7. Programme and phase discipline

- Implement exactly one named phase from `plans.md` per branch and draft pull request.
- A short instruction such as `continue with phase 5` authorises **PHASE-5 only**, subject to its entry gate.
- Do not begin a later phase merely because an earlier phase is technically complete.
- Each phase starts from an updated clean `main` containing every explicitly accepted and merged predecessor.
- Review corrections stay on the same branch and pull request.
- Do not create stacked or side correction PRs unless Luca explicitly requests them.
- Do not merge any PR unless Luca explicitly instructs the merge in the current chat.
- Do not mark a phase accepted in `context.md` until Luca explicitly accepts it.
- A phase may be technically complete while manual acceptance remains pending.

Phrase mapping:

- `start`, `begin`, or `start development` means execute **PHASE-0 only**.
- `continue with phase N`, `start phase N`, or `implement phase N` means execute exactly `PHASE-N`.
- `continue` without a phase number means inspect `context.md`; execute its exact authorised `next_phase` only when the predecessor acceptance/merge gate is explicit and unambiguous. Otherwise stop and name the missing authority.

## 8. Git and pull-request policy

Normal Git and GitHub operations are expected:

- inspect repository status, refs, history and current PR metadata;
- fetch and prune;
- create the phase branch from the verified integration base;
- commit intentional changes;
- push the branch;
- create or update one draft PR into `main`;
- read PR comments and changed files when correcting existing work.

Do not:

- rewrite or force-push `main`;
- merge without Luca's current explicit instruction;
- change repository visibility or permissions;
- commit credentials, tokens, personal data or proprietary repertoire content;
- use third-party opening content whose licence/provenance is not recorded;
- edit workflow files unless the named phase explicitly requires repository automation.

GitHub Actions is not the acceptance system for this programme. Local validation is authoritative for Codex's technical report. A push or PR may trigger existing workflows; that platform activity is incidental. Do not wait for, rerun, debug or cite Actions unless Luca explicitly changes this policy.

## 9. Data and licence safety

- Use synthetic repertoire fixtures or clearly licensed public-domain/compatible material.
- Do not commit a user's private repertoire without explicit instruction.
- Do not bundle Lichess Opening Explorer data or other copyleft/server datasets merely because an API exists. Record source, licence, permitted use and whether data is fetched, cached or redistributed.
- Complete backup exports must be versioned, validated and transactional on import.
- A failed import must not partially mutate the active database.
- Tests use isolated in-memory/fake IndexedDB or a clean temporary browser profile.
- Never rely on an old service worker or pre-existing IndexedDB state to prove first launch.

## 10. Local validation policy

Use focused tests first, then the full applicable sequence defined by the repository. After PHASE-0 the intended baseline commands are:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:pwa
pnpm validate
pnpm exec prettier --check .
git diff --check
```

Browser functional tests are introduced only in the phase that establishes them. Do not add or require a command before the responsible phase exists.

Validation must explicitly distinguish relevant initial states, including as applicable:

- first load with no service worker cache and no IndexedDB database;
- reload with valid current data;
- invalid or future backup rejection without mutation;
- interrupted/failed import rollback;
- offline reload after one successful online load;
- upgraded database schema;
- mobile-sized and desktop-sized functional layouts;
- installed-PWA launch where supported by the test harness.

A pre-seeded database test does not prove first-run behaviour. A cached build does not prove install/offline behaviour.

## 11. Continuous execution and genuine blockers

For an implementation phase, Codex continues through:

1. entry-gate verification;
2. repository inspection and reuse inventory;
3. bounded implementation;
4. focused tests;
5. repair of in-scope failures;
6. full local validation;
7. applicable launch/state scenarios;
8. final scope and duplication audit;
9. intentional commit;
10. push and draft PR;
11. self-contained completion report and Luca manual checklist.

Planning, partial coding, one passing test, commit, push or draft PR are intermediate states.

A genuine blocker is an external condition Codex cannot safely resolve within scope, such as missing authority, unavailable repository access, a dirty tree containing unknown work, an inaccessible required base/ref, unresolved destructive-data risk, an unaccepted product decision, or a required credential that must not be invented.

Allowed final statuses:

```text
COMPLETE_FOR_MANUAL_REVIEW
BLOCKED
INCOMPLETE
```

## 12. Completion report contract

Return a self-contained report. Do not make Luca open the PR body to understand the result.

Required content:

- final status;
- phase, verified base SHA, branch, final head SHA and draft PR URL/number;
- predecessor acceptance and merge timing;
- exact `changed_file_count` and every changed repository path exactly once, grouped by responsibility;
- implementation summary tied to acceptance criteria;
- data/schema/import/export effects;
- exact validation commands and observed results;
- relevant launch/state scenarios tested and omitted;
- local automated validation status;
- manual UI/interaction acceptance status as `pending`, `pass` or `fail`;
- risks and deferred work;
- manual checklist where every item states action, expected visible result, expected data/persistence result and failure evidence to return.

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

Use repository-relative paths in backticks. Do not create local-path hyperlinks. End the intended report with:

```text
END_OF_COMPLETION_REPORT
```

Anything after that sentinel is provider residue and is not part of the intended report.

## 13. Stop conditions

Stop before mutation and report when:

- the working tree contains unexpected changes;
- the expected predecessor phase is not explicitly accepted and merged;
- `main` or the selected phase base does not match the fetched remote state;
- the named phase does not exist in `plans.md`;
- the work requires an excluded engine, backend, cloud account, paid MUI feature or native wrapper;
- the work requires unlicensed/proprietary opening data;
- a destructive persistence operation cannot be proven isolated;
- a current user instruction materially conflicts with the accepted pack;
- a visual result would be required to make a claim Codex cannot verify.

## 14. Exact start behaviour

When Luca says only `start` after the pack is committed, begin `PHASE-0 — Repository and application foundation` only.

Do not begin PHASE-1 until PHASE-0 is technically complete, Luca has accepted the manual gate, and Luca has explicitly authorised the next phase or merged the accepted PR and said `continue with phase 1`.
