import { canonicalPositionKey } from '../chess/positionKey';
import { moveFromUci, tryApplyMove, type PromotionPiece } from '../chess/chessAdapter';
import type {
  FixtureActor,
  TrainingFixture,
  TrainingHint,
  TrainingTreeItem,
} from '../../fixtures/trainingFixtures';

export interface TrainingExerciseStep {
  id: string;
  ply: number;
  actor: FixtureActor;
  from: string;
  to: string;
  promotion?: PromotionPiece;
  san: string;
  treeItemId: string;
  acceptedUci: readonly string[];
  acceptedMoveSetKey: string;
  trainingItemId: string;
  positionKey: string;
  wrongSiblingUci?: readonly string[];
  hint?: TrainingHint;
  nextStepId?: string;
  nextStepByAcceptedUci: Readonly<Record<string, string | undefined>>;
  treeItemIdByAcceptedUci?: Readonly<Record<string, string>>;
  targetDispositionByAcceptedUci?: Readonly<
    Record<string, 'preserved' | 'displaced'>
  >;
}

export interface TrainingExercisePlan {
  id: string;
  label: string;
  description: string;
  orientation: 'white' | 'black';
  userColour: 'white' | 'black';
  initialFen: string;
  startStepId: string;
  targetStepId: string;
  steps: readonly TrainingExerciseStep[];
  tree: readonly TrainingTreeItem[];
}

function treeIds(items: readonly TrainingTreeItem[]): Set<string> {
  const result = new Set<string>();
  const visit = (nodes: readonly TrainingTreeItem[]) => {
    for (const node of nodes) {
      if (result.has(node.id)) throw new Error(`Duplicate tree item ID: ${node.id}`);
      result.add(node.id);
      visit(node.children ?? []);
    }
  };
  visit(items);
  return result;
}

export function normalizedAcceptedMoveSet(moves: readonly string[]): string {
  return [...new Set(moves.map((move) => move.toLowerCase()))].sort().join('|');
}

export function compileTrainingFixture(fixture: TrainingFixture): TrainingExercisePlan {
  if (fixture.route.length === 0) throw new Error('A training fixture requires route moves.');
  if (fixture.targetPly < 0 || fixture.targetPly >= fixture.route.length) {
    throw new Error(`Fixture target ply is outside the route: ${fixture.targetPly}`);
  }

  const knownTreeIds = treeIds(fixture.tree);
  const stepIds = new Set<string>();
  const compiled: TrainingExerciseStep[] = [];
  let fen = fixture.initialFen;

  canonicalPositionKey(fen);

  fixture.route.forEach((step, index) => {
    if (stepIds.has(step.id)) throw new Error(`Duplicate route step ID: ${step.id}`);
    stepIds.add(step.id);
    if (!knownTreeIds.has(step.treeItemId)) {
      throw new Error(`Missing tree item ${step.treeItemId} for route step ${step.id}`);
    }

    const positionKey = canonicalPositionKey(fen);
    const routeUci = `${step.from}${step.to}${step.promotion ?? ''}`;
    if (!step.acceptedUci.includes(routeUci)) {
      throw new Error(`Route move ${routeUci} is absent from accepted set at ${step.id}`);
    }

    for (const acceptedUci of step.acceptedUci) {
      const input = moveFromUci(acceptedUci);
      if (!input) throw new Error(`Invalid accepted UCI ${acceptedUci} at ${step.id}`);
      const accepted = tryApplyMove(fen, input);
      if (accepted.kind !== 'applied') {
        throw new Error(`Accepted move ${acceptedUci} is not legal at ${step.id}`);
      }
    }

    const routeResult = tryApplyMove(fen, {
      from: step.from,
      to: step.to,
      ...(step.promotion ? { promotion: step.promotion } : {}),
    });
    if (routeResult.kind !== 'applied') {
      throw new Error(`Fixture route move is not legal at ${step.id}`);
    }
    if (routeResult.move.uci !== routeUci || routeResult.move.san !== step.san) {
      throw new Error(
        `Fixture route notation mismatch at ${step.id}: expected ${step.san}/${routeUci}, got ${routeResult.move.san}/${routeResult.move.uci}`,
      );
    }

    const nextStepId = fixture.route[index + 1]?.id;
    compiled.push({
      ...step,
      ply: index,
      acceptedMoveSetKey: normalizedAcceptedMoveSet(step.acceptedUci),
      trainingItemId: `${fixture.id}:decision:${positionKey}:${normalizedAcceptedMoveSet(step.acceptedUci)}`,
      positionKey,
      ...(nextStepId ? { nextStepId } : {}),
      nextStepByAcceptedUci: Object.fromEntries(
        step.acceptedUci.map((uci) => [uci, nextStepId]),
      ),
      treeItemIdByAcceptedUci: Object.fromEntries(
        step.acceptedUci.map((uci) => [uci, step.treeItemId]),
      ),
      targetDispositionByAcceptedUci: Object.fromEntries(
        step.acceptedUci.map((uci) => [uci, 'preserved' as const]),
      ),
    });
    fen = routeResult.move.fen;
  });

  const target = compiled[fixture.targetPly];
  if (!target || target.actor !== 'user') {
    throw new Error('Fixture target must resolve to a user decision.');
  }

  return {
    id: fixture.id,
    label: fixture.label,
    description: fixture.description,
    orientation: fixture.orientation,
    userColour: fixture.userColour,
    initialFen: fixture.initialFen,
    startStepId: compiled[0]!.id,
    targetStepId: target.id,
    steps: compiled,
    tree: fixture.tree,
  };
}

export function exerciseStep(
  plan: TrainingExercisePlan,
  stepId: string | undefined,
): TrainingExerciseStep | null {
  if (!stepId) return null;
  return plan.steps.find((step) => step.id === stepId) ?? null;
}
