export type Colour = 'white' | 'black';
export type PromptMode = 'normal' | 'guided' | 'strict' | 'contrast' | 'name';
export type MoveActor = 'user' | 'opponent';
export type CanonicalPositionKey = string;

export interface RepertoireSource {
  kind: 'synthetic' | 'pgn';
  label: string;
  hash?: string;
  parserVersion?: string;
}

export interface Repertoire {
  id: string;
  name: string;
  userColour: Colour;
  rootContextIds: readonly string[];
  source: RepertoireSource;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PositionNode {
  id: string;
  key: CanonicalPositionKey;
  fen: string;
  createdAt: string;
}

export interface MoveEdge {
  id: string;
  fromPositionId: string;
  toPositionId: string;
  uci: string;
  san: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface SourceLocator {
  game: number;
  line: number;
  column: number;
}

export interface RepertoireContext {
  id: string;
  repertoireId: string;
  parentContextId?: string;
  entryPositionId: string;
  label?: string;
  openingNameId?: string;
  tags: readonly string[];
  included: boolean;
  pathFingerprint: string;
  note?: string;
  sourceLocator?: SourceLocator;
}

export interface RepertoireMove {
  id: string;
  contextId: string;
  edgeId: string;
  destinationContextId: string;
  actor: MoveActor;
  included: boolean;
  order: number;
  note?: string;
  purpose?: string;
  nags?: readonly string[];
  sourceLocator?: SourceLocator;
}

export interface PlaylistWeighting {
  kind: 'due-first' | 'balanced';
}

export interface Playlist {
  id: string;
  name: string;
  repertoireIds: readonly string[];
  colour?: Colour;
  includedContextIds: readonly string[];
  excludedContextIds: readonly string[];
  maxPly?: number;
  tags: readonly string[];
  weighting: PlaylistWeighting;
  createdAt: string;
  updatedAt: string;
}

export interface RepertoireGraph {
  repertoires: readonly Repertoire[];
  positions: readonly PositionNode[];
  edges: readonly MoveEdge[];
  contexts: readonly RepertoireContext[];
  moves: readonly RepertoireMove[];
  playlists: readonly Playlist[];
}

export interface DecisionQuery {
  repertoireId: string;
  activeContextIds: readonly string[];
  playlistId?: string;
  positionId: string;
  promptMode: PromptMode;
  strictPathFingerprint?: string;
}

export interface AcceptedMoveSet {
  positionId: string;
  moves: readonly {
    edgeId: string;
    uci: string;
    san: string;
    destinationContextIds: readonly string[];
  }[];
  normalizedKey: string;
}

export interface TrainingItemIdentity {
  repertoireId: string;
  contextScopeKey: string;
  positionKey: CanonicalPositionKey;
  acceptedMoveSetKey: string;
  promptMode: PromptMode;
  strictPathFingerprint?: string;
}

export interface LearningSummary {
  status: 'reviewed' | 'current' | 'due' | 'new';
}

export type TreeLabel = { kind: 'visible'; san: string } | { kind: 'masked' };

export interface RepertoireTreeItem {
  itemId: string;
  contextId: string;
  positionId: string;
  edgeId?: string;
  moveId?: string;
  ply: number;
  moveNumber: number;
  actor?: MoveActor;
  label: TreeLabel;
  children: readonly RepertoireTreeItem[];
  isCurrentPath: boolean;
  isCurrentPosition: boolean;
  isTransposition: boolean;
  included: boolean;
  learningSummary: LearningSummary;
}

export interface ImportMove {
  san: string;
  uci: string;
  comment?: string;
  nags: readonly string[];
  sourceLocator: SourceLocator;
  variations: readonly ImportLine[];
}

export interface ImportLine {
  comment?: string;
  moves: readonly ImportMove[];
}

export interface ImportGame {
  headers: Readonly<Record<string, string>>;
  rootComment?: string;
  mainLine: ImportLine;
}

export interface ImportWarning {
  code: string;
  message: string;
  sourceLocator?: SourceLocator;
}

export interface ImportError {
  code: string;
  message: string;
  sourceLocator?: SourceLocator;
}

export interface ImportSummary {
  games: number;
  positions: number;
  moves: number;
  contexts: number;
  variations: number;
  comments: number;
  nags: number;
}

export interface ImportCandidate {
  source: RepertoireSource;
  games: readonly ImportGame[];
  warnings: readonly ImportWarning[];
  errors: readonly ImportError[];
  proposedGraph: RepertoireGraph;
  summary: ImportSummary;
}
