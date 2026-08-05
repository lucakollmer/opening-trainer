# CHATGPT_WORKFLOW_PROFILE.md - Opening Trainer execution profile

## 1. Identity

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
repository: lucakollmer/opening-trainer
integration_branch: main
programme: MVP
workflow: ChatGPT + GitHub Actions Coding Workflow
workflow_status: trial; explicitly adopted by this project
profile_version: 2.0
```

Google Drive Assistant Memory is the project authority. The repository contains the execution copy and code. ChatGPT uses connected Drive and GitHub tools; GitHub Actions runs the exact candidate tree.

## 2. Execution defaults

- One named phase or correction per branch and draft pull request.
- Luca owns product, visual, manual interaction, merge, and continuation acceptance.
- ChatGPT owns authority reads, repository inspection, bounded implementation, GitHub writes, Actions inspection, structured reporting, and proposed memory capture.
- GitHub Actions owns reproducible command execution and exact candidate-tree evidence.
- A phase is not accepted because tests pass, screenshots exist, or a PR is open.
- Do not merge or start the next phase without Luca's current explicit instruction.
- Each chat turn revalidates Drive and GitHub state because ordinary chats do not wake automatically after Actions.

## 3. Work-request artefact rules

A substantial implementation, correction, continuation, migration, acceptance, or merge instruction may be archived as one executable Markdown file containing one active instruction.

Required front matter:

```yaml
---
request_id: WRK-OPENING-TRAINER-<YYYYMMDD>-<NNN>
project_id: PRJ-CHESS-OPENING-TRAINER
workflow_version: 1.0-trial
project_profile_version: 2.0
request_type: migration | implementation | correction | continuation | acceptance | merge
programme: MVP
phase: <phase-or-governance>
repository: lucakollmer/opening-trainer
integration_branch: main
working_branch: <branch>
expected_base_sha: <sha-or-verify-current>
expected_head_sha: <sha-or-null>
parent_request_id: <ID-or-null>
supersedes_request_id: <ID-or-null>
created_date_europe_london: <YYYY-MM-DD>
status: issued
---
```

Filename:

```text
<RequestId>__<Programme>__<Phase>__<RequestType>__v<Revision>.md
```

Normalize to UTF-8 without BOM, LF endings, no non-meaningful trailing spaces, and one terminal LF. End executable request content with:

```text
END_OF_WORK_REQUEST
```

Issued requests are immutable. Corrections and continuations receive a new request ID and parent link.

## 4. Entry-gate evidence

Every modifying turn states:

- Drive entrypoint and workflow read status;
- repository identity and visibility observation;
- integration-branch SHA;
- phase branch and PR state;
- expected and observed base/head SHAs;
- predecessor phase and explicit acceptance/merge evidence;
- whether another modifying workflow is active;
- current explicit authority;
- phases and operations that remain blocked.

Do not infer acceptance from a merged-looking branch, green check, label, PR body, or stale repository document.

## 5. Write strategy

Use direct GitHub file writes for bounded changes. Prefer complete-file replacement with current blob SHA, and perform sequential updates when two writes depend on the same path.

For large scaffolds or generated outputs, use one bounded bootstrap request/workflow that:

1. verifies the exact base;
2. generates the final tree;
3. removes temporary bootstrap material where required;
4. validates that exact final tree;
5. commits/pushes only after validation succeeds;
6. reports the final head/tree SHA and every changed path.

Do not assume a workflow-token push triggers a new validation run.

## 6. Actions evidence gate

Required evidence is phase-dependent but normally includes:

- repository integrity;
- lint;
- strict type checking;
- deterministic tests;
- production build;
- PWA validation where applicable;
- formatting and whitespace checks;
- dependency audit/licence record when dependencies change;
- browser HTTP smoke;
- desktop/tablet/phone screenshots for visible phases;
- uploaded structured report and relevant build/preview artifacts.

Actions must use least privilege, bounded timeouts, concurrency control, immutable action pins, and no automatic merge.

## 7. UI reuse gate

Every phase that creates or changes UI first inspects:

- MUI components already used;
- project-owned reusable components and hooks;
- representative host surfaces and tests;
- theme tokens and responsive layout contracts;
- existing command/state ownership.

Map each requested behaviour to `reuse`, `compose`, `extend`, or `create`. Default to reuse or composition. A new primitive requires evidence that no suitable primitive exists, clear ownership, focused tests, and host-surface integration tests.

Prohibit feature-specific copies of shared components, duplicate state machines, nested forms, accidental event-bubbling coordination, conflicting global keyboard listeners, duplicated theme values, and custom ordinary controls where MUI already supplies the accepted pattern.

## 8. State-space validation

Select relevant scenarios and state exactly what Actions tested or omitted:

- clean first load with no database;
- valid current database reload;
- schema upgrade;
- failed/invalid import without partial mutation;
- full backup export and restore;
- offline reload after caching;
- stale service-worker update;
- desktop, tablet, and phone functional layouts;
- keyboard and touch routes;
- masked-answer non-disclosure;
- deterministic fixture and clock handling;
- same-session repair/retest;
- transposition and accepted-alternative routing.

Automated functional evidence does not substitute for Luca's visual acceptance.

## 9. Structured report rules

The report includes:

- final status, phase, base SHA, branch, tested head/tree, PR, and clean candidate-tree state;
- predecessor acceptance/merge evidence;
- exact changed-file count and every path;
- exact commands and observed results;
- tested and omitted state scenarios;
- data/schema/service-worker effects;
- Actions validation status;
- manual UI validation by Luca as `pending`, `pass`, or `fail`;
- risks, deferred work, and rollback;
- manual checklist with action, expected visible result, expected persisted/domain result, and failure evidence.

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

End with `END_OF_COMPLETION_REPORT`.

## 10. Stop rules

Stop before mutation when Drive authority is unavailable, refs differ from expected state, an existing PR contains unexpected work, predecessor acceptance is missing, scope requires an excluded system, unlicensed data is required, data safety cannot be proved, or a modifying workflow is already operating on the repository.
