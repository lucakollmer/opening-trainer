# Codex completion report template

```text
# <PHASE> completion report

final_status: COMPLETE_FOR_MANUAL_REVIEW | BLOCKED | INCOMPLETE
report_schema_compliance: full | partial | failed
phase: <PHASE>
repository: lucakollmer/opening-trainer
verified_base_sha: <sha>
working_branch: <branch>
final_head_sha: <sha>
draft_pr: <url/number or not-created-with-reason>
clean_working_tree: yes | no
local_automated_validation: pass | fail
manual_ui_validation_by_luca: pending | pass | fail

## Entry-gate evidence

- predecessor accepted before this run: yes | no
- predecessor merged before this run: yes | no
- predecessor merge performed during this run: yes | no
- authority for any predecessor merge:
- origin/main before branch:
- initial working-tree state:
- phases still blocked:

## Implementation

Map completed work to phase acceptance criteria.

## Reusable UI/UX implementation

For every UI behaviour: existing component/hook/contract, path, reuse|compose|extend|create, reason, component tests, host integration tests and documentation.

## Reuse and duplication audit

State searches/audits and any justified remaining exception.

## Data, schema and portability effects

State exact database, backup, migration, import/export, service-worker or no-data effects.

## Validation

For every command: command, expected result, observed result and status.

## Launch and state scenarios

For each scenario: initial state, command/harness, expected result, observed result, isolation/safety, and omitted states/reason.

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

Exact durable outcomes to record.

## Exact next action

Normally Luca manual review; never the next implementation phase before acceptance.

END_OF_COMPLETION_REPORT
```
