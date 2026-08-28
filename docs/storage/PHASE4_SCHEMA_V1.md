# PHASE-4 local data schema v1

This document records the first production persistence contract for Opening Trainer.

## Stable coordinates

- IndexedDB/Dexie database name: `opening-trainer`
- Dexie schema version: `1`
- portable complete-backup format: `opening-trainer-backup`
- portable backup version: `1`
- complete-backup ceiling: `5,000,000` UTF-8 bytes on both export and restore
- production user-data source of truth: IndexedDB through Dexie
- service-worker/application caches: application assets only; never a user-data backup

Automated tests use a unique database name per test/application instance.

## Identity normalization

PHASE-3 import graphs use deterministic candidate-local IDs. PHASE-4 converts them at the commit boundary into durable identities:

- positions are content-addressed by canonical position key;
- edges are keyed by durable source-position identity plus UCI move;
- repertoire contexts are keyed by repertoire ID plus path fingerprint;
- contextual moves are keyed by context plus UCI move;
- repertoire IDs remain the stable user-owned IDs chosen at import preview.

This prevents independent PGN imports from colliding on candidate-local IDs such as
`position-0001` while preserving graph sharing for equivalent positions and moves.

## Tables

| Table                | Primary purpose                                       | Important indexes                                                                  |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `meta`               | database/portable schema metadata                     | `id`                                                                               |
| `repertoires`        | repertoire identity, colour and source                | `id`, `name`, `userColour`, `updatedAt`                                            |
| `repertoireContexts` | contextual/path identity                              | `id`, `repertoireId`, `parentContextId`, `entryPositionId`, unique repertoire/path |
| `positions`          | canonical chess positions                             | `id`, unique canonical `key`                                                       |
| `moveEdges`          | canonical legal graph edges                           | `id`, `fromPositionId`, unique source/UCI                                          |
| `repertoireMoves`    | contextual use of graph edges                         | `id`, `contextId`, `edgeId`, destination, actor                                    |
| `decisionRules`      | current scheduler-neutral accepted sets               | `id`, repertoire/context/position/training-item                                    |
| `playlists`          | playlist metadata                                     | `id`, `name`, `updatedAt`                                                          |
| `playlistEntries`    | normalized repertoire/context/tag playlist membership | `id`, `playlistId`, `kind`, `value`                                                |
| `trainingItems`      | contextual memory identities without FSRS state       | `id`, repertoire, position, accepted-set, mode, status                             |
| `reviewLogs`         | raw immutable review observations                     | `id`, training-item, session, timestamp, outcome                                   |
| `sessions`           | resumable/terminal session snapshots                  | `id`, `planId`, `status`, `updatedAt`                                              |
| `settings`           | small versionable local settings                      | `id`, `updatedAt`                                                                  |
| `imports`            | PGN/import provenance and summary                     | `id`, repertoire, import timestamp                                                 |
| `openingNames`       | reserved MVP opening-name metadata                    | `id`, repertoire/context                                                           |
| `confusionRelations` | scheduler-neutral sibling-confusion evidence          | `id`, expected item, confused context                                              |

`decisionRules` and active `trainingItems` are derived from the canonical repertoire
graph. When accepted branch content changes, current decision rules are rebuilt.
Historical training items that no longer represent the active accepted set are retained
as `superseded` so existing review logs are never silently reinterpreted.

A saved repertoire is intentionally distinct from a generated training plan. A valid
repertoire with no current user decision remains durable, backup/exportable and visible
to the user even though no training exercise can be generated from it.

## Transaction and ordering boundaries

The following operations are atomic Dexie transactions:

- validated PGN candidate -> canonical repertoire graph + import provenance + initial
  decision/training rows;
- branch inclusion change -> context mutation + decision/training-row rebuild;
- session snapshot -> new raw observations + confusion relations + committed
  observation IDs;
- complete backup restore -> clear/replace all user-data tables + metadata.

Repository writes and portability operations also pass through one serialized operation
queue. A complete backup therefore waits for prior session/settings writes before taking
its snapshot. Beginning a complete restore immediately blocks later session snapshots
from the pre-restore application state; the application reloads after a successful
restore and a fresh repository instance resumes normal writes. This prevents stale
in-memory session state from landing in newly restored data.

Shared canonical positions and move edges are `put` idempotently when a new repertoire
is committed. Repertoire/context/move rows remain repertoire-specific.

## Session idempotency

`ReviewObservation.id` is the durable idempotency key. Saving an interrupted session
may replay the same in-memory observation list many times:

- a previously unseen observation ID is committed once;
- an identical existing observation is accepted as already committed;
- the same ID with different payload is an integrity error;
- the session row stores the committed observation IDs and pending retest ticket IDs.

Closing/reloading the application does not delete the database. Resume resets the
active response timer so time spent with the application closed is not counted as
recall latency. Resume persists the recovered plan as the active plan before dismissing
the recovery prompt; abandoning an interrupted session is also awaited before the
prompt disappears.

## Complete JSON backup v1

The complete backup envelope contains:

- format/version/export timestamp;
- database schema metadata;
- every semantic user-data table listed above;
- for newly generated v1 backups, an embedded `SHA-256` digest of the canonical unsigned
  backup envelope.

Record arrays are sorted by stable ID before serialization, and object keys are
serialized deterministically. PGN is deliberately not the complete backup format.
Legacy v1 backups created before the digest field existed remain structurally
restorable; the UI warns that they do not have an embedded checksum.

Export is fail-closed as well as restore: if the final UTF-8 JSON exceeds 5,000,000
bytes, no backup is downloaded and the successful-backup timestamp is not advanced.
This guarantees that Opening Trainer does not create a complete backup that the same
version refuses to restore solely because of file size.

Restore is fail-closed:

1. reject files over 5,000,000 bytes before reading/parsing;
2. parse locally and validate envelope and portable/database versions;
3. reject duplicate IDs and validate runtime field shapes/enums/numeric bounds for every
   portable table, including nested session/review state;
4. rebuild and validate the complete repertoire graph in staging;
5. validate playlist/training/review/session/import/opening-name/confusion references and
   session identity consistency;
6. verify the embedded SHA-256 when present;
7. show a preview to the user;
8. serialize behind pending writes and block stale pre-restore session writes;
9. replace all user-data tables in one transaction only after explicit confirmation;
10. reconstruct and validate the just-written database inside that transaction before it
    commits;
11. run a post-commit database integrity validation as a second defensive check;
12. reload the application so normal bootstrap rehydrates the restored IndexedDB and
    active-plan setting.

A parse, future-version, checksum, schema, referential-integrity or pre-commit
transaction failure leaves the active database unchanged.

## PGN portability and resource limits

PGN export is repertoire-only. It emits included moves, recursive variations and
representable annotations. The UI explicitly states that PGN does not contain review
history, session state or settings and therefore is not a complete backup.

PGN import is also bounded before expensive graph construction:

- maximum UTF-8 input size: 1,000,000 bytes;
- maximum games: 250;
- maximum parsed move tokens: 50,000;
- maximum recursive variation nesting: 32 levels.

Local PGN files are size-checked before `file.text()` is called. Import and export hot
paths maintain maps/indexes for move order, edge lookup and outgoing moves rather than
repeatedly scanning the full graph for each move.

## Migration policy

This is the first production schema, so no synthetic `v0 -> v1` migration is invented.
`FIX-12` is introduced when the first real schema increment exists. Every later Dexie
version must provide a documented forward migration fixture and preserve durable IDs
and review history.
