# context.md - Opening Trainer accepted execution context

## 0. Status

This file records accepted repository execution context. It is not a scratchpad and must not claim Luca acceptance that has not occurred.

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
namespace: project.chess_opening_trainer
product_name: Opening Trainer
repository: lucakollmer/opening-trainer
repository_status: exists and verified
repository_visibility_observed: public
integration_branch: main
programme: MVP
workflow: ChatGPT + GitHub Actions trial
workflow_status: accepted for this project
current_phase: PHASE-0
current_phase_status: COMPLETE_FOR_MANUAL_REVIEW
current_phase_branch: phase-0-foundation
current_draft_pr: 2
verified_pack_base_sha: 87ccbce18384892601a6630494910e1ca0375f13
pre_workflow_migration_head_sha: 5477419fce1f13f4265ab82d6ee3058d851b5019
permanent_validation_run: 30906801969
permanent_validation_result: success
manual_acceptance: pending
next_phase: PHASE-1
next_phase_authorised: false
next_authorised_action: migrate repository governance to the accepted ChatGPT + GitHub Actions workflow on the existing PHASE-0 branch and PR, rerun Actions, then return to Luca's PHASE-0 manual acceptance gate
implementation_started: true
backend: none
cloud_sync: deferred
native_packaging: deferred
```

All mutable repository facts must be reverified before mutation. A changed head, branch, PR state, workflow result, or Drive checkpoint is a stop condition until reconciled.

## 1. Accepted objective

Build a reliable, lightweight chess-opening trainer that lets a user choose or import a repertoire, practise complete lines from the initial position against a deterministic repertoire opponent, and receive spaced reviews based on memory at individual contextual decisions.

Move recall is the primary objective. Opening-name recall is separately scheduled and secondary.

## 2. Accepted primary experience

The application uses one persistent workspace rather than many screens:

- a dominant interactive chessboard;
- a repertoire tree;
- a context-sensitive task and feedback panel;
- a compact toolbar for repertoire, mode, session progress, and settings.

Desktop shows the board with side panels. Phone places the board first, the task panel below, and opens the tree in a temporary drawer or bottom sheet.

Initial modes:

- `Train`: scheduled recall with future tree moves masked;
- `Browse`: complete tree, free navigation, and learning status;
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
- A wrong or revealed decision is repaired immediately and retested later in the same session.
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

No engine, backend, login, cloud sync, social system, marketplace, coach interface, or production telemetry belongs in the MVP.

## 5. Accepted execution workflow

The project explicitly adopts the trial `ChatGPT + GitHub Actions Coding Workflow`.

- Google Drive Assistant Memory remains the canonical project and operational record.
- The product repository is the code store, branch/PR surface, Actions runtime, structured result channel, and preview evidence surface.
- ChatGPT writes bounded changes directly to the authorised phase branch through the connected GitHub application.
- GitHub Actions validates the exact candidate tree and reports commands, results, changed files, failures, and evidence.
- For generated scaffolding, an explicitly authorised modifying workflow may commit a final tree only after validating that exact tree.
- Local execution is optional for browser-compatible phases.
- Luca retains manual visual acceptance, merge, and continuation authority.
- ChatGPT does not automatically resume when Actions finishes; each continuation requires a new user turn.

## 6. Accepted architecture direction

The repository is one Vite React application, not a monorepo. Pure domain modules remain separated from React and persistence so repertoire, training, import, and scheduler behaviour can be deterministically tested.

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

## 7. Accepted position and memory identity

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

Two transposed paths may share a position node. They share memory only when pedagogical context, prompt mode, and accepted move set are equivalent.

## 8. Persistence and portability direction

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

Schema names may be refined in PHASE-3 and PHASE-4, but semantic ownership must be preserved.

- PGN imports repertoire content and annotations where supported.
- A complete versioned JSON export preserves repertoire metadata, playlists, memory state, review logs, and settings.
- Import is validated and transactional. Failure leaves the current database unchanged.
- Review history and user-authored repertoire data remain exportable across schema changes.

## 9. Source and licence direction

- User-authored or permission-cleared PGN is the primary personalised repertoire source.
- Lichess chess-openings may be evaluated for opening names/ECO data under its current licence.
- Opening Explorer may be queried later for optional frequency metadata only after API, caching, and licence boundaries are recorded.
- No third-party repertoire is bundled without provenance and redistribution permission.

## 10. Verified PHASE-0 implementation checkpoint

The current PHASE-0 candidate established:

- Node 24, pnpm, React, TypeScript, Vite, MUI/MUI X Community, `react-chessboard`, `chess.js`, Dexie/fake-indexeddb, `ts-fsrs`, and `vite-plugin-pwa`;
- strict lint, type checking, deterministic tests, build, PWA, formatting, and repository-integrity gates;
- a minimal integration shell proving board, tree, task, theme, chess, persistence-adapter, scheduler-port, and PWA boundaries;
- a permanent read-only GitHub Actions validation workflow;
- no real training behaviour, repertoire graph, production persistence schema, FSRS policy, backend, accounts, native wrapper, opening dataset, or public deployment.

Observed pre-migration evidence:

```yaml
base_sha: 87ccbce18384892601a6630494910e1ca0375f13
head_sha: 5477419fce1f13f4265ab82d6ee3058d851b5019
branch: phase-0-foundation
pr: 2
validation_run: 30906801969
validation_conclusion: success
review_artifact_id: 8891213897
review_artifact_digest: sha256:ac68b340c909073115c64ff3f989bd39c324492564c90f71e7080fb67a74a34d
manual_review: pending
```

The original repository authority predates the accepted browser workflow and uses the previous local-executor evidence model. This workflow-pack migration supersedes that operating layer without replacing application code.

## 11. Exact current action

1. In a fresh Opening Trainer project chat, attach this workflow pack and ask ChatGPT to migrate repository governance to the accepted ChatGPT + GitHub Actions workflow.
2. Read Drive authority and reverify `lucakollmer/opening-trainer`, PR #2, branch `phase-0-foundation`, and current head.
3. Stop if the head is no longer the expected pre-migration head or the PR is not draft/open/unmerged, unless Luca explicitly authorises reconciliation.
4. Apply only the add/replace/delete operations in `WORKFLOW_MIGRATION.md` on the existing phase branch and PR.
5. Preserve all PHASE-0 application source, dependencies, lockfile, and `.github/workflows/ci.yml` unless a demonstrated workflow migration defect requires a separately reported bounded correction.
6. Run the permanent Actions validation against the new exact head and upload/update the structured workflow evidence.
7. Update PR #2 to describe the migration and current candidate head.
8. Stop at Luca's PHASE-0 manual acceptance gate.

PHASE-1 is not authorised until Luca completes the current manual checklist, explicitly accepts PHASE-0, and authorises the merge/continuation.
