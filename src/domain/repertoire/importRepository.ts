import { validateRepertoireGraph } from './graph';
import type {
  ImportCandidate,
  ImportGame,
  ImportSummary,
  ImportWarning,
  RepertoireGraph,
  RepertoireSource,
} from './types';

export interface CommittedRepertoireImport {
  source: RepertoireSource;
  games: readonly ImportGame[];
  warnings: readonly ImportWarning[];
  summary: ImportSummary;
  graph: RepertoireGraph;
}

export interface ImportCommitRepository {
  createRepertoire(candidate: ImportCandidate): void;
}

function snapshotCandidate(candidate: ImportCandidate): CommittedRepertoireImport {
  return structuredClone({
    source: candidate.source,
    games: candidate.games,
    warnings: candidate.warnings,
    summary: candidate.summary,
    graph: candidate.proposedGraph,
  });
}

export class InMemoryImportRepository implements ImportCommitRepository {
  readonly imports = new Map<string, CommittedRepertoireImport>();

  createRepertoire(candidate: ImportCandidate): void {
    if (
      candidate.errors.length > 0 ||
      candidate.proposedGraph.repertoires.length !== 1
    ) {
      throw new Error('Only a valid import preview can be committed.');
    }
    const repertoire = candidate.proposedGraph.repertoires[0]!;
    if (this.imports.has(repertoire.id)) {
      throw new Error(`Repertoire already exists: ${repertoire.id}`);
    }
    validateRepertoireGraph(candidate.proposedGraph);
    this.imports.set(repertoire.id, snapshotCandidate(candidate));
  }
}
