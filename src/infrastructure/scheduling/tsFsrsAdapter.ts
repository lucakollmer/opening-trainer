import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRSParameters,
} from 'ts-fsrs';
import {
  SCHEDULER_STATE_SCHEMA_VERSION,
  type SchedulerGrade,
  type SchedulerPort,
  type SchedulerStage,
  type SchedulerState,
} from '../../domain/scheduling/schedulerPort';

export const TS_FSRS_ADAPTER_VERSION = 'ts-fsrs@5.4.1';
export const TS_FSRS_PARAMETERS_VERSION = 'phase5-default-v1';

const STAGE_TO_FSRS: Readonly<Record<SchedulerStage, State>> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const FSRS_TO_STAGE: Readonly<Record<State, SchedulerStage>> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const GRADE_TO_FSRS: Readonly<Record<SchedulerGrade, Rating>> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

function fromCard(card: Card): SchedulerState {
  return {
    schemaVersion: SCHEDULER_STATE_SCHEMA_VERSION,
    dueAt: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    stage: FSRS_TO_STAGE[card.state],
    ...(card.last_review ? { lastReviewAt: card.last_review.toISOString() } : {}),
  };
}

function toCard(state: SchedulerState): Card {
  return {
    due: new Date(state.dueAt),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: STAGE_TO_FSRS[state.stage],
    ...(state.lastReviewAt ? { last_review: new Date(state.lastReviewAt) } : {}),
  };
}

export class TsFsrsSchedulerAdapter implements SchedulerPort {
  public readonly adapterVersion = TS_FSRS_ADAPTER_VERSION;
  public readonly parametersVersion = TS_FSRS_PARAMETERS_VERSION;
  readonly #parameters: FSRSParameters;
  readonly #scheduler: ReturnType<typeof fsrs>;

  public constructor(parameters?: Partial<FSRSParameters>) {
    this.#parameters = generatorParameters({
      ...parameters,
      enable_fuzz: false,
    });
    this.#scheduler = fsrs(this.#parameters);
  }

  public createNew(now: Date): SchedulerState {
    return fromCard(createEmptyCard(now));
  }

  public preview(state: SchedulerState, now: Date) {
    return {
      dueAt: state.dueAt,
      stage: state.stage,
      retrievability: this.retrievability(state, now),
    };
  }

  public review(
    state: SchedulerState,
    grade: SchedulerGrade,
    now: Date,
  ) {
    const result = this.#scheduler.next(toCard(state), now, GRADE_TO_FSRS[grade]);
    const nextState = fromCard(result.card);
    return {
      state: nextState,
      retrievability: this.retrievability(nextState, now),
    };
  }

  public isDue(state: SchedulerState, now: Date): boolean {
    return new Date(state.dueAt).getTime() <= now.getTime();
  }

  public retrievability(state: SchedulerState, now: Date): number {
    return this.#scheduler.get_retrievability(toCard(state), now, false);
  }

  public serializeConfiguration(): string {
    return JSON.stringify(this.#parameters);
  }
}
