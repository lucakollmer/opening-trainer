import type { TrainingTreeItem } from '../../fixtures/trainingFixtures';
import type {
  LearningSummary,
  RepertoireContext,
  RepertoireGraph,
  RepertoireTreeItem,
} from './types';

export interface TreeProjectionOptions {
  repertoireId: string;
  mode: 'train' | 'browse';
  revealedMoveIds?: readonly string[];
  currentContextId?: string;
  currentPathContextIds?: readonly string[];
  learningByContextId?: Readonly<Record<string, LearningSummary>>;
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function contextDepth(
  context: RepertoireContext,
  contexts: ReadonlyMap<string, RepertoireContext>,
): number {
  let depth = 0;
  let current = context.parentContextId ? contexts.get(context.parentContextId) : undefined;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) throw new Error(`Context cycle while projecting ${context.id}`);
    visited.add(current.id);
    depth += 1;
    current = current.parentContextId ? contexts.get(current.parentContextId) : undefined;
  }
  return depth;
}

export function projectRepertoireTree(
  graph: RepertoireGraph,
  options: TreeProjectionOptions,
): readonly RepertoireTreeItem[] {
  const repertoire = graph.repertoires.find((item) => item.id === options.repertoireId);
  if (!repertoire) throw new Error(`Missing repertoire: ${options.repertoireId}`);
  const contexts = byId(graph.contexts);
  const positions = byId(graph.positions);
  const edges = byId(graph.edges);
  const moveByDestination = new Map(
    graph.moves
      .filter((move) => move.included)
      .map((move) => [move.destinationContextId, move]),
  );
  const destinationCounts = new Map<string, number>();
  for (const move of graph.moves) {
    if (!move.included) continue;
    const edge = edges.get(move.edgeId);
    if (!edge) continue;
    destinationCounts.set(edge.toPositionId, (destinationCounts.get(edge.toPositionId) ?? 0) + 1);
  }
  const childrenByParent = new Map<string, RepertoireContext[]>();
  for (const context of graph.contexts) {
    if (context.repertoireId !== repertoire.id || !context.parentContextId) continue;
    const current = childrenByParent.get(context.parentContextId) ?? [];
    childrenByParent.set(context.parentContextId, [...current, context]);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => {
      const moveA = moveByDestination.get(a.id);
      const moveB = moveByDestination.get(b.id);
      const order = (moveA?.order ?? Number.MAX_SAFE_INTEGER) - (moveB?.order ?? Number.MAX_SAFE_INTEGER);
      return order || a.pathFingerprint.localeCompare(b.pathFingerprint) || a.id.localeCompare(b.id);
    });
  }

  const revealed = new Set(options.revealedMoveIds ?? []);
  const currentPath = new Set(options.currentPathContextIds ?? []);
  const build = (context: RepertoireContext): RepertoireTreeItem => {
    const move = moveByDestination.get(context.id);
    const edge = move ? edges.get(move.edgeId) : undefined;
    const position = positions.get(context.entryPositionId);
    if (!position) throw new Error(`Missing position while projecting context ${context.id}`);
    if (move && !edge) throw new Error(`Missing edge while projecting context ${context.id}`);
    const ply = contextDepth(context, contexts);
    const visible =
      !move || options.mode === 'browse' || revealed.has(move.id) || options.currentContextId === context.id;
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
      learningSummary: options.learningByContextId?.[context.id] ?? { status: 'new' },
    };
  };

  return repertoire.rootContextIds
    .map((id) => contexts.get(id))
    .filter((context): context is RepertoireContext => context !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(build);
}

export function toTrainingTreeItems(
  items: readonly RepertoireTreeItem[],
): readonly TrainingTreeItem[] {
  return items.flatMap((item) => {
    const convertedChildren = toTrainingTreeItems(item.children);
    if (!item.edgeId) return convertedChildren;
    const visibleLabel = item.label.kind === 'visible' ? item.label.san : 'Hidden user move';
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
