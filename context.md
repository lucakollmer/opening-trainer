# context.md — Opening Trainer accepted execution context

## 0. Status

This file records accepted repository execution context. It is not a scratchpad and must not claim user acceptance that has not occurred.

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
namespace: project.chess_opening_trainer
product_name: Opening Trainer
repository: lucakollmer/opening-trainer
repository_status: planned; create before first Codex run
integration_branch: main
programme: MVP
current_phase: PACK-INSTALL
next_phase: PHASE-0
phase_0_status: authorised-after-pack-commit
last_accepted_product_checkpoint: 2026-08-03 UI, learning loop and implementation stack
implementation_started: false
backend: none
cloud_sync: deferred
native_packaging: deferred
```

## 1. Accepted objective

Build a reliable, lightweight chess-opening trainer that lets a user choose or import a repertoire, practise complete lines from the initial position against a deterministic repertoire opponent, and receive spaced reviews based on memory at individual contextual decisions.

Move recall is the primary objective. Opening-name recall is separately scheduled and secondary.

## 2. Accepted primary experience

The application uses one persistent workspace rather than many screens:

- a dominant interactive chessboard;
- a repertoire tree;
- a context-sensitive task and feedback panel;
- a compact toolbar for repertoire, mode, session progress and settings.

Desktop shows the board with side panels. Phone places the board first, the task panel below, and opens the tree in a temporary drawer or bottom sheet.

Initial modes:

- `Train`: scheduled recall with future tree moves masked;
- `Browse`: complete tree, free navigation and learning status;
- repertoire import/management through bounded dialogs or drawers rather than a dashboard.

Guided learning and normal repertoire recall are required in the MVP. Strict move-order and contrast drills are added only in their named phases.

## 3. Accepted learning behaviour

- A session exercise selects a targeted due decision and replays its containing line from move one.
- Earlier and later decisions preserve line context but are not automatically granted the same scheduling weight.
- Correct target recall gives full scheduler evidence.
- Correct incidental recall is recorded but cannot repeatedly extend mature prefix intervals.
- An incidental error becomes targeted material.
- Several due decisions may share one replay only when the generator records exactly which items receive full evidence.
- Any accepted move in the current repertoire context is valid; the route follows the selected branch.
- A move in a different included sibling variation is a variation-confusion observation rather than an illegal move.
- A legal move outside the active repertoire is a recall failure.
- A transposition is accepted when it reaches a known allowed contextual position, unless strict move order is the explicit prompt.
- Progressive hints: piece, candidate destinations, purpose/note, then full reveal.
- A wrong/revealed decision is repaired immediately and retested later in the same session.
- Repeated sibling confusion can create a contrast drill.
- Opening-name prompts have independent memory state.

## 4. Accepted implementation stack

```yaml
runtime: browser-first PWA
language: TypeScript
ui: React + Material UI
build: Vite
package_manager: pnpm
board: react-chessboard
rules: chess.js
tree: MUI X Tree View Community
persistence: Dexie / IndexedDB
scheduler: ts-fsrs behind a project-owned adapter
pwa: vite-plugin-pwa
testing: Vitest + Testing Library; browser functional testing added later
```

No engine, backend, login, cloud sync, social system, marketplace, coach interface or production telemetry belongs in the MVP.

## 5. Accepted architecture direction

The repository begins as one Vite React application, not a monorepo. Pure domain modules are separated from React and persistence so the repertoire model, training reducer, import logic and scheduler mapping can be deterministically tested.

Core direction:

```text
board event
  -> chess.js legality/state adapter
  -> repertoire-context lookup
  -> training-session state transition
  -> feedback and review observation
  -> scheduler adapter
  -> transactional persistence
```

The visible repertoire is a tree projection. Canonical storage is a graph of unique positions and move edges with repertoire-context metadata.

## 6. Accepted position and memory identity

Canonical position identity uses:

- piece placement;
- side to move;
- castling rights;
- en-passant target only when a legal en-passant capture exists.

It excludes halfmove and fullmove counters.

Machine move identity uses UCI-compatible coordinates. SAN is derived for display and PGN.

A training item is contextual, not merely a FEN:

```text
repertoire context
+ canonical position
+ normalized accepted user-move set
+ prompt mode
+ strict path fingerprint only when move order is itself tested
```

Two transposed paths may share a position node. They share memory only when the pedagogical context, prompt mode and accepted move set are equivalent.

## 7. Persistence and portability direction

IndexedDB is the local source of truth. The intended Dexie schema includes:

```text
meta
repertoires
repertoireContexts
positions
moveEdges
repertoireMoves
decisionRules
playlists
playlistEntries
trainingItems
reviewLogs
sessions
settings
imports
openingNames
confusionRelations
```

Schema names may be refined in PHASE-0/PHASE-3, but semantic ownership must be preserved.

- PGN imports repertoire content and annotations where supported.
- A complete versioned JSON export preserves repertoire metadata, playlists, memory state, review logs and settings.
- Import is validated and transactional. Failure leaves the current database unchanged.
- Review history and user-authored repertoire data must remain exportable across schema changes.

## 8. Source and licence direction

- User-authored or permission-cleared PGN is the primary personalised repertoire source.
- Lichess chess-openings may be evaluated for opening names/ECO data under its current licence.
- Opening Explorer may be queried later for optional frequency metadata only after API, caching and licence boundaries are recorded.
- No third-party repertoire is bundled without provenance and redistribution permission.

## 9. Current blockers and open design work

Implementation can begin with synthetic fixture data. The following remain bounded work rather than reasons to delay PHASE-0:

- final database field names and migration strategy;
- exact PGN recursive-annotation-variation parser choice;
- chess-specific observation-to-FSRS rating mapping;
- current package-version lock established by PHASE-0;
- final source and licence record for optional bundled opening-name data;
- production hosting target;
- any native packaging decision.

## 10. Exact next action

1. Create the private repository `lucakollmer/opening-trainer` with `main` as the default branch.
2. Copy this pack into the empty repository root.
3. Run `node scripts/verify-pack.mjs` and verify `SHA256SUMS.txt`.
4. Commit and push the pack as the documentation baseline.
5. Start Codex in the repository and issue the PHASE-0 prompt in `prompts/` or the short command in `CODEX_START_HERE.md`.
6. Do not begin PHASE-1 until Luca reviews and accepts PHASE-0 and explicitly authorises the next phase.
