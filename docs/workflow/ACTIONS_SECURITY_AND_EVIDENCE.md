# GitHub Actions security and evidence contract

## 1. Workflow classes

### Read-only validation

Default permissions:

```yaml
permissions:
  contents: read
```

Add only the minimum permission needed for checks or artifact upload. Do not grant write permissions to ordinary validation.

### Modifying bootstrap or migration

A modifying workflow is exceptional and must:

- be explicitly authorised by the current phase/request;
- verify exact repository, branch, and base SHA;
- use one concurrency group and cancel/deny overlapping modifying runs;
- generate and validate the exact final tree before commit;
- commit only after all required checks pass;
- report the final head/tree SHA;
- never merge;
- be removed or disabled when its bounded purpose is complete.

## 2. Action dependencies

Pin third-party actions to reviewed immutable commit SHAs. Record the human-readable version in a comment. Revalidate pins when intentionally upgrading.

## 3. Trigger safety

- Prefer `pull_request`, `push`, or explicit `workflow_dispatch` with fixed validated inputs.
- Do not use `pull_request_target` to execute candidate code.
- Do not interpolate issue bodies, PR comments, branch names, or arbitrary text into shell commands.
- Validate any dispatch input against a closed allowlist.
- Do not assume a workflow-token push triggers another workflow.

## 4. Runtime controls

Every workflow defines:

- bounded `timeout-minutes`;
- appropriate `concurrency`;
- deterministic Node and pnpm versions;
- frozen lockfile install;
- explicit shell safety such as `set -euo pipefail`;
- bounded logs and error tails;
- artifact retention appropriate to review needs.

## 5. Required evidence

The final candidate evidence records:

- workflow and run IDs;
- tested commit/tree SHA;
- job/step conclusions;
- exact commands;
- repository-integrity result;
- lint/type/test/build/PWA/format results as applicable;
- dependency audit and licence changes as applicable;
- preview HTTP smoke;
- desktop/tablet/phone screenshots for visible changes;
- structured completion report artifact or PR comment;
- artifact IDs, digests, and expiry when available.

## 6. Preview boundary

A public deployment or third-party preview provider requires explicit acceptance of provider, account, repository visibility implications, and secrets. Without that acceptance, use build artifacts, localhost smoke, and screenshots generated inside Actions.

## 7. Acceptance boundary

Actions proves technical execution of a candidate tree. It does not prove product usefulness, visual density, touch feel, tree masking clarity, or learning rhythm. Luca performs manual acceptance.
