# Project Codex prompt-writing guidelines

This is the repository summary of the Assistant Memory `CHATGPT_TO_CODEX.md` framework and the accepted project profile.

## One instruction artefact

Every substantial implementation, correction, continuation, acceptance, merge or combined transition is one Markdown file with one active instruction. Do not put an implementation prompt and a fallback/recovery prompt in the same file.

## Prompt order

Near the top, state:

1. exact terminal goal;
2. successful stopping state;
3. entry gate and repository coordinates;
4. authorised scope and explicit non-scope;
5. completion contract;
6. allowed final statuses and genuine blockers;
7. technical and UI reuse contracts;
8. validation/state scenarios;
9. report schema and manual acceptance.

Do not bury the finish condition after implementation detail.

## Continuous execution

Require Codex to continue through repairable failures until implementation, focused tests, full local validation, state scenarios, diff audit, commit, push, draft PR and report are complete. Planning, one test, commit or PR is not terminal success.

## Repository grounding

Prompts use repository-relative paths and current verified refs. Mutable facts are checked by Codex at entry. Do not make Codex depend on Google Drive access.

## UI prompts

Identify concrete reusable MUI/project components, hooks and paths. Map each behaviour to `reuse`, `compose`, `extend` or `create`. Require evidence for new primitives, shared implementation where behaviour repeats, component tests, host integration tests and a duplicate-interaction audit.

Required completion headings:

```text
## Reusable UI/UX implementation
## Reuse and duplication audit
```

## Final report

Require exact changed-file count and every path, exact commands/results, tested/omitted state scenarios, manual checklist with expected visible and persisted results, rollback, acceptance-state proposal, memory-capture proposal and exact next action.

The intended report ends with `END_OF_COMPLETION_REPORT`. The intended prompt ends with `END_OF_CODEX_PROMPT`.
