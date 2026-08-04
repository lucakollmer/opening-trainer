# Training and scheduling contract

## 1. Separation of concerns

The session generator decides what line/context to present. The session reducer records what happens. The scheduler adapter turns eligible observations into memory updates. These are separate testable modules.

## 2. Review observation

Retain chess-specific raw evidence independent of FSRS:

```ts
type ReviewObservation = {
  id: ReviewLogId;
  trainingItemId: TrainingItemId;
  sessionId: SessionId;
  observedAt: string;
  evidenceRole: 'targeted' | 'incidental';
  outcome:
    | 'instant-correct'
    | 'correct'
    | 'hesitant-correct'
    | 'hinted-correct'
    | 'wrong-variation'
    | 'outside-repertoire'
    | 'illegal-attempt'
    | 'revealed'
    | 'repair-correct';
  responseTimeMs: number;
  hintLevel: 0 | 1 | 2 | 3 | 4;
  illegalAttemptCount: number;
  expectedMoveSetKey: string;
  playedUci?: string;
  confusionContextId?: RepertoireContextId;
  schedulerDecision?: SchedulerDecision;
};
```

Illegal attempts may be logged within the same decision attempt. Do not create several full memory reviews from repeated illegal dragging.

## 3. Targeted versus incidental evidence

### Targeted positive

Eligible for normal scheduler advancement according to mapping.

### Targeted negative

Eligible for failure/lapse handling and same-session repair/retest.

### Incidental positive

Record for analytics/confidence but do not extend the FSRS interval in MVP. It may update a lightweight `lastSeenCorrectAt` or line fluency metric only when this is explicitly modelled.

### Incidental negative

Record failure evidence and queue/promote the item for targeted review. Do not apply an interval update as though it had been an ordinary isolated due review until the targeted attempt occurs, unless the scheduling adapter's accepted policy explicitly says otherwise.

This prevents common prefixes from receiving inflated intervals simply because every deep line traverses them.

## 4. Initial chess-to-FSRS mapping

The mapping is provisional and belongs behind a versioned adapter. Suggested MVP mapping for **targeted** observations:

```text
revealed / outside-repertoire / unresolved wrong-variation -> Again
hint level 3, repeated hesitation, corrected sibling confusion -> Hard
correct first attempt within ordinary response band -> Good
instant correct, no hint, mature item, comfortably within fast band -> Easy
```

Rules:

- illegal attempts alone do not automatically map to Again; use the eventual repertoire outcome plus attempt count;
- a repair-correct result does not overwrite the original failure;
- `Easy` is conservative and unavailable for new/learning items by default;
- response-time bands are configurable and tested, not hard-coded across components;
- hint use can only keep or reduce the grade, never increase it;
- the mapping version is stored with scheduler decisions;
- retain raw observations so a later adapter can replay/recalculate from history if supported.

PHASE-5 must simulate interval behaviour before accepting defaults.

## 5. Scheduler port

```ts
type SchedulerPort = {
  createNew(now: Date): SchedulerState;
  preview(state: SchedulerState, now: Date): SchedulerPreview;
  review(
    state: SchedulerState,
    decision: SchedulerDecision,
    now: Date,
  ): SchedulerReviewResult;
  isDue(state: SchedulerState, now: Date): boolean;
  retrievability(state: SchedulerState, now: Date): number;
};
```

`ts-fsrs` types remain inside the adapter/infrastructure boundary. Portable exports use a project-owned serialized scheduler schema with adapter/version metadata.

## 6. Session generator inputs

```ts
type SessionRequest = {
  playlistId: PlaylistId;
  userColour: Colour;
  mode: 'guided' | 'normal' | 'strict' | 'contrast';
  targetCount?: number;
  approximateMinutes?: number;
  now: Date;
  seed: string;
};
```

Candidate scoring considers:

- due state;
- retrievability/weakness;
- new-item limits;
- branch coverage;
- recent failures/confusions;
- deep decision coverage;
- repeated-prefix cost;
- same-session repair obligations;
- cooldown against immediate duplicate exercises except repair.

MVP uses a documented deterministic heuristic, not machine learning or an opaque optimizer.

## 7. Route construction

For a target item:

1. identify contextual paths from initial position to target position;
2. filter by active playlist and prompt mode;
3. choose a valid path with an injected deterministic policy;
4. construct deterministic opponent replies that preserve target reachability;
5. record alternative accepted user moves and how they affect reachability;
6. continue beyond target to a bounded line endpoint when useful;
7. mark all targeted decisions on the route explicitly.

When a valid accepted alternative diverts from the original target, replan or schedule a replacement exercise. Never punish the user for following an accepted repertoire branch.

## 8. Exercise endpoints

A line endpoint may be:

- imported leaf;
- configured max depth;
- no included continuation;
- pedagogical stop marker;
- target plus a bounded consolidation continuation.

Do not imply the chess game itself is over.

## 9. New-line guided learning

For unseen material:

1. select a short segment ending at a user decision;
2. demonstrate moves with notes as configured;
3. rewind to initial position;
4. ask the user to reproduce the segment;
5. repair errors;
6. extend by one or a few decisions;
7. create new scheduler items only when their answer/context is stable;
8. graduate into normal recall after defined success.

Avoid presenting an entire long imported line once and immediately grading every decision as an ordinary review.

## 10. Hints and scoring

Hint level is monotonic within an attempt. Record each transition. Suggested effects:

- level 1 may permit Hard/Good depending on accepted mapping, never Easy;
- level 2 normally caps at Hard;
- level 3 normally maps to Hard or Again according to whether recall follows independently;
- level 4 full reveal maps to Again;
- reveal initiates repair.

Exact policy is finalized in PHASE-5 simulations and documented with mapping version.

## 11. Wrong-variation confusion

Record a relation between expected context/move and confused sibling context/move. Aggregate by canonical decision position and contextual pair.

A contrast drill becomes eligible after a bounded threshold, such as repeated confusion within a time window. The threshold is configurable and deterministic.

Contrast drill:

- presents the relevant position/context without naming the answer;
- asks for the distinguishing move or branch identification;
- after response, shows the sibling comparison;
- maintains separate scheduling/evidence from normal move recall unless an accepted mapping says otherwise.

## 12. Same-session repair queue

A failed target creates:

- immediate repair requirement;
- delayed retest ticket with minimum separation by decisions/exercises;
- cap on repeated retests to prevent an endless loop;
- session summary flag when unresolved.

A session may end with unresolved failures, which remain due/learning. Do not fabricate success to complete the target count.

## 13. Time measurement

- Start response timing only when the board is ready and the user's turn begins.
- Pause timing while a dialog, promotion selector or app-level error blocks action.
- Use monotonic duration measurement.
- Store bounded milliseconds and review timestamp.
- Tests inject time and never sleep for real response thresholds.

## 14. Session persistence

Persist enough state to recover an interrupted session without duplicating committed reviews:

- session ID and request;
- seed/policy version;
- current exercise and position history;
- target IDs;
- committed observation IDs;
- pending repair/retest queue;
- started/updated timestamps;
- completion/abandonment state.

Use idempotency keys for committing review results. Reopening after a crash must not apply the same scheduler review twice.

## 15. Session summary

Show concise user-facing results:

- targeted decisions completed;
- correct without hint;
- hinted;
- wrong/outside repertoire;
- variation confusions;
- repaired/unresolved;
- new/learning/due counts affected;
- next due indication without exposing raw FSRS internals by default.

Do not convert the session to a game score or imply chess strength.

## 16. Required simulations/tests

PHASE-5 must include deterministic simulations for:

- new item with Again/Hard/Good/Easy mapping;
- mature instant correct;
- hinted correct;
- full reveal and repair;
- wrong sibling variation;
- legal outside repertoire;
- incidental positive prefix repeated many times without interval inflation;
- incidental negative promotion;
- deep target with long mature prefix;
- several due targets sharing a path;
- accepted alternative diverting from selected target;
- transposed equivalent context sharing;
- strict context not sharing;
- same-session retest separation/cap;
- interrupted session idempotency;
- clock/seed determinism.
