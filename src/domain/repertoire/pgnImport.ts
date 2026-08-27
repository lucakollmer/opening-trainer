import { Chess } from 'chess.js';
import { canonicalPositionKey } from '../chess/positionKey';
import type {
  Colour,
  ImportCandidate,
  ImportError,
  ImportGame,
  ImportLine,
  ImportMove,
  ImportWarning,
  MoveActor,
  MoveEdge,
  PositionNode,
  Repertoire,
  RepertoireContext,
  RepertoireGraph,
  RepertoireMove,
  SourceLocator,
} from './types';
import { validateRepertoireGraph } from './graph';

const PARSER_VERSION = 'opening-trainer-pgn-rav-v1';
const MAX_PGN_BYTES = 1_000_000;
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

interface Token {
  kind: 'symbol' | 'comment' | 'nag' | 'lparen' | 'rparen';
  value: string;
  locator: SourceLocator;
}

interface ParsedMove {
  san: string;
  comment?: string;
  nags: string[];
  locator: SourceLocator;
  variations: ParsedLine[];
}

interface ParsedLine {
  moves: ParsedMove[];
}

interface ParsedGame {
  headers: Record<string, string>;
  rootComment?: string;
  line: ParsedLine;
}

function sourceLocator(game: number, line: number, column: number): SourceLocator {
  return { game, line, column };
}

function splitGames(text: string): { headers: Record<string, string>; movetext: string }[] {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const games: { headers: Record<string, string>; moveLines: string[] }[] = [];
  let current = { headers: {} as Record<string, string>, moveLines: [] as string[] };
  let sawMovetext = false;
  const flush = () => {
    if (Object.keys(current.headers).length > 0 || current.moveLines.join('').trim()) games.push(current);
    current = { headers: {}, moveLines: [] };
    sawMovetext = false;
  };
  for (const line of lines) {
    const match = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\]\s*$/u);
    if (match) {
      if (sawMovetext) flush();
      current.headers[match[1]!] = match[2]!.replace(/\\"/gu, '"').replace(/\\\\/gu, '\\');
      continue;
    }
    if (line.trim()) sawMovetext = true;
    current.moveLines.push(line);
  }
  flush();
  return games.map((game) => ({ headers: game.headers, movetext: game.moveLines.join('\n') }));
}

function tokenize(text: string, game: number): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;
  const advance = (char: string) => {
    if (char === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    index += 1;
  };
  while (index < text.length) {
    const char = text[index]!;
    if (/\s/u.test(char)) {
      advance(char);
      continue;
    }
    const locator = sourceLocator(game, line, column);
    if (char === '(' || char === ')') {
      tokens.push({ kind: char === '(' ? 'lparen' : 'rparen', value: char, locator });
      advance(char);
      continue;
    }
    if (char === '{') {
      advance(char);
      let value = '';
      let closed = false;
      while (index < text.length) {
        const next = text[index]!;
        if (next === '}') {
          advance(next);
          closed = true;
          break;
        }
        value += next;
        advance(next);
      }
      if (!closed) throw Object.assign(new Error('Unterminated PGN comment.'), { locator });
      tokens.push({ kind: 'comment', value: value.trim(), locator });
      continue;
    }
    if (char === ';') {
      advance(char);
      let value = '';
      while (index < text.length && text[index] !== '\n') {
        value += text[index]!;
        advance(text[index]!);
      }
      tokens.push({ kind: 'comment', value: value.trim(), locator });
      continue;
    }
    if (char === '$') {
      let value = '';
      advance(char);
      while (index < text.length && /[0-9]/u.test(text[index]!)) {
        value += text[index]!;
        advance(text[index]!);
      }
      if (!value) throw Object.assign(new Error('Invalid empty numeric annotation glyph.'), { locator });
      tokens.push({ kind: 'nag', value: `$${value}`, locator });
      continue;
    }
    let value = '';
    while (index < text.length && !/[\s(){};]/u.test(text[index]!)) {
      value += text[index]!;
      advance(text[index]!);
    }
    if (value) tokens.push({ kind: 'symbol', value, locator });
  }
  return tokens;
}

function stripMoveNumber(symbol: string): string {
  return symbol.replace(/^\d+\.(?:\.\.)?/u, '');
}

function splitSymbolicNag(symbol: string): { san: string; nag?: string } {
  const match = symbol.match(/^(.*?)(!!|\?\?|!\?|\?!|!|\?)$/u);
  return match ? { san: match[1]!, nag: match[2]! } : { san: symbol };
}

function parseLine(
  tokens: readonly Token[],
  start: number,
  rootComment: { value?: string },
): { line: ParsedLine; next: number } {
  const moves: ParsedMove[] = [];
  let index = start;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token.kind === 'rparen') return { line: { moves }, next: index + 1 };
    if (token.kind === 'lparen') {
      const previous = moves.at(-1);
      if (!previous) throw Object.assign(new Error('Variation has no preceding move.'), { locator: token.locator });
      const parsed = parseLine(tokens, index + 1, {});
      previous.variations.push(parsed.line);
      index = parsed.next;
      continue;
    }
    if (token.kind === 'comment') {
      const previous = moves.at(-1);
      if (previous) previous.comment = previous.comment ? `${previous.comment}\n${token.value}` : token.value;
      else rootComment.value = rootComment.value ? `${rootComment.value}\n${token.value}` : token.value;
      index += 1;
      continue;
    }
    if (token.kind === 'nag') {
      const previous = moves.at(-1);
      if (!previous) throw Object.assign(new Error('NAG has no preceding move.'), { locator: token.locator });
      previous.nags.push(token.value);
      index += 1;
      continue;
    }
    const stripped = stripMoveNumber(token.value);
    if (!stripped || /^\d+\.{1,3}$/u.test(token.value)) {
      index += 1;
      continue;
    }
    if (RESULTS.has(stripped)) {
      index += 1;
      continue;
    }
    const split = splitSymbolicNag(stripped);
    if (!split.san) throw Object.assign(new Error('Empty move token.'), { locator: token.locator });
    moves.push({
      san: split.san,
      nags: split.nag ? [split.nag] : [],
      locator: token.locator,
      variations: [],
    });
    index += 1;
  }
  return { line: { moves }, next: index };
}

function parseGames(text: string): ParsedGame[] {
  return splitGames(text).map((source, gameIndex) => {
    const tokens = tokenize(source.movetext, gameIndex + 1);
    const rootComment: { value?: string } = {};
    const parsed = parseLine(tokens, 0, rootComment);
    if (parsed.next !== tokens.length) {
      throw Object.assign(new Error('Unexpected unmatched variation terminator.'), {
        locator: tokens[parsed.next - 1]?.locator,
      });
    }
    return {
      headers: source.headers,
      ...(rootComment.value ? { rootComment: rootComment.value } : {}),
      line: parsed.line,
    };
  });
}

function actorForFen(fen: string, userColour: Colour): MoveActor {
  const turn = fen.split(/\s+/u)[1];
  return (turn === 'w' ? 'white' : 'black') === userColour ? 'user' : 'opponent';
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function graphFromParsed(
  parsedGames: readonly ParsedGame[],
  options: { repertoireId: string; repertoireName: string; userColour: Colour; sourceLabel: string; sourceHash: string },
): { graph: RepertoireGraph; games: ImportGame[]; warnings: ImportWarning[]; summary: ImportCandidate['summary'] } {
  const positions: PositionNode[] = [];
  const edges: MoveEdge[] = [];
  const contexts: RepertoireContext[] = [];
  const moves: RepertoireMove[] = [];
  const warnings: ImportWarning[] = [];
  const resolvedGames: ImportGame[] = [];
  const positionByKey = new Map<string, PositionNode>();
  const edgeBySourceUci = new Map<string, MoveEdge>();
  const childByParentEdge = new Map<string, RepertoireContext>();
  const moveByContextEdge = new Map<string, RepertoireMove>();
  const rootByPosition = new Map<string, RepertoireContext>();
  let variationCount = 0;
  let commentCount = 0;
  let nagCount = 0;

  const ensurePosition = (fen: string): PositionNode => {
    const key = canonicalPositionKey(fen);
    const existing = positionByKey.get(key);
    if (existing) return existing;
    const position: PositionNode = {
      id: `pos-${String(positions.length + 1).padStart(4, '0')}`,
      key,
      fen,
      createdAt: '1970-01-01T00:00:00.000Z',
    };
    positions.push(position);
    positionByKey.set(key, position);
    return position;
  };

  const resolveLine = (
    parsed: ParsedLine,
    baseFen: string,
    baseContext: RepertoireContext,
  ): ImportLine => {
    let fen = baseFen;
    let context = baseContext;
    const resolvedMoves: ImportMove[] = [];
    for (const parsedMove of parsed.moves) {
      const beforeFen = fen;
      const beforeContext = context;
      let game: Chess;
      try {
        game = new Chess(beforeFen);
      } catch (error) {
        throw Object.assign(new Error(`Invalid source position: ${error instanceof Error ? error.message : 'invalid FEN'}`), {
          locator: parsedMove.locator,
        });
      }
      let move;
      try {
        move = game.move(parsedMove.san);
      } catch {
        move = null;
      }
      if (!move) {
        throw Object.assign(new Error(`Illegal or unparseable PGN move: ${parsedMove.san}`), {
          locator: parsedMove.locator,
        });
      }
      const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
      const sourcePosition = ensurePosition(beforeFen);
      const targetPosition = ensurePosition(game.fen());
      const edgeKey = `${sourcePosition.id}:${uci}`;
      let edge = edgeBySourceUci.get(edgeKey);
      if (!edge) {
        edge = {
          id: `edge-${String(edges.length + 1).padStart(4, '0')}`,
          fromPositionId: sourcePosition.id,
          toPositionId: targetPosition.id,
          uci,
          san: move.san,
          ...(move.promotion ? { promotion: move.promotion as 'q' | 'r' | 'b' | 'n' } : {}),
        };
        edges.push(edge);
        edgeBySourceUci.set(edgeKey, edge);
      } else if (edge.toPositionId !== targetPosition.id || edge.san !== move.san) {
        throw Object.assign(new Error(`Conflicting duplicate branch for ${move.san}.`), {
          locator: parsedMove.locator,
        });
      }

      const childKey = `${beforeContext.id}:${edge.id}`;
      let child = childByParentEdge.get(childKey);
      if (!child) {
        child = {
          id: `ctx-${String(contexts.length + 1).padStart(4, '0')}`,
          repertoireId: options.repertoireId,
          parentContextId: beforeContext.id,
          entryPositionId: targetPosition.id,
          tags: [],
          included: true,
          pathFingerprint: `${beforeContext.pathFingerprint}/${uci}`,
          ...(parsedMove.comment ? { note: parsedMove.comment } : {}),
          sourceLocator: parsedMove.locator,
        };
        contexts.push(child);
        childByParentEdge.set(childKey, child);
      }
      const moveKey = `${beforeContext.id}:${edge.id}`;
      let repertoireMove = moveByContextEdge.get(moveKey);
      if (!repertoireMove) {
        repertoireMove = {
          id: `move-${String(moves.length + 1).padStart(4, '0')}`,
          contextId: beforeContext.id,
          edgeId: edge.id,
          destinationContextId: child.id,
          actor: actorForFen(beforeFen, options.userColour),
          included: true,
          order: moves.filter((item) => item.contextId === beforeContext.id).length,
          ...(parsedMove.comment ? { note: parsedMove.comment } : {}),
          ...(parsedMove.nags.length ? { nags: [...parsedMove.nags] } : {}),
          sourceLocator: parsedMove.locator,
        };
        moves.push(repertoireMove);
        moveByContextEdge.set(moveKey, repertoireMove);
      } else {
        warnings.push({
          code: 'DUPLICATE_BRANCH_CONSOLIDATED',
          message: `Duplicate branch ${move.san} was consolidated.`,
          sourceLocator: parsedMove.locator,
        });
      }

      const variations = parsedMove.variations.map((variation) => {
        variationCount += 1;
        return resolveLine(variation, beforeFen, beforeContext);
      });
      if (parsedMove.comment) commentCount += 1;
      nagCount += parsedMove.nags.length;
      resolvedMoves.push({
        san: move.san,
        uci,
        ...(parsedMove.comment ? { comment: parsedMove.comment } : {}),
        nags: [...parsedMove.nags],
        sourceLocator: parsedMove.locator,
        variations,
      });
      fen = game.fen();
      context = child;
    }
    return { moves: resolvedMoves };
  };

  for (const [index, parsedGame] of parsedGames.entries()) {
    const initialFen = parsedGame.headers.FEN ?? new Chess().fen();
    const rootPosition = ensurePosition(initialFen);
    let root = rootByPosition.get(rootPosition.id);
    if (!root) {
      root = {
        id: `ctx-${String(contexts.length + 1).padStart(4, '0')}`,
        repertoireId: options.repertoireId,
        entryPositionId: rootPosition.id,
        label: parsedGame.headers.Opening ?? `Game ${index + 1}`,
        tags: [],
        included: true,
        pathFingerprint: `root:${rootPosition.key}`,
      };
      contexts.push(root);
      rootByPosition.set(rootPosition.id, root);
    } else {
      warnings.push({
        code: 'DUPLICATE_ROOT_CONSOLIDATED',
        message: `Game ${index + 1} shares an existing root and was consolidated.`,
      });
    }
    const mainLine = resolveLine(parsedGame.line, initialFen, root);
    if (parsedGame.rootComment) commentCount += 1;
    resolvedGames.push({
      headers: parsedGame.headers,
      ...(parsedGame.rootComment ? { rootComment: parsedGame.rootComment } : {}),
      mainLine,
    });
  }

  const repertoire: Repertoire = {
    id: options.repertoireId,
    name: options.repertoireName,
    userColour: options.userColour,
    rootContextIds: [...new Set([...rootByPosition.values()].map((context) => context.id))],
    source: {
      kind: 'pgn',
      label: options.sourceLabel,
      hash: options.sourceHash,
      parserVersion: PARSER_VERSION,
    },
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  const graph: RepertoireGraph = {
    repertoires: [repertoire],
    positions,
    edges,
    contexts,
    moves,
    playlists: [],
  };
  validateRepertoireGraph(graph);
  return {
    graph,
    games: resolvedGames,
    warnings,
    summary: {
      games: resolvedGames.length,
      positions: positions.length,
      moves: moves.length,
      contexts: contexts.length,
      variations: variationCount,
      comments: commentCount,
      nags: nagCount,
    },
  };
}

function importError(error: unknown): ImportError {
  const locator =
    typeof error === 'object' && error !== null && 'locator' in error
      ? (error as { locator?: SourceLocator }).locator
      : undefined;
  return {
    code: 'PGN_IMPORT_ERROR',
    message: error instanceof Error ? error.message : 'Unknown PGN import error.',
    ...(locator ? { sourceLocator: locator } : {}),
  };
}

export function previewPgnImport(
  pgn: string,
  options: {
    repertoireId: string;
    repertoireName: string;
    userColour: Colour;
    sourceLabel?: string;
  },
): ImportCandidate {
  const sourceHash = `fnv1a32:${fnv1a(pgn)}`;
  const source = {
    kind: 'pgn' as const,
    label: options.sourceLabel ?? 'PGN text import',
    hash: sourceHash,
    parserVersion: PARSER_VERSION,
  };
  if (new TextEncoder().encode(pgn).byteLength > MAX_PGN_BYTES) {
    return {
      source,
      games: [],
      warnings: [],
      errors: [{ code: 'PGN_TOO_LARGE', message: `PGN exceeds ${MAX_PGN_BYTES} bytes.` }],
      proposedGraph: { repertoires: [], positions: [], edges: [], contexts: [], moves: [], playlists: [] },
      summary: { games: 0, positions: 0, moves: 0, contexts: 0, variations: 0, comments: 0, nags: 0 },
    };
  }
  try {
    const parsed = parseGames(pgn);
    if (parsed.length === 0 || parsed.every((game) => game.line.moves.length === 0)) {
      throw new Error('PGN contains no repertoire moves.');
    }
    const built = graphFromParsed(parsed, {
      repertoireId: options.repertoireId,
      repertoireName: options.repertoireName,
      userColour: options.userColour,
      sourceLabel: source.label,
      sourceHash,
    });
    return {
      source,
      games: built.games,
      warnings: built.warnings,
      errors: [],
      proposedGraph: built.graph,
      summary: built.summary,
    };
  } catch (error) {
    return {
      source,
      games: [],
      warnings: [],
      errors: [importError(error)],
      proposedGraph: { repertoires: [], positions: [], edges: [], contexts: [], moves: [], playlists: [] },
      summary: { games: 0, positions: 0, moves: 0, contexts: 0, variations: 0, comments: 0, nags: 0 },
    };
  }
}

export interface ImportCommitRepository {
  createRepertoire(candidate: ImportCandidate): void;
}

export class InMemoryImportRepository implements ImportCommitRepository {
  readonly graphs = new Map<string, RepertoireGraph>();

  createRepertoire(candidate: ImportCandidate): void {
    if (candidate.errors.length > 0 || candidate.proposedGraph.repertoires.length !== 1) {
      throw new Error('Only a valid import preview can be committed.');
    }
    const repertoire = candidate.proposedGraph.repertoires[0]!;
    if (this.graphs.has(repertoire.id)) throw new Error(`Repertoire already exists: ${repertoire.id}`);
    validateRepertoireGraph(candidate.proposedGraph);
    this.graphs.set(repertoire.id, candidate.proposedGraph);
  }
}
