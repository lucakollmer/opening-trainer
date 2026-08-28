# PHASE-5 scheduler and adaptive-session policy v1

## Scheduler boundary

`SchedulerPort` is project-owned. `ts-fsrs@5.4.1` is imported only by
`src/infrastructure/scheduling/tsFsrsAdapter.ts`. Portable state uses project enums and
ISO timestamps. `enable_fuzz` is disabled so a fixed state/time/grade has a deterministic
result.

## Mapping versions

- chess mapping: `chess-fsrs-v1`
- response bands: `response-bands-v1`
- adapter: `ts-fsrs@5.4.1`
- parameters profile: `phase5-default-v1`

The raw `ReviewObservation` is never rewritten to contain an FSRS grade. The separate
scheduler-decision row records the mapping result.

## Response bands

Response duration is measured with the browser monotonic clock and the review timestamp
is recorded separately from the wall clock.

| Item stage | fast | ordinary | hesitant |
| --- | ---: | ---: | ---: |
| new / learning / relearning | <= 5 s | <= 15 s | > 15 s |
| review | <= 3.5 s | <= 12 s | > 12 s |

A mature item is a review-stage item with at least three repetitions and stability of at
least three days. Only mature, fast, unhinted recall can receive `Easy` from an ordinary
`correct` observation. Explicit `instant-correct` follows the same maturity restriction.

## Targeted mapping

| Evidence | FSRS result |
| --- | --- |
| reveal / hint level 4 | Again |
| wrong sibling variation | Again |
| legal outside repertoire | Again |
| hesitant recall | Hard |
| ordinary correct | Good |
| mature fast unhinted correct | Easy |
| repair-correct | no scheduler update |

Hint and illegal-attempt caps can only reduce a positive grade:

- hint 1: at most Good;
- hint 2 or 3: at most Hard;
- one illegal attempt before success: at most Good;
- two or more illegal attempts before success: at most Hard;
- Easy is unavailable outside review-stage mature items.

## Incidental mapping

Positive incidental observations receive a scheduler decision with action `none` and do
not extend an interval. Incidental failures receive `promote-target`; they create targeted
repair/retest work but do not apply a scheduler review until that targeted attempt occurs.
This is the invariant that prevents shared mature prefixes from accumulating artificial
interval growth.

## Adaptive generator

Version: `adaptive-generator-v1`.

Selection is deterministic and lexicographic rather than an opaque weighted optimizer.
For Normal, Guided and Strict sessions the order is:

1. explicit repair/replacement obligation when present;
2. weak or recently failed due item;
3. ordinary due item;
4. bounded new item;
5. optional non-due reinforcement.

Within a class the ordering uses overdue duration, lower retrievability, recent failure,
repeated-prefix penalty, exercise cooldown, depth, then a stable seeded hash. A new-item
limit is enforced independently of the requested target count.

Contrast is an explicit bounded session mode in PHASE-5 rather than being silently mixed
into ordinary recall. It becomes eligible after two recorded confusion events with the
latest event within 30 days. The toolbar reports eligible contrast work and a Contrast
session selects only those items. Full contrast management remains PHASE-6 scope.

Selected targets that occur on one complete route are batched, up to three explicit
target decisions per route. All other user decisions on the route remain incidental.
Different routes become separate persisted exercise descriptors in the adaptive session.
Prompt-mode scheduler items are derived on demand. A playlist that materially narrows an
accepted answer set receives a scoped item; when the answer set is unchanged, the existing
unscoped memory item is reused rather than duplicated.

## Accepted alternatives

Every accepted move remains correct. For each accepted move the graph plan stores the
scheduled targets that cease to be reachable. Those displaced target step IDs become
replacement tickets with the same separation/cap rules as other same-session retests.
A batched target that was already answered is never requeued merely because a later valid
branch displaces a deeper target. The answered decision is still scored normally.

## Bounded session settings

The Phase-5 toolbar exposes only bounded session controls: target count, new-item limit,
prompt mode and opponent delay. Opponent delay is a presentation setting (0, 150, 300 or
600 ms) and never enters candidate scoring, evidence mapping or FSRS state. Reduced-motion
mode overrides the visual delay to zero without changing scheduler semantics.

## Recovery and idempotency

Adaptive session metadata stores the seed and deterministic exercise descriptors. Reload
rebuilds the current route from those descriptors instead of re-running candidate
selection against already-mutated scheduler state.

A raw observation, its scheduler decision and any resulting scheduler-state update commit
in one Dexie transaction using the observation ID as the idempotency key. Re-saving a
session snapshot cannot advance the same review twice.


## Same-session retest orchestration

A failure keeps its original negative observation, requires immediate repair, and creates
a delayed retest ticket with minimum separation one and maximum two returns for that
decision. If a line ends before the ticket is ready and another scheduled exercise exists,
the coordinator places that intervening route first and persists a deterministic retest
exercise descriptor after it. If no intervening work exists, the failure remains explicitly
unresolved; the session never invents success merely to satisfy the requested target count.
