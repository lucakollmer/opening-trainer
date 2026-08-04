# Codex phase commands

These short commands rely on `AGENTS.md`, `context.md` and `plans.md` being present on the current fetched repository.

## Start

```text
Start development.
```

Equivalent to PHASE-0 only.

## Named phase

```text
Continue with phase 1.
Continue with phase 2.
Continue with phase 3.
Continue with phase 4.
Continue with phase 5.
Continue with phase 6.
Continue with phase 7.
Continue with phase 8.
```

Codex must enforce predecessor acceptance/merge and execute only the named phase.

## Correction

```text
Correct PHASE-N on its existing branch and draft PR only. Failed manual item: <item>. Observed: <result>. Expected: <result>. Repair the complete in-scope cause, rerun all PHASE-N validation, update the same PR, and stop at manual review. Do not merge or begin another phase.
```

## Acceptance and merge

```text
I completed the PHASE-N manual checklist and accept PHASE-N. Verify the unchanged accepted head and validation, record this explicit acceptance in context.md on the same branch, commit and push, then merge that accepted PR into main without beginning another phase. Return the merge commit and exact next authorised command.
```

## Review only

```text
Review the current PHASE-N branch and draft PR against AGENTS.md, context.md, plans.md and its focused contracts. Do not mutate code. Return code defects, scope deviations, missing validation, report-schema deviations and the smallest correction instruction.
```
