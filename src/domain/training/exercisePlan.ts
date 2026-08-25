import { moveToUci, tryApplyMove, type PromotionPiece } from '../chess/chessAdapter';
import { canonicalPositionKey } from '../chess/positionKey';
import type {
  TrainingFixture,
  TrainingFixtureMove,
  TrainingHint,
  TrainingTreeItem,
} from '../../fixtures/trainingFixtures';

export type ExerciseActor = 'user' | 'opponent';

export interface ExerciseAcceptedMove {
  uci: string;
  san: string;
  from: string;
  to: string;
  promotion?: PromotionPiece;
  nextStepId?: string;
  destinationContextIds: readonly string[];
  targetDisposition: 'preserved' | 'displaced';
}

export interface TrainingExerciseStep {
  id: string;
  actor: ExerciseActor;
  positionKey: string;
  treeItemId: string;
  trainingItemId: string;
  acceptedMoveSetKey: string;
  acceptedMoves: readonly ExerciseAcceptedMove[];
  selectedMoveUci: string;
  wrongSiblingUci: readonly string[];
  hint?: TrainingHint;
}

export interface TrainingExercisePlan {
  id: string;
  sourceId: string;
  initialFen: string;
  firstStepId: string;
  targetStepId: string;
  targetPly: number;
  totalPlies: number;
  steps: Readonly<Record<string, TrainingExerciseStep>>;
  tree: readonly TrainingTreeItem[];
}

function collectTreeIds(
  items: readonly TrainingTreeItem[],
  seen = new Set<string>(),
): Set<string> {
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate training tree item ID: ${item.id}`);
    }
    seen.add(item.id);
    collectTreeIds(item.children ?? [], seen);
  }
  return seen;
}

function moveInputFromUci(uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/u.test(uci)) {
    throw new Error(`Invalid UCI move in fixture: ${uci}`);
  }
  const promotion = uci[4] as PromotionPiece | undefined;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(promotion ? { promotion } : {}),
  };
}

function acceptedSetKey(accepted: readonly string[]): string {
  return [...new Set(accepted)].sort().join('|');
}

function expectedUci(step: TrainingFixtureMove): string {
  return moveToUci({
    from: step.from,
    to: step.to,
    ...(step.promotion ? { promotion: step.promotion } : {}),
  });
}

export function compileTrainingFixture(
  fixture: TrainingFixture,
): TrainingExercisePlan {
  if (fixture.route.length === 0) {
    throw new Error('A training fixture requires a route.');
  }
  if (fixture.targetPly < 0 || fixture.targetPly >= fixture.route.length) {
    throw new Error('Training fixture targetPly is outside the route.');
  }

  const treeIds = collectTreeIds(fixture.tree);
  const routeIds = new Set<string>();
  const steps: Record<string, TrainingExerciseStep> = {};
  let fen = fixture.initialFen;
  canonicalPositionKey(fen);

  fixture.route.forEach((step, index) => {
    if (routeIds.has(step.id)) {
      throw new Error(`Duplicate training route step ID: ${step.id}`);
    }
    routeIds.add(step.id);
    if (!treeIds.has(step.treeItemId)) {
      throw new Error(
        `Training route step references missing tree item: ${step.treeItemId}`,
      );
    }

    const routeUci = expectedUci(step);
    const accepted = [...new Set(step.acceptedUci)];
    if (!accepted.includes(routeUci)) {
      throw new Error(`Fixture route move ${routeUci} is absent from its accepted set.`);
    }

    const selected = tryApplyMove(fen, moveInputFromUci(routeUci));
    if (!selected.ok) {
      throw new Error(`Fixture route move ${routeUci} is not legal: ${selected.code}`);
    }
    if (selected.move.san !== step.san) {
      throw new Error(
        `Fixture SAN mismatch for ${routeUci}: expected ${step.san}, got ${selected.move.san}.`,
      );
    }

    const nextStepId = fixture.route[index + 1]?.id;
    const acceptedMoves = accepted.map((uci) => {
      const result = tryApplyMove(fen, moveInputFromUci(uci));
      if (!result.ok) {
        throw new Error(`Accepted fixture move ${uci} is not legal.`);
      }
      if (result.move.fen !== selected.move.fen) {
        throw new Error(
          'Fixture-only plans cannot route divergent accepted alternatives; use a graph-backed exercise plan.',
        );
      }
      return {
        uci,
        san: result.move.san,
        from: result.move.from,
        to: result.move.to,
        ...(result.move.promotion ? { promotion: result.move.promotion } : {}),
        ...(nextStepId ? { nextStepId } : {}),
        destinationContextIds: [] as const,
        targetDisposition: 'preserved' as const,
      };
    });

    for (const sibling of step.wrongSiblingUci ?? []) {
      if (accepted.includes(sibling)) {
        throw new Error(`Wrong-sibling move ${sibling} is also marked accepted.`);
      }
      const result = tryApplyMove(fen, moveInputFromUci(sibling));
      if (!result.ok) {
        throw new Error(`Wrong-sibling fixture move ${sibling} is not legal.`);
      }
    }

    steps[step.id] = {
      id: step.id,
      actor: step.actor,
      positionKey: canonicalPositionKey(fen),
      treeItemId: step.treeItemId,
      trainingItemId: `${fixture.id}:${step.id}`,
      acceptedMoveSetKey: acceptedSetKey(accepted),
      acceptedMoves,
      selectedMoveUci: routeUci,
      wrongSiblingUci: [...(step.wrongSiblingUci ?? [])],
      ...(step.hint ? { hint: step.hint } : {}),
    };
    fen = selected.move.fen;
  });

  const targetStep = fixture.route[fixture.targetPly];
  if (!targetStep || targetStep.actor !== 'user') {
    throw new Error('Training fixture targetPly must identify a user decision.');
  }

  return {
    id: `fixture-plan:${fixture.id}`,
    sourceId: fixture.id,
    initialFen: fixture.initialFen,
    firstStepId: fixture.route[0]!.id,
    targetStepId: targetStep.id,
    targetPly: fixture.targetPly,
    totalPlies: fixture.route.length,
    steps,
    tree: fixture.tree,
  };
}

export function exerciseStep(
  plan: TrainingExercisePlan,
  stepId: string | undefined,
): TrainingExerciseStep | null {
  return stepId ? (plan.steps[stepId] ?? null) : null;
}
