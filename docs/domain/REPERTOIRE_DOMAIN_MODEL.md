# Repertoire domain model

## 1. Goals

The model must:

- preserve a user-readable branching repertoire;
- merge exact transposed positions without losing contextual intent;
- accept several repertoire moves from one position;
- distinguish user and opponent choices;
- preserve import provenance and notes;
- create stable contextual training-item identities;
- export user-owned data portably.

## 2. Core records

The TypeScript names below are semantic guidance. PHASE-3 may refine field names while preserving meaning.

```ts
type Colour = 'white' | 'black';
type PromptMode = 'normal' | 'guided' | 'strict' | 'contrast' | 'name';

type Repertoire = {
  id: RepertoireId;
  name: string;
  userColour: Colour;
  rootContextIds: RepertoireContextId[];
  source: RepertoireSource;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type PositionNode = {
  id: PositionId;
  key: CanonicalPositionKey;
  fen: string;
  createdAt: string;
};

type MoveEdge = {
  id: MoveEdgeId;
  fromPositionId: PositionId;
  toPositionId: PositionId;
  uci: string;
  san: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

type RepertoireContext = {
  id: RepertoireContextId;
  repertoireId: RepertoireId;
  parentContextId?: RepertoireContextId;
  entryPositionId: PositionId;
  label?: string;
  openingNameId?: OpeningNameId;
  tags: string[];
  included: boolean;
  pathFingerprint: string;
  sourceLocator?: SourceLocator;
};

type RepertoireMove = {
  id: RepertoireMoveId;
  contextId: RepertoireContextId;
  edgeId: MoveEdgeId;
  actor: 'user' | 'opponent';
  included: boolean;
  order: number;
  note?: string;
  purpose?: string;
  sourceLocator?: SourceLocator;
};
```

A context provides pedagogical/path identity. A graph edge provides chess-state identity.

## 3. Position normalisation

Given a legal `chess.js` state:

1. canonicalise piece placement;
2. preserve side to move;
3. normalise castling rights in standard order;
4. preserve the en-passant target only when the side to move has at least one legal en-passant capture; otherwise use `-`;
5. omit halfmove and fullmove counters.

The implementation must include fixtures for:

- identical board, different side to move;
- identical board/turn, different castling rights;
- nominal en-passant target with no legal capture;
- legal en-passant target;
- exact transposition reached by different move orders.

## 4. Edge uniqueness

Within one source position, a move edge is unique by normalized UCI move. It points to the resulting canonical position.

A conflicting result for the same source position and UCI move indicates corrupted graph construction and is rejected.

## 5. Visible tree projection

A visible node is not necessarily a unique position. It represents a repertoire path/context occurrence.

Suggested projection:

```ts
type RepertoireTreeItem = {
  itemId: string; // stable contextual projection ID, not merely position ID
  contextId: RepertoireContextId;
  positionId: PositionId;
  edgeId?: MoveEdgeId;
  ply: number;
  moveNumber: number;
  actor?: 'user' | 'opponent';
  label: { kind: 'visible'; san: string } | { kind: 'masked' };
  children: RepertoireTreeItem[];
  isCurrentPath: boolean;
  isCurrentPosition: boolean;
  isTransposition: boolean;
  learningSummary: LearningSummary;
};
```

Projection is deterministic. Context order has an explicit stable tie-breaker.

## 6. Accepted moves query

At a user decision, query with:

```ts
type DecisionQuery = {
  repertoireId: RepertoireId;
  activeContextIds: RepertoireContextId[];
  playlistId?: PlaylistId;
  positionId: PositionId;
  promptMode: PromptMode;
  strictPathFingerprint?: string;
};
```

Return:

```ts
type AcceptedMoveSet = {
  positionId: PositionId;
  moves: Array<{
    edgeId: MoveEdgeId;
    uci: string;
    san: string;
    destinationContextIds: RepertoireContextId[];
  }>;
  normalizedKey: string;
};
```

The normalized key is stable under ordering and is part of contextual training identity.

## 7. Training item identity

Suggested identity input:

```ts
type TrainingItemIdentity = {
  repertoireId: RepertoireId;
  contextScopeKey: string;
  positionKey: CanonicalPositionKey;
  acceptedMoveSetKey: string;
  promptMode: PromptMode;
  strictPathFingerprint?: string;
};
```

Normal mode should not split memory merely because the same equivalent position was reached by a different path. Strict mode intentionally includes path identity.

When accepted moves change:

- do not mutate historical review meaning silently;
- mark the old item superseded or migrate with an explicit recorded rule;
- create a new item when the tested answer set materially changes;
- preserve review logs for audit/export.

## 8. Multiple accepted moves

All included accepted moves are correct in normal mode. After the user chooses one:

1. apply the move legally;
2. find destination contexts;
3. choose/replan a continuation that can still cover the target decision(s);
4. if the chosen branch cannot reach the original target, finish/score the valid decision and schedule a replacement exercise for the displaced target rather than marking the move wrong.

Strict mode may intentionally accept one route only, but the prompt must make strict move order explicit.

## 9. Opponent moves

Opponent contexts may contain several moves. The session generator selects one according to policy and current targets. User choice is not requested for opponent moves unless a branch-identification drill explicitly does so.

Opponent move selection is recorded in the session log for reproducibility.

## 10. Transpositions

A transposition is detected when different path contexts resolve to the same canonical position.

Share:

- position node;
- move-edge continuation where identical;
- basic chess-state derived data.

Conditionally share:

- training items only when context scope, prompt mode and accepted set are equivalent.

Do not automatically share:

- opening names;
- notes/purposes;
- strict move-order items;
- branch-specific confusion evidence;
- opponent-choice teaching intent.

## 11. Playlists

```ts
type Playlist = {
  id: PlaylistId;
  name: string;
  repertoireIds: RepertoireId[];
  colour?: Colour;
  includedContextIds: RepertoireContextId[];
  excludedContextIds: RepertoireContextId[];
  maxPly?: number;
  tags: string[];
  weighting: PlaylistWeighting;
  createdAt: string;
  updatedAt: string;
};
```

MVP weighting can remain simple: due-first with optional branch balancing. Do not implement a complex user-authored rules language.

## 12. Import intermediate representation

PGN parsing must first produce an isolated intermediate representation:

```ts
type ImportCandidate = {
  source: RepertoireSource;
  games: ImportGame[];
  warnings: ImportWarning[];
  errors: ImportError[];
  proposedGraph: ProposedGraph;
  proposedContexts: ProposedContext[];
  summary: ImportSummary;
};
```

Only a validated candidate is committed.

Required checks:

- every move legal from its parent state;
- recursive variations preserved or explicitly reported unsupported;
- duplicate games/branches consolidated deterministically;
- comments/NAGs handled according to documented policy;
- result markers ignored for repertoire correctness;
- colour/orientation chosen explicitly;
- source provenance retained;
- no partial database writes during preview.

If `chess.js` PGN support does not preserve recursive annotation variations in the installed version, PHASE-3 must evaluate a dedicated maintained parser. Do not flatten variations silently.

## 13. Opening names

Opening names are metadata linked to contextual positions/paths, not canonical global truth for a position. The same position may carry several legitimate labels by path/source.

Name-recall items are separate from move items and may key on context/path plus expected label set.

## 14. Notes

Support contextual note/purpose fields. Notes may be imported from comments when provenance is clear or authored by the user.

Notes are hidden before recall in normal training unless the hint level explicitly reveals them.

## 15. Validation invariants

Reject or quarantine:

- dangling position/edge/context references;
- illegal edges;
- edge result mismatches;
- context cycles;
- duplicate IDs;
- duplicate conflicting edges;
- user decision with no accepted move;
- playlist references to archived/missing repertoire without a documented recovery state;
- unsupported backup/import version;
- training item whose accepted-set hash cannot be resolved.
