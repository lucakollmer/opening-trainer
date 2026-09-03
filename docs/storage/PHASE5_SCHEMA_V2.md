# PHASE-5 local data schema v2

PHASE-5 is the first forward migration of the Opening Trainer production data model.

## Stable coordinates

- IndexedDB/Dexie database name: `opening-trainer`
- Dexie schema version: `2`
- portable complete-backup format: `opening-trainer-backup`
- current portable backup version: `2`
- legacy portable backup accepted for migration: `1`
- scheduler library: `ts-fsrs@5.4.1`
- scheduler mapping policy: `chess-fsrs-v1`
- response-time policy: `response-bands-v1`
- scheduler parameters profile: `phase5-default-v1`
- FSRS fuzz: disabled for deterministic scheduling

## Separation of durable evidence and scheduler projection

`reviewLogs` remain immutable chess-specific observations. PHASE-5 does not add an FSRS
rating to those rows and does not reinterpret PHASE-4 history.

Two new tables form the scheduler projection:

| Table                | Identity                               | Purpose                                                                                                                                 |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `schedulerStates`    | one row per canonical training-item ID | current portable scheduler state and adapter/policy metadata                                                                            |
| `schedulerDecisions` | one row per observation ID             | versioned decision describing whether that new raw observation caused `Again`, `Hard`, `Good`, `Easy`, no update, or targeted promotion |

The observation ID is the idempotency key for the scheduler decision. A transaction that
commits a new PHASE-5 observation commits its scheduler decision and resulting scheduler
state in the same Dexie transaction. Replaying an already committed observation does not
advance FSRS a second time.

Positive incidental observations are retained in `reviewLogs` and receive a
`schedulerDecisions` row with action `none`; they do not extend intervals. Incidental
failures receive `promote-target` and remain scheduler-neutral until a targeted attempt.
`repair-correct` is also scheduler-neutral because it must not erase the original lapse.
Illegal attempts are written immediately as raw `illegal-attempt` observations with a
scheduler decision of `none`; the eventual terminal observation retains the aggregate
illegal-attempt count used by the grading cap. This ensures an interruption after an illegal
first attempt cannot erase the attempt evidence.

## Scheduler state serialization

Portable state is project-owned and contains:

- state schema version;
- due timestamp;
- stability and difficulty;
- elapsed and scheduled days;
- learning-step index;
- repetitions and lapses;
- project stage (`new`, `learning`, `review`, `relearning`);
- optional last-review timestamp.

No `ts-fsrs` `Card`, enum, or parameter type crosses the infrastructure adapter boundary.
The active scheduler projection is accepted only when its adapter version, named immutable
parameter profile and mapping-policy version exactly match a supported current combination.
PHASE-5 supports `ts-fsrs@5.4.1` + `phase5-default-v1` + `chess-fsrs-v1`. Unsupported
scheduler-state projections fail closed during database open or restore; the write transaction
rolls back rather than silently interpreting state under different scheduler semantics.
Historical scheduler-decision rows may retain older adapter/profile/policy metadata as audit
evidence because they are not reused as the active scheduler projection.

Scheduling-critical timestamps on raw reviews, scheduler states and scheduler decisions are
validated as real ISO date-times at the database boundary before persistence/restore.

## v1 -> v2 IndexedDB migration

When Dexie opens an existing PHASE-4 schema-v1 database:

1. all existing tables and IDs are preserved;
2. `schedulerStates` and `schedulerDecisions` are created;
3. every active PHASE-4 training item receives a fresh `new` scheduler state at the
   migration cutover timestamp;
4. `schedulerDecisions` starts empty;
5. every historical `reviewLogs` row remains byte-for-byte raw evidence and is **not**
   replayed into FSRS;
6. database metadata records the scheduler cutover and current schema/portable versions.

This establishes a deliberate scheduling-history boundary rather than inventing grades
for reviews collected before the mapping policy existed.

## Portable backup migration

New complete exports are version 2 and contain both scheduler tables. Version-1 complete
backups remain importable. Preview validates the original v1 envelope and checksum first,
then stages a v2 representation with fresh scheduler states and zero scheduler decisions.
Legacy session snapshots are normalized with explicit target arrays while retaining their
original evidence and plan identity.

Restore remains atomic across all semantic tables. A failed validation, unsupported scheduler
projection, malformed scheduling timestamp, or transaction leaves the active database
unchanged.

## Adaptive session persistence

New session snapshots store generated adaptive metadata:

- generator version and seed;
- requested target/new limits;
- deterministic exercise descriptors (scheduled/retest kind, repertoire, root, target
  set, prompt mode, optional playlist);
- current exercise index;
- canonical target training-item IDs.

The route can therefore be reconstructed after reload without re-running candidate
selection against scheduler state that may already have changed earlier in the session.
Legacy PHASE-4 sessions remain marked as legacy step-target sessions and are not silently
converted into a different scheduling history. New graph-based wrong-sibling observations
store the real sibling destination context ID; legacy synthetic `:sibling:` identifiers remain
accepted during portability validation so historical PHASE-4 evidence is not discarded.

## Prompt-mode and playlist-derived items

PHASE-4 normal-mode items remain the canonical unrestricted memory rows. Guided, Strict
and Contrast items are created only when those modes are requested. A playlist can create
a scoped item only when its accepted move set changes the tested answer identity. If the
playlist leaves the answer set unchanged, the unrestricted item is reused without narrowing
its stored context list. Editing a playlist removes that playlist scope from obsolete items
and supersedes them when no other playlist still uses them; historical review and scheduler
rows remain preserved for audit.
