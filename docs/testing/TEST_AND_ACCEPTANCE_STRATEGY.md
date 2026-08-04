# Test and acceptance strategy

## 1. Test pyramid

### Pure unit tests

Highest volume. Cover chess normalisation, graph operations, transpositions, accepted move sets, training reducer, scheduler mapping, import validation and deterministic selection.

### Repository/infrastructure tests

Use fake IndexedDB/isolated databases for Dexie repositories, migrations and transactions. Test import/export round trips and idempotency.

### Component/integration tests

Use Testing Library and user-event for MUI/React behaviour. Test user-observable semantics rather than internal component state.

### Browser functional tests

Introduced in PHASE-7 with Playwright or an equivalent accepted tool. Cover core flows and responsive breakpoints. Browser automation is functional evidence, not Luca's visual acceptance.

## 2. Baseline tools

Intended after PHASE-0:

```text
Vitest
jsdom
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
fake-indexeddb
```

Playwright is deferred until PHASE-7.

## 3. Determinism

Inject:

- clock;
- monotonic response timer;
- random/seed source;
- opponent policy;
- database name/factory;
- file import text/bytes;
- service-worker environment where practical.

Tests do not depend on real time, network opening APIs, private repertoire or existing browser state.

## 4. Core fixture families

See `docs/fixtures/FIXTURE_CATALOGUE.md`. Required families include:

- a small branching white repertoire;
- a black repertoire;
- exact transposition by two move orders;
- same position with different contextual accepted sets;
- multiple accepted user moves;
- sibling variation confusion;
- castling-right and en-passant position-key cases;
- deep target with mature prefix;
- import with recursive variations/comments;
- malformed/illegal PGN;
- complete backup and previous schema fixture.

## 5. Domain test matrix

### Chess adapter

- legal/illegal moves;
- castling, promotion and en passant;
- SAN/UCI conversions;
- position key normalization;
- equivalent/different state fixtures.

### Repertoire

- graph construction;
- edge uniqueness;
- tree projection;
- deterministic order;
- branch inclusion;
- accepted alternatives;
- transposition sharing and contextual non-sharing;
- playlist filtering;
- dangling/cyclic invalid data.

### Training

- exercise construction from initial position;
- deterministic opponent moves;
- correct/illegal/outside/wrong-variation outcomes;
- accepted alternative route replanning;
- hint progression;
- answer non-disclosure;
- repair and delayed retest;
- line/session completion;
- interrupted session recovery.

### Scheduling

- every observation mapping;
- targeted/incidental policy;
- interval simulations;
- policy version serialization;
- same-session lapse handling;
- no duplicate scheduler update on retry/reload.

### Persistence/import/export

- absent database first run;
- current schema round trip;
- previous schema migration;
- transaction rollback;
- invalid backup rejection;
- complete export/clean restore equivalence;
- PGN preview/commit and warning report;
- unsupported recursive variation does not flatten silently.

## 6. UI test matrix

- desktop and compact shell composition;
- tree drawer open/close and focus restoration;
- current task state transitions;
- board event to typed command;
- promotion interaction;
- correct/error feedback semantics;
- masked move absent from DOM/accessibility tree before response;
- revealed move present after response;
- MUI dialog focus and cancellation;
- import preview/confirm/cancel;
- loading/empty/error states;
- no horizontal overflow at representative widths;
- reduced-motion behaviour where implemented.

## 7. PWA state matrix

PHASE-7 covers:

- first online load and service-worker registration;
- offline reload after caching;
- new build/update available;
- update activation path;
- IndexedDB preserved through update;
- cache reset separate from data reset;
- install manifest/icon validation;
- standalone display launch where harness supports it;
- unsupported install environment degrades to normal web app.

## 8. Validation and evidence

PHASE-0 establishes scripts. GitHub Actions runs the exact candidate tree with the intended full command:

```powershell
pnpm validate
```

It should call the accepted set of lint, typecheck, unit/integration tests, build and pack-specific checks. PWA/browser commands may be separate until their phases introduce them.

The validation script includes or is supplemented by:

```powershell
pnpm exec prettier --check .
git diff --check
```

Record exact observed results, workflow/run IDs and tested SHA, not estimated pass counts. Local or Codespaces runs may assist debugging but are not the programme evidence source.

## 9. Manual acceptance ownership

ChatGPT and GitHub Actions do not declare visual acceptance. The structured report supplies a numbered checklist. Luca reports pass/fail and evidence.

Every item states:

- action;
- expected visible result;
- expected persisted/domain result;
- failure evidence to return.

Manual checks should use synthetic/user-created test repertoire, not sensitive or proprietary content.

## 10. Phase-gate rule

A technically complete PR may remain pending manual acceptance. Do not change `context.md` to accepted or start the next phase until Luca explicitly accepts the phase.

## 11. Regression policy

Every defect correction adds the smallest test that would have failed before the repair. A correction reruns the full applicable GitHub Actions phase validation on the exact new head, not only the new focused test.

## 12. Performance bounds

Avoid premature benchmarks, but protect core interactions:

- board move response remains immediate for normal fixture sizes;
- tree projection avoids unnecessary full reconstruction per render;
- import runs off the critical render path and provides progress for large files if needed;
- session generation is deterministic and bounded;
- large-tree virtualization is added only after measured need and library/licence review.

PHASE-7 records representative synthetic sizes and observed behaviour without inventing universal performance claims.
