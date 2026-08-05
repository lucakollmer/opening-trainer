# Structured completion report template

```text
# <Operation or PHASE-N> completion report

final_status: COMPLETE_FOR_MANUAL_REVIEW | BLOCKED | INCOMPLETE
report_schema_compliance: full | partial
project: PRJ-CHESS-OPENING-TRAINER
phase_or_operation: <value>
repository: lucakollmer/opening-trainer
verified_base_sha: <sha>
working_branch: <branch>
tested_head_or_tree_sha: <sha>
draft_pr: <url or number>
manual_ui_validation_by_luca: pending | pass | fail
continuation_authorised: false

## Entry-gate evidence

- Drive authority read:
- workflow authority read:
- repository/visibility observed:
- expected and observed base:
- expected and observed head:
- predecessor acceptance/merge evidence:
- active modifying workflow check:
- operations still blocked:

## Implementation

Map completed work to the exact phase or migration acceptance criteria.

## Reusable UI/UX implementation

For every UI behaviour: existing component/hook/contract, path, reuse|compose|extend|create, reason, focused tests, host integration tests, and evidence.

## Reuse and duplication audit

State searches/audits and justified exceptions.

## Data, schema and portability effects

State exact database, backup, migration, import/export, service-worker, artifact, or no-data effects.

## GitHub Actions validation

For every run/job/command: workflow/run ID, tested SHA, command, expected result, observed result, exit/conclusion, and artifact/evidence link or ID.

For failure: failed step and bounded error tail.

## Preview and state scenarios

For each scenario: initial state, harness, expected result, observed result, isolation/safety, screenshot/build artifact, and omitted states/reason.

## Changed files

changed_file_count: <number>

List every changed repository-relative path exactly once, grouped by responsibility.

## Manual checklist for Luca

1. Action:
   Expected visible result:
   Expected persistence/domain result:
   Failure evidence to return:

## Risks and deferred work

## Final diff audit

Scope, dependencies, generated files, licences, secrets/private data, duplicate components/state machines/listeners/theme values, and unexpected changes.

## Rollback

Exact safe rollback; never imply deletion of unknown user data.

## Acceptance-state proposal

Propose but do not claim Luca acceptance.

## Assistant Memory capture proposal

Exact durable outcomes to record after verification.

## Exact next action

Normally Luca manual review; never the next phase before acceptance.

Continuation and merge require Luca's explicit instruction.

END_OF_COMPLETION_REPORT
```
