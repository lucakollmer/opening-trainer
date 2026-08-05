# ChatGPT phase commands

## Current migration command

```text
Migrate the repository to the accepted ChatGPT + GitHub Actions workflow.
```

This maps only to `WORKFLOW_MIGRATION.md` on the existing PHASE-0 branch and PR #2. It does not authorise product changes, merge, or PHASE-1.

## Standard implementation commands

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

ChatGPT must enforce predecessor acceptance and merge, read current Drive state, verify current GitHub refs, and execute only the named phase.

## Read-only review

```text
Review phase N.
```

Inspect authority, PR, diff, Actions, artifacts, comments, and manual checklist. Do not write unless Luca asks for a correction.

## Correction

```text
Correct phase N on its existing branch and PR. <Failure evidence>
```

Keep corrections on the same branch/PR. Rerun all applicable Actions validation and evidence. Do not merge or start another phase.

## Acceptance

```text
I completed the PHASE-N manual checklist and accept PHASE-N at the current exact PR head.
```

This records Luca's acceptance only after exact-head and evidence verification. It does not automatically authorise merge unless the same message explicitly says to merge.

## Merge

```text
Merge accepted PHASE-N at the verified current head. Do not start the next phase.
```

Verify the accepted head has not changed, merge with expected-head protection, update Drive memory, and stop.

## Ambiguous continue

```text
Continue.
```

Use only when Drive and `context.md` agree on one exact authorised action. Otherwise stop and state the missing authority.
