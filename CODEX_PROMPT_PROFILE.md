# CODEX_PROMPT_PROFILE.md — Opening Trainer Codex profile

## 1. Status

This repository profile adapts Assistant Memory's `CHATGPT_TO_CODEX.md` framework version `1.1-trial` to Opening Trainer. Repository contracts and Luca's current instruction remain authoritative over this profile.

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
repository: lucakollmer/opening-trainer
integration_branch: main
programme: MVP
profile_version: 1.0
```

## 2. Execution defaults

- One named phase or correction per branch and draft pull request.
- Luca owns Product, visual and manual interaction acceptance.
- Codex owns repository inspection, bounded implementation, tests, local validation, state-appropriate browser checks, commit, push, draft PR and the completion report.
- A phase is not accepted because tests pass or a PR exists.
- Do not merge or start the next phase without Luca's current explicit instruction.

## 3. Prompt artefact rules

A substantial implementation/correction/continuation instruction is one executable Markdown file containing one active instruction.

Required front matter for archived prompts:

```yaml
---
prompt_id: PRM-OPENING-TRAINER-<YYYYMMDD>-<NNN>
project_id: PRJ-CHESS-OPENING-TRAINER
framework_version: 1.1-trial
project_profile_version: 1.0
prompt_type: implementation | correction | continuation | acceptance | merge | combined-transition
programme: MVP
phase: <phase>
repository: lucakollmer/opening-trainer
integration_branch: main
working_branch: <branch>
parent_prompt_id: <ID or null>
supersedes_prompt_id: <ID or null>
created_date_europe_london: <YYYY-MM-DD>
status: issued
---
```

Filename:

```text
<PromptId>__<Programme>__<Phase>__<PromptType>__v<Revision>.md
```

Normalize to UTF-8 without BOM, LF endings, no non-meaningful trailing spaces and one terminal LF. End executable prompt content with `END_OF_CODEX_PROMPT` and put nothing after it.

Issued prompts are immutable. Corrections and continuations receive a new prompt ID and parent link.

## 4. Entry-gate evidence

Every phase run must state:

- verified remote repository and fetched `main`;
- current base SHA;
- expected predecessor phase;
- whether that predecessor was explicitly accepted by Luca;
- whether its accepted commit is already in `origin/main`;
- clean or intentionally dirty working-tree state;
- current explicit authority;
- phases that remain blocked.

Do not infer predecessor acceptance from a merged-looking branch, PR label, test pass or repository document that was not updated by explicit acceptance.

## 5. UI reuse gate

Every phase that creates or changes UI must first inspect:

- MUI components already used in the repository;
- project-owned reusable components and hooks;
- representative host surfaces and tests;
- theme tokens and responsive layout contracts;
- existing command/state ownership.

The phase report maps each requested behaviour to `reuse`, `compose`, `extend` or `create`. Default to reuse or composition. A new primitive requires evidence that no suitable primitive exists and must have clear ownership, focused tests and host-surface integration tests.

Prohibit:

- feature-specific copies of shared components;
- duplicate session or interaction state machines;
- nested forms;
- accidental event-bubbling coordination;
- conflicting global keyboard listeners;
- hard-coded duplicate theme/spacing values;
- a second subtly divergent dialog/drawer/feedback pattern;
- custom ordinary controls where MUI already supplies the accepted pattern.

## 6. Completion behaviour

Successful technical completion normally requires:

1. entry gate passed;
2. implementation within the named phase;
3. focused tests;
4. lint and typecheck;
5. complete automated test suite;
6. production build;
7. applicable clean-state/offline/import/persistence scenarios;
8. `git diff --check` and final scope/duplication audit;
9. intentional commit and clean working tree;
10. pushed branch and one draft PR;
11. self-contained completion report and manual checklist.

A repairable test failure is not a successful stop. Continue until complete or a genuine external blocker exists.

Allowed statuses:

```text
COMPLETE_FOR_MANUAL_REVIEW
BLOCKED
INCOMPLETE
```

## 7. State-space validation

Select scenarios relevant to the phase and state exactly what was tested or omitted:

- clean first load with no database;
- valid current database reload;
- schema upgrade;
- failed/invalid import without partial mutation;
- full backup export and restore;
- offline reload after caching;
- stale service-worker update;
- desktop, tablet and phone functional layouts;
- keyboard and touch routes;
- masked-answer non-disclosure;
- deterministic fixture and clock handling;
- same-session repair/retest;
- transposition and accepted-alternative routing.

Automated functional evidence does not substitute for Luca's visual acceptance.

## 8. Report hard rules

The report must include:

- final status, phase, base SHA, branch, final head, PR and clean-tree state;
- predecessor operation timing;
- exact `changed_file_count` and every changed path;
- exact commands and observed results;
- tested and omitted state scenarios;
- data/schema/service-worker effects;
- `local automated validation: pass | fail`;
- `manual UI validation by Luca: pending | pass | fail`;
- risks, deferred work and rollback;
- a manual checklist with action, expected visible result, expected persisted/domain result and failure evidence.

Required headings:

```text
## Reusable UI/UX implementation
## Reuse and duplication audit
## Final diff audit
## Rollback
## Acceptance-state proposal
## Assistant Memory capture proposal
## Exact next action
```

The report ends with `END_OF_COMPLETION_REPORT`. Use repository-relative paths, not local hyperlinks.

## 9. Safety defaults

- Synthetic fixtures only unless provenance and permission are recorded.
- No engine, backend, auth, sync or native wrapper in an unauthorised phase.
- No paid MUI features.
- No credentials or private repertoire in the repository.
- No automatic destructive database reset.
- No GitHub Actions dependency for acceptance.
- No claim of visual acceptance without Luca.
