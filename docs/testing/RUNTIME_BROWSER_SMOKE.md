# Runtime browser smoke gate

## Purpose

Prevent a compiled but non-rendering production bundle from reaching a manual review gate.
This gate is distinct from the full browser-functional suite planned for PHASE-7.

## Applicability

From PHASE-1 onward, every pull request that changes application startup, providers,
routing, visible React composition, third-party UI adapters, fixture data passed to those
adapters, or production build configuration must pass this gate.

## Required execution

GitHub Actions must:

1. build the exact candidate tree;
2. serve the production output with `vite preview`;
3. load it in a real headless Chrome process at desktop, tablet, and phone viewports;
4. wait for client-side JavaScript to execute;
5. require the expected application heading and training-board content in the rendered DOM;
6. fail when the global error boundary renders;
7. fail on React runtime errors, uncaught exceptions, `TypeError`, or `ReferenceError` in the browser log;
8. retain the rendered DOM, browser log, preview log, and screenshots as a workflow artifact.

An HTTP 200 response, successful asset compilation, or non-empty screenshot file is not
sufficient evidence by itself.

## Handoff rule

ChatGPT must inspect the exact-head browser-smoke result before reporting a user-visible
candidate as complete for manual review. If the runtime cannot execute or inspect a real
browser check, the candidate remains technically unverified and must not be represented as
a working preview.

## Regression rule

Every startup or rendering defect adds the smallest deterministic test that fails before the
repair, then reruns the complete validation and runtime browser-smoke gates on the exact new
head.
