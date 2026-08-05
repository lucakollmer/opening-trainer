import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRSParameters,
} from 'ts-fsrs';

export interface SchedulingFoundationPort {
  createCard(): Card;
  serializeConfiguration(): string;
}

export class FsrsSchedulingFoundationAdapter implements SchedulingFoundationPort {
  readonly #parameters: FSRSParameters;
  public constructor(parameters?: FSRSParameters) {
    this.#parameters =
      parameters ??
      generatorParameters({
        enable_fuzz: false,
      });
    fsrs(this.#parameters);
  }

  public createCard(): Card {
    return createEmptyCard();
  }

  public serializeConfiguration(): string {
    return JSON.stringify(this.#parameters);
  }
}
