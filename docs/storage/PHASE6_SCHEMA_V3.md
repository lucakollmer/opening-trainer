# PHASE-6 schema v3

PHASE-6 upgrades the production IndexedDB database to schema **v3** and the complete
portable JSON format to **v3**. The migration is additive: all PHASE-5 move-training
rows, raw move-review evidence, scheduler states and scheduler decisions are retained
unchanged.

## Existing PHASE-5 stores retained

`meta`, `repertoires`, `repertoireContexts`, `positions`, `moveEdges`,
`repertoireMoves`, `decisionRules`, `playlists`, `playlistEntries`, `trainingItems`,
`reviewLogs`, `schedulerStates`, `schedulerDecisions`, `sessions`, `settings`, `imports`,
`openingNames` and `confusionRelations` remain present with their PHASE-5 semantics.

PHASE-6 does not replay `reviewLogs` during migration and does not rewrite
`schedulerStates`/`schedulerDecisions`.

## New stores

### `repertoireStates`

Soft lifecycle overlay keyed by repertoire ID.

- `id`
- `archivedAt?`
- `updatedAt`

The underlying repertoire graph remains intact when archived. `userColour` is not
mutable in PHASE-6.

### `playlistStates`

Soft lifecycle overlay keyed by playlist ID.

- `id`
- `archivedAt?`
- `updatedAt`

Playlist membership/filter rows remain intact when archived or when a member
repertoire becomes unavailable.

### `managedOpeningNames`

Authoritative PHASE-6 name metadata.

- `id`
- `repertoireId`
- `contextId`
- `primaryLabel`
- `aliases[]`
- `answerSetKey`
- `createdAt`
- `updatedAt`
- `archivedAt?`

Legacy `openingNames.labels[]` rows are migrated conservatively on first open:
`labels[0]` becomes the primary label and remaining labels become aliases. No review
history is fabricated.

### `nameTrainingItems`

Immutable-semantic snapshots for opening-name recall.

- contextual repertoire/context/position identity
- primary label and aliases at creation
- normalized `answerSetKey`
- `active | superseded`
- timestamps

A material normalized answer-set change supersedes the prior item; it never edits an
old name review's meaning.

### `nameReviewLogs`

Immutable raw name-recall observations.

- `id`
- `nameTrainingItemId`
- `sessionId`
- `observedAt`
- `responseTimeMs`
- `accepted | incorrect | revealed`
- normalized submitted answer
- expected answer-set key

### `nameSchedulerStates`

Projection keyed one-to-one by `itemId`. Stores the scheduler state plus exact adapter,
parameter-profile and name-mapping-policy versions.

### `nameSchedulerDecisions`

Immutable scheduling audit row keyed by observation ID with previous/resulting due
timestamps and resulting scheduler state.

### `nameSessions`

Recoverable name-recall session descriptor containing the training scope, ordered item
IDs, current index, status and committed observation IDs.

### `contrastItems`

Directional comparison identity:

`expectedContextId -> confusedContextId`

plus source move-training item, repertoire, status and timestamps. Only exact contextual
normal-recall evidence can create a new pair. Legacy ambiguous evidence is never assigned
a fabricated expected context.

### `contrastReviewLogs`

Immutable contrast-review observations. These do not write `reviewLogs` and therefore
do not add normal sibling-confusion evidence.

### `contrastSchedulerStates` / `contrastSchedulerDecisions`

Independent scheduler projection and immutable scheduling decisions for contrast pairs,
using their own mapping-policy version while sharing the validated FSRS adapter/parameter
profile implementation.

### `contrastSessions`

Recoverable ordered contrast-pair session state, separate from move and name sessions.

## Contextual move evidence

The PHASE-5 `reviewLogs` store is retained. New PHASE-6 move observations add an
optional `contextId` field before the existing PHASE-5 repository transaction commits
the observation. Historical rows without that field remain valid and byte-for-byte
unchanged.

## Migration v2 -> v3

1. Dexie creates the new stores.
2. Existing move rows are not replayed or transformed.
3. `databaseSchemaVersion` and `portableSchemaVersion` advance to 3.
4. Existing repertoires/playlists receive unarchived lifecycle overlays lazily or during
   PHASE-6 initialization.
5. Existing legacy opening-name metadata may materialize fresh name training items with
   a fresh scheduler state. There are no invented historical name reviews.
6. Exact-context contrast pairs are generated only from qualifying raw normal-recall
   observations inside the current threshold/window. Ambiguous legacy observations stay
   informational only.

## Portable backup v3

Portable v3 contains the complete PHASE-5 data payload plus every PHASE-6 store listed
above and an SHA-256 integrity envelope. Restore validates base graph/review/scheduler
references and PHASE-6 cross-table references before mutation.

Portable v1/v2 files are still accepted through the v3 preview path. Their existing base
payload is validated by the legacy parser, then staged into a v3 envelope with empty
PHASE-6 tables. After commit, PHASE-6 lifecycle/name derivation runs normally. The
upgrade never replays move reviews.

## Clear/reset

`RESET LOCAL DATA` clears both the PHASE-5 and PHASE-6 user-data table sets in one
transaction and leaves a clean v3 metadata row. It does not leave name/contrast history
behind after the base move tables are reset.
