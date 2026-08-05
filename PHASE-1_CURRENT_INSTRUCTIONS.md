# PHASE-1 current instructions

This file is the bounded superseding execution record for PHASE-1. Google Drive Assistant Memory remains authoritative.

## Authority and checkpoint

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
phase: PHASE-1
phase_name: Responsive board/tree/task training shell
repository: lucakollmer/opening-trainer
integration_branch: main
verified_base_sha: 6a3685e0eb8817d287d4d2d498698c27c6a9737f
working_branch: phase-1-responsive-shell
predecessor: PHASE-0 accepted and merged
main_validation_run: 30990988283
main_validation_result: success
protection_ruleset: Protect Main
entry_gate: passed
```

## Current authorised operation

Implement PHASE-1 only on `phase-1-responsive-shell` from the exact verified base above.

The first bounded documentation operation is this superseding record. Historical PHASE-0 status in `context.md` and the opening instruction in `plans.md` is obsolete and must not be treated as current authority. Preserve the historical sections until they can be safely reconciled without replacing unrelated programme content.

## Scope

- responsive desktop, tablet, and phone board/tree/task composition;
- standard Material UI controls and MUI X Tree View Community;
- project-owned `react-chessboard` adapter boundary;
- synthetic typed fixtures only;
- Train/Browse masking presentation;
- task-panel fixture state matrix;
- keyboard/focus and reduced-motion foundations;
- strict answer non-disclosure in visible text, accessibility metadata, tooltips, data attributes, and test IDs.

## Non-scope

- real move grading, deterministic opponent, or session reducer;
- repertoire graph, PGN import, production database schema, or durable training evidence;
- FSRS policy;
- backend, authentication, cloud sync, engine, native wrapper, external opening dataset, analytics, or marketplace.

## Validation and evidence

Run focused component tests and the complete GitHub Actions validation sequence against the exact candidate head. Obtain a Cloudflare pull-request preview and responsive desktop/tablet/phone evidence when exposed. Automated evidence does not constitute visual acceptance.

After the reported production React error #130, a user-visible candidate cannot return to the manual-review gate until the exact production bundle passes `docs/testing/RUNTIME_BROWSER_SMOKE.md` at desktop, tablet, and phone viewports. An HTTP response, static build, mocked component test, or deployment-success status is not runtime-render evidence.

## Stop condition

Open one draft pull request to `main`, publish the structured completion report and manual checklist, and stop. Do not merge and do not begin PHASE-2 without Luca's explicit acceptance and continuation instruction.

END_OF_PHASE_INSTRUCTIONS
