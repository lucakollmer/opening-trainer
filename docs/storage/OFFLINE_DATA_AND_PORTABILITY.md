# Offline data and portability contract

## 1. Source of truth

IndexedDB through Dexie is the local operational source of truth. Service-worker caches contain application assets only and must never be treated as the user-data backup.

## 2. Database metadata

Maintain a `meta` record containing at least:

```ts
type DatabaseMeta = {
  databaseSchemaVersion: number;
  portableSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
  appVersion?: string;
  lastSuccessfulBackupAt?: string;
};
```

Dexie schema version and portable JSON schema version are related but distinct.

## 3. Repository boundary

UI code calls typed repositories/use cases. It does not issue arbitrary Dexie table writes.

Example operations:

```text
createRepertoire
commitImportCandidate
updateBranchInclusion
savePlaylist
loadTrainingCandidates
commitReviewObservation
saveInterruptedSession
exportCompleteBackup
previewBackupRestore
commitBackupRestore
```

Multi-table use cases are transactions.

## 4. Initial tables

The exact indexes are designed in PHASE-4 from query needs. Semantic tables:

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

Avoid storing large duplicative line arrays when graph/context records can derive them. Cache expensive projections only with a rebuild/version strategy.

## 5. First-run behaviour

With no database:

- create the current empty schema;
- install synthetic demo content only when explicitly chosen or clearly marked as removable demo data;
- do not silently import external data;
- show a bounded empty/start state;
- create no scheduler reviews merely by viewing demo content.

Tests must start from a truly absent database, not only an empty seeded current schema.

## 6. Migrations

For every Dexie schema increment:

- document old and new shape;
- add synthetic fixtures for the previous version;
- test forward migration and post-migration queries;
- preserve IDs and review history;
- do not delete unknown user data silently;
- fail clearly when safe migration is impossible;
- offer export/recovery guidance before destructive reset.

MVP may support only versions created during development, but the migration mechanism must exist before real user data is relied upon.

## 7. Complete JSON backup

The backup envelope is project-owned and versioned:

```ts
type OpeningTrainerBackup = {
  format: 'opening-trainer-backup';
  version: number;
  exportedAt: string;
  appVersion?: string;
  checksum?: string;
  data: {
    repertoires: unknown[];
    repertoireContexts: unknown[];
    positions: unknown[];
    moveEdges: unknown[];
    repertoireMoves: unknown[];
    decisionRules: unknown[];
    playlists: unknown[];
    playlistEntries: unknown[];
    trainingItems: unknown[];
    reviewLogs: unknown[];
    sessions: unknown[];
    settings: unknown[];
    imports: unknown[];
    openingNames: unknown[];
    confusionRelations: unknown[];
  };
};
```

Use actual typed schemas in implementation. JSON export is deterministic where feasible: stable ordering and explicit dates/versions.

## 8. Restore transaction

1. Read file locally.
2. Parse JSON with bounded size/error handling.
3. Validate envelope and version.
4. Validate all records and references into staging data.
5. Compute preview summary/warnings/conflicts.
6. Require explicit user confirmation.
7. Commit atomically through a safe transaction or staged database swap strategy.
8. Run post-commit integrity checks.
9. Record restore/import metadata.
10. Preserve a recoverable pre-restore export when practical and user-authorised.

A failed step before commit leaves the active database unchanged. A failed commit reports exact recovery state.

## 9. PGN role

PGN is for repertoire interoperability. It can represent moves, variations, comments and tags, but it is not the complete backup format for:

- playlists;
- branch inclusion policy;
- contextual training identity;
- scheduler state;
- review logs;
- confusion relationships;
- application settings;
- migration provenance.

Do not claim a PGN export is a complete backup.

## 10. Import provenance

Record:

- source type and original filename where appropriate;
- import timestamp;
- parser/version;
- source hash when practical;
- user-selected colour/destination;
- warnings and unsupported elements;
- created/merged repertoire IDs;
- transaction result.

Do not retain imported raw file content indefinitely unless needed and documented.

## 11. Settings

Keep settings small and versioned. Suggested MVP settings:

- board orientation/default user colour;
- piece/board theme identifiers supported by the board component;
- opponent move delay;
- session target count;
- new-item limit;
- hint preferences;
- tree visibility on training start;
- reduced-motion override only when needed;
- scheduler policy version and user-level retention target if later exposed.

Do not store secrets.

## 12. Service worker and data

- Updating/unregistering the service worker does not clear IndexedDB.
- Clearing app cache and clearing user data are separate explicit commands.
- A `Reset local data` action, if added, names the database, requires confirmation and recommends/creates an export first.
- Tests must verify service-worker update does not change data counts/hashes.

## 13. Storage failure

Handle quota/transaction failures with a stable error state and recovery instructions. Do not report a review saved until its transaction commits.

Where browser persistence APIs are available, PHASE-7 may request persistent storage and explain the result, but refusal is not fatal.

## 14. Portability acceptance

Before release:

- export from a populated synthetic database;
- validate the file independently;
- restore into a clean database;
- compare canonical content and scheduler state;
- confirm no duplicate reviews after interrupted restore/reload;
- document version compatibility and recovery steps.
