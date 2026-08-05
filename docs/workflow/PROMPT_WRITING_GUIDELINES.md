# ChatGPT + GitHub Actions work-request guidelines

## 1. One bounded instruction

One request authorises one phase, correction, migration, acceptance, or merge operation. Do not combine unrelated phases or silently continue after the stated stop condition.

## 2. Required context

State:

- project and repository;
- phase or governance operation;
- branch and draft PR;
- expected base SHA and expected current head when known;
- authoritative files to read;
- exact scope and non-scope;
- required Actions validation and evidence;
- manual acceptance owner;
- stop condition.

Mutable facts are reverified at entry. A request never makes an old SHA true.

## 3. Authority language

Require Google Drive project authority to be read before mutation. Repository authority is the execution copy. Do not make ChatGPT rely on chat memory or a stale completion summary.

## 4. Continuous execution

Require ChatGPT to continue through repairable in-scope failures until bounded implementation, focused tests, full Actions validation, state scenarios, diff audit, commit/push, draft PR, and report are complete. Planning, one test, a commit, or a PR is not terminal success.

Ordinary ChatGPT does not wait in the background. When Actions is still running, report the current run and ask Luca to return with a continuation turn. On continuation, re-read state before proceeding.

## 5. GitHub Actions contract

State whether the workflow is read-only or modifying. Require:

- exact expected refs;
- least privilege;
- immutable action pins;
- bounded timeout and concurrency;
- no `pull_request_target` for untrusted code;
- no shell execution of issue/comment text;
- exact candidate-tree validation;
- structured result and bounded error tail;
- no auto-merge.

## 6. UI and preview evidence

Visible phases require a production build, browser smoke, and agreed desktop/tablet/phone screenshots. A public preview requires an explicitly accepted provider and secrets boundary. Automated screenshots are evidence, not Luca's acceptance.

## 7. Data safety

Name every database, migration, import/export, service-worker, fixture, and user-data effect. Tests use isolated stores/profiles. Do not perform destructive operations on unknown user data.

## 8. Completion report

Use `docs/workflow/STRUCTURED_REPORT_TEMPLATE.md`. List every changed path exactly once. Report commands and observed results, not planned commands. End with `END_OF_COMPLETION_REPORT`.

## 9. Work-request sentinel

Archived executable requests end with:

```text
END_OF_WORK_REQUEST
```

Nothing follows the sentinel.
