import { validateRepertoireGraph } from '../../domain/repertoire/graph';
import type {
  RepertoireContext,
  RepertoireGraph,
  RepertoireMove,
} from '../../domain/repertoire/types';

const STANDARD_INITIAL_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

function escapeTag(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function commentText(value: string | undefined): string {
  if (!value) return '';
  const clean = value.replace(/[{}]/gu, '').trim();
  return clean ? ` {${clean}}` : '';
}

function movePrefix(fen: string): string {
  const fields = fen.trim().split(/\s+/u);
  const turn = fields[1];
  const moveNumber = Number(fields[5] ?? '1');
  const number = Number.isFinite(moveNumber) && moveNumber > 0 ? moveNumber : 1;
  return turn === 'b' ? `${number}...` : `${number}.`;
}

function isStandardRoot(fen: string): boolean {
  return fen.split(/\s+/u).slice(0, 4).join(' ') === STANDARD_INITIAL_POSITION;
}

export function exportRepertoirePgn(
  graph: RepertoireGraph,
  repertoireId: string,
): string {
  validateRepertoireGraph(graph);
  const repertoire = graph.repertoires.find((item) => item.id === repertoireId);
  if (!repertoire) throw new Error(`Missing repertoire ${repertoireId}.`);
  const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
  const positions = new Map(graph.positions.map((position) => [position.id, position]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));

  const outgoing = (contextId: string): RepertoireMove[] =>
    graph.moves
      .filter((move) => move.contextId === contextId && move.included)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const renderMove = (move: RepertoireMove): string => {
    const context = contexts.get(move.contextId);
    const edge = edges.get(move.edgeId);
    if (!context || !edge) throw new Error(`Cannot export dangling move ${move.id}.`);
    const position = positions.get(context.entryPositionId);
    if (!position)
      throw new Error(`Cannot export missing position ${context.entryPositionId}.`);
    const nags = move.nags?.length ? ` ${move.nags.join(' ')}` : '';
    const note = move.note ?? move.purpose;
    return `${movePrefix(position.fen)} ${edge.san}${nags}${commentText(note)}`;
  };

  const renderMoveAndContinuation = (
    move: RepertoireMove,
    visited: ReadonlySet<string>,
  ): string => {
    const destination = contexts.get(move.destinationContextId);
    if (!destination)
      throw new Error(`Missing destination ${move.destinationContextId}.`);
    const nextVisited = new Set(visited);
    nextVisited.add(move.contextId);
    const continuation = renderContext(destination, nextVisited);
    return [renderMove(move), continuation].filter(Boolean).join(' ');
  };

  const renderContext = (
    context: RepertoireContext,
    visited: ReadonlySet<string>,
  ): string => {
    if (visited.has(context.id)) {
      throw new Error(`Context cycle detected while exporting ${context.id}.`);
    }
    const moves = outgoing(context.id);
    if (moves.length === 0) return '';
    const main = moves[0]!;
    const nextVisited = new Set(visited);
    nextVisited.add(context.id);
    const mainText = renderMove(main);
    const variations = moves
      .slice(1)
      .map((variation) => `(${renderMoveAndContinuation(variation, nextVisited)})`);
    const destination = contexts.get(main.destinationContextId);
    if (!destination)
      throw new Error(`Missing destination ${main.destinationContextId}.`);
    const continuation = renderContext(destination, nextVisited);
    return [mainText, ...variations, continuation].filter(Boolean).join(' ');
  };

  const games = repertoire.rootContextIds.map((rootId, index) => {
    const root = contexts.get(rootId);
    if (!root) throw new Error(`Missing root context ${rootId}.`);
    const position = positions.get(root.entryPositionId);
    if (!position) throw new Error(`Missing root position ${root.entryPositionId}.`);
    const headers = [
      `[Event "Opening Trainer repertoire export"]`,
      `[Repertoire "${escapeTag(repertoire.name)}"]`,
      `[Line "${escapeTag(root.label ?? `Line ${index + 1}`)}"]`,
      `[Result "*"]`,
    ];
    if (!isStandardRoot(position.fen)) {
      headers.push('[SetUp "1"]', `[FEN "${escapeTag(position.fen)}"]`);
    }
    const movetext = renderContext(root, new Set());
    return `${headers.join('\n')}\n\n${movetext}${movetext ? ' ' : ''}*`;
  });

  return `${games.join('\n\n')}\n`;
}
