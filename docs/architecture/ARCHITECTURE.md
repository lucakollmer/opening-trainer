# Architecture contract — Opening Trainer

## 1. Architectural style

Use one browser application with explicit layers:

```text
React/MUI presentation
        ↓ typed commands and view models
application/session orchestration
        ↓ ports
pure chess, repertoire, training and scheduling domain
        ↓ repositories/adapters
Dexie/IndexedDB, PGN/JSON import-export, service worker
```

The first version is deliberately not a monorepo and has no backend.

## 2. Module boundaries

### `src/app`

Owns:

- application composition;
- MUI theme;
- responsive shell;
- top-level providers;
- global error boundary;
- boot/update state;
- feature wiring.

Does not own domain rules.

### `src/components`

Owns project-wide UI compositions not supplied directly by MUI, such as a common state panel or accessible status badge. Components remain domain-neutral where practical.

### `src/domain/chess`

Owns:

- `chess.js` adapter;
- legal move application;
- FEN parsing/serialization boundary;
- canonical position-key derivation;
- UCI/SAN conversion;
- board orientation-independent square/move types.

### `src/domain/repertoire`

Owns:

- graph records;
- repertoire contexts;
- accepted-move queries;
- tree projection;
- transposition resolution;
- branch/line projection;
- playlist filters;
- import intermediate representation;
- repertoire validation.

### `src/domain/training`

Owns:

- exercise/session state machine;
- route generation;
- opponent selection policy;
- target/incidental evidence;
- move-outcome classification;
- hints;
- repair and same-session retest;
- session summaries;
- confusion relationships.

### `src/domain/scheduling`

Owns:

- scheduler-neutral interfaces;
- review-observation types;
- chess evidence to FSRS-rating mapping;
- ts-fsrs serialization adapter;
- due/retrievability calculations;
- test clock injection.

### `src/infrastructure/db`

Owns:

- Dexie database definition;
- schema migrations;
- repositories;
- transactions;
- boot integrity checks;
- backup/restore database swap strategy.

### `src/infrastructure/import-export`

Owns:

- PGN parser adapter;
- intermediate repertoire validation;
- import preview/report;
- complete JSON backup schemas;
- transactional restore;
- exported schema versioning.

### Feature UI folders

Own feature-specific rendering and typed adapters. They do not mutate database tables directly or duplicate domain state machines.

## 3. Dependency direction

```text
presentation -> application -> domain
infrastructure -> domain ports/types
application -> infrastructure ports
```

Domain modules must not import React, MUI, Dexie, service-worker APIs or board widgets.

`react-chessboard`, MUI and Dexie are adapters at the outer layers. `chess.js` may be wrapped inside the chess-domain adapter because it is the selected rules implementation, but repertoire and training modules depend on project-owned chess interfaces rather than scattered direct imports.

## 4. Application state

Use:

- a reducer/state machine for the current training session;
- Dexie repositories for persistent state;
- local component state for drawers, menus and dialogs;
- derived selectors/view models for rendering.

Do not add Redux or another global state framework during the MVP unless a later accepted phase demonstrates an unresolved ownership problem.

A session reducer transition should be deterministic from:

```text
current session state
+ typed command/event
+ injected clock/random policy where required
+ domain query result
```

Side effects are executed by orchestration services and returned as typed results/events.

## 5. Identifiers

Use stable opaque IDs for user-owned entities. Suggested branded string types:

```text
RepertoireId
RepertoireContextId
PositionId
MoveEdgeId
RepertoireMoveId
DecisionRuleId
PlaylistId
PlaylistEntryId
TrainingItemId
ReviewLogId
SessionId
ImportId
OpeningNameId
ConfusionRelationId
```

Position identity is content-addressed or uniquely indexed by canonical position key. Do not expose database auto-increment IDs as portable identity.

## 6. Canonical position key

Construct from a `chess.js` state after legal normalisation:

```text
piece placement
side to move
castling rights
en-passant target when a legal en-passant capture exists, otherwise '-'
```

Exclude halfmove/fullmove clocks.

Do not merge positions merely because piece placement matches. Side-to-move and legal state matter.

## 7. Move identity

Store:

- from square;
- to square;
- optional promotion;
- UCI string as the stable machine representation;
- SAN as derived/cached display data with source position key;
- resulting position ID.

SAN alone is not a stable primary key because it depends on context and disambiguation.

## 8. Repertoire graph and tree projection

Canonical graph:

```text
Position --MoveEdge--> Position
```

Repertoire-specific intent is attached through contextual records rather than duplicating the global edge for every repertoire.

A tree projection contains a path identity so the same position may appear in several visible branches while retaining graph sharing.

Tree projection responsibilities:

- deterministic branch order;
- current path;
- included/excluded state;
- visible/masked labels;
- due/weak descendant summaries;
- transposition marker;
- stable item IDs for the UI.

## 9. Contextual accepted moves

A position can have several accepted user moves. Query by:

```text
repertoire context
playlist/session filter
position
prompt mode
optional strict path fingerprint
```

Return a normalized set plus metadata explaining each accepted branch.

The training item references the normalized accepted set. Changing the set creates/migrates training identity deliberately; it must not silently reinterpret historical reviews.

## 10. Opponent policy

The opponent does not use an engine. It selects among repertoire moves according to an injected policy, for example:

- exact route selected for the current target;
- due/weak branch coverage;
- deterministic fixture order;
- seeded weighted choice in later phases.

All stochastic decisions use an injectable seeded source so tests are reproducible.

## 11. Persistence architecture

Dexie schema versions are explicit. Migrations are forward-only and tested against synthetic old-version fixtures.

Repositories expose use-case operations rather than raw tables. Multi-table changes use transactions.

Critical transaction examples:

- repertoire import;
- complete backup restore;
- branch inclusion update affecting training items;
- review completion plus scheduler state and review log;
- schema migration.

A restore should validate into a staging representation, then commit atomically or replace via a documented safe database strategy. Do not clear the active database before the replacement is validated.

## 12. PWA architecture

Use `vite-plugin-pwa` with an explicit update strategy selected in PHASE-7. Cache the application shell and immutable static assets. IndexedDB remains the user-data store.

Requirements:

- service-worker registration state is surfaced unobtrusively;
- stale/new version behaviour is deterministic;
- an update never deletes user data;
- offline reload is tested after a successful online load;
- cache reset and database reset are distinct operations;
- no silent aggressive caching of remote opening APIs.

## 13. Error model

Use stable domain/result codes and user-facing mapped messages. Suggested categories:

```text
CHESS_ILLEGAL_MOVE
REPERTOIRE_MOVE_NOT_ACCEPTED
REPERTOIRE_WRONG_VARIATION
REPERTOIRE_CONTEXT_MISSING
REPERTOIRE_GRAPH_INVALID
IMPORT_PARSE_FAILED
IMPORT_VALIDATION_FAILED
IMPORT_UNSUPPORTED_VARIATION
BACKUP_VERSION_UNSUPPORTED
BACKUP_VALIDATION_FAILED
DB_TRANSACTION_FAILED
SCHEDULER_STATE_INVALID
PWA_UPDATE_FAILED
```

Do not use thrown strings as the cross-layer contract. Preserve technical causes for logs/tests without exposing internals to the user.

## 14. Time and determinism

Inject a clock into scheduling, session and import metadata operations. Tests must not depend on wall-clock timing.

Record response duration using a monotonic timer where available, but store a bounded integer and the review timestamp separately.

Use stable deterministic sorting with explicit tie-breakers.

## 15. Security/privacy boundary

The MVP has no account or server. Treat repertoire and review history as private local data.

- No analytics by default.
- No remote API call during training.
- No raw PGN upload to a server.
- File import remains local.
- Export uses explicit user action.
- No credentials or secrets are needed.

## 16. Deferred architecture

Post-MVP only:

- cloud sync and identity;
- conflict resolution across devices;
- shared/coach repertoires;
- native wrappers;
- background notifications;
- server-backed explorer data;
- engine integration.
