import type { TrainingTreeItem } from '../../fixtures/trainingFixtures';
import { contextPly, playlistAllowsRouteContext, required } from './graph';
import type {
  LearningSummary,
  Playlist,
  RepertoireContext,
  RepertoireGraph,
  RepertoireTreeItem,
} from './types';

export interface TreeProjectionOptions {
  repertoireId: string;
  mode: 'train' | 'browse';
  playlistId?: string;
  revealedMoveIds?: readonly string[];
  currentContextId?: string;
  currentPathContextIds?: readonly string[];
  learningByContextId?: Readonly<Record<string, LearningSummary>>;
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function playlistFor(
  graph: RepertoireGraph,
  playlistId: string | undefined,
): Playlist | undefined {
  if (!playlistId) return undefined;
  return required(
    graph.playlists.find((playlist) => playlist.id === playlistId),
    `Missing playlist: ${playlistId}`,
  );
}

export function projectRepertoireTree(
  graph: RepertoireGraph,
  options: TreeProjectionOptions,
): readonly RepertoireTreeItem[] {
  const repertoire = required(
    graph.repertoires.find((item) => item.id === options.repertoireId),
    `Missing repertoire: ${options.repertoireId}`,
  );
  const playlist = playlistFor(graph, options.playlistId);
  if (playlist && !playlist.repertoireIds.includes(repertoire.id)) {
    throw new Error('Selected playlist does not include the projected repertoire.');
  }

  const contexts = byId(graph.contexts);
  const positions = byId(graph.positions);
  const edges = byId(graph.edges);
  const routeAllowed = (context: RepertoireContext) =>
    context.repertoireId === repertoire.id &&
    context.included &&
    (!playlist || playlistAllowsRouteContext(graph, playlist, context));

  const selectedMoves = graph.moves.filter((move) => {
    if (!move.included) return false;
    const context = contexts.get(move.contextId);
    const destination = contexts.get(move.destinationContextId);
    return Boolean(
      context && destination && routeAllowed(context) && routeAllowed(destination),
    );
  });
  const moveByDestination = new Map(
    selectedMoves.map((move) => [move.destinationContextId, move]),
  );
  const destinationCounts = new Map<string, number>();
  for (const move of selectedMoves) {
    const edge = edges.get(move.edgeId);
    if (!edge) continue;
    destinationCounts.set(
      edge.toPositionId,
      (destinationCounts.get(edge.toPositionId) ?? 0) + 1,
    );
  }

  const childrenByParent = new Map<string, RepertoireContext[]>();
  for (const context of graph.contexts) {
    if (!context.parentContextId || !routeAllowed(context)) continue;
    const current = childrenByParent.get(context.parentContextId) ?? [];
    childrenByParent.set(context.parentContextId, [...current, context]);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => {
      const moveA = moveByDestination.get(a.id);
      const moveB = moveByDestination.get(b.id);
      const order =
        (moveA?.order ?? Number.MAX_SAFE_INTEGER) -
        (moveB?.order ?? Number.MAX_SAFE_INTEGER);
      return (
        order ||
        a.pathFingerprint.localeCompare(b.pathFingerprint) ||
        a.id.localeCompare(b.id)
      );
    });
  }

  const revealed = new Set(options.revealedMoveIds ?? []);
  const currentPath = new Set(options.currentPathContextIds ?? []);
  const build = (context: RepertoireContext): RepertoireTreeItem => {
    const move = moveByDestination.get(context.id);
    const edge = move ? edges.get(move.edgeId) : undefined;
    const position = required(
      positions.get(context.entryPositionId),
      `Missing position while projecting context ${context.id}`,
    );
    if (move && !edge) {
      throw new Error(`Missing edge while projecting context ${context.id}`);
    }
    const ply = contextPly(context, contexts);
    const visible =
      !move ||
      options.mode === 'browse' ||
      revealed.has(move.id) ||
      options.currentContextId === context.id;
    const children = (childrenByParent.get(context.id) ?? []).map(build);
    return {
      itemId: `tree:${context.id}`,
      contextId: context.id,
      positionId: position.id,
      ...(edge ? { edgeId: edge.id } : {}),
      ...(move ? { moveId: move.id, actor: move.actor } : {}),
      ply,
      moveNumber: ply === 0 ? 1 : Math.floor((ply - 1) / 2) + 1,
      label: edge && visible ? { kind: 'visible', san: edge.san } : { kind: 'masked' },
      children,
      isCurrentPath: currentPath.has(context.id),
      isCurrentPosition: options.currentContextId === context.id,
      isTransposition: (destinationCounts.get(position.id) ?? 0) > 1,
      included: context.included && (move?.included ?? true),
      learningSummary: options.learningByContextId?.[context.id] ?? {
        status: 'new',
      },
    };
  };

  return repertoire.rootContextIds
    .map((id) => contexts.get(id))
    .filter((context): context is RepertoireContext =>
      Boolean(context && routeAllowed(context)),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(build);
}

export function toTrainingTreeItems(
  items: readonly RepertoireTreeItem[],
): readonly TrainingTreeItem[] {
  return items.flatMap((item) => {
    const convertedChildren = toTrainingTreeItems(item.children);
    if (!item.edgeId) return convertedChildren;
    const visibleLabel =
      item.label.kind === 'visible' ? item.label.san : 'Hidden user move';
    return [
      {
        id: item.moveId ?? item.itemId,
        ply: Math.max(0, item.ply - 1),
        visibleLabel,
        maskedLabel: 'Hidden user move',
        status: item.learningSummary.status,
        ...(item.isTransposition ? { transposition: true } : {}),
        ...(convertedChildren.length > 0 ? { children: convertedChildren } : {}),
      },
    ];
  });
}
