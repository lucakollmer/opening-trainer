# ChatGPT + GitHub Actions Coding Workflow

## Status

This is the repository execution copy of the system trial workflow explicitly adopted by `PRJ-CHESS-OPENING-TRAINER` under `DEC-20260804-001`. Google Drive remains authoritative if this copy becomes stale.

## Architecture

- Assistant Memory in Google Drive is the canonical project and operational record.
- The product GitHub repository is the source-code store, command transport, GitHub Actions runtime, pull-request review surface, and structured result channel.
- No separate mailbox repository is required.
- A local runner is not required for browser-compatible and cloud-executable work.
- Local execution remains available for operating-system-specific, hardware-dependent, private-file, or proprietary-application workflows.
- Ordinary ChatGPT conversations do not wake themselves when a workflow finishes. Each continuation requires a new user turn.

## Standard phase procedure

1. Read project and repository authority in the mandated order.
2. Confirm repository, branch, base SHA, authorised scope, validation, and stop condition.
3. Create or use one phase branch and one draft pull request.
4. ChatGPT writes bounded code changes, patches, or a temporary bootstrap request directly to the phase branch.
5. GitHub Actions verifies the expected base and executes only the approved workflow against the exact candidate tree.
6. For generated scaffolding, the Action may commit and push the already validated tree only when explicitly authorised.
7. The Action posts or uploads a bounded structured report with command results, changed files, failure step, and error tail.
8. Pull-request preview and responsive screenshots provide visual evidence when required.
9. Luca reviews visible behaviour and either accepts the phase or requests a bounded correction.
10. Merge and the next phase remain blocked until Luca gives explicit authority.

## Bootstrap pattern

For initial scaffolding, prefer one temporary bootstrap script or declarative request plus one bootstrap workflow rather than many single-file commits. The workflow must generate the final tree, validate that exact tree, commit only after validation passes, remove temporary bootstrap material when appropriate, and report the final head SHA.

A workflow-token push must not be assumed to start a second validation run. The bootstrap workflow validates the exact final tree before committing it.

## Visual review

- Preferred default for static Vite/PWA projects: automatic per-PR preview when a provider and required credentials have been explicitly accepted.
- Without an accepted public deployment provider, Actions may publish a production build artifact, localhost HTTP-smoke evidence, and desktop/tablet/phone screenshots.
- GitHub Codespaces may be used for interactive browser development and debugging.
- A local clone is optional for cloud-compatible phases and becomes necessary only when accepted validation requires local hardware, private local files, proprietary applications, native packaging, or machine-specific integration.

## Security and control boundaries

- Protect the default branch and prohibit direct mutation.
- Require the exact expected base SHA before mutation.
- Use least-privilege workflow permissions; normal validation is read-only.
- Never execute issue text, pull-request comments, or untrusted user content as shell commands.
- Avoid `pull_request_target` for untrusted code.
- Pin third-party Actions to accepted immutable SHAs.
- Do not expose personal, deployment, or organisation secrets without a separately accepted need.
- Set runtime, output, and concurrency limits.
- Do not auto-merge.
- One modifying workflow may operate on a repository at a time.
- Luca retains visual acceptance, merge, and continuation authority.

## Required structured report

Every modifying run reports:

- project and phase;
- branch, expected base SHA, and tested head/tree SHA;
- exact files changed;
- dependencies and licences changed;
- commands and exit results;
- failed step and bounded error tail when applicable;
- build, test, audit, and preview status;
- risks, deviations, and deferred work;
- rollback;
- exact next action;
- statement that continuation requires explicit acceptance.

## Project-specific current gate

PHASE-0 is technically complete in draft PR #2 but not accepted. The first use of workflow pack version 2 is a governance migration on the existing PHASE-0 branch/PR. It must preserve the application candidate, rerun permanent Actions validation, and return to Luca's manual acceptance gate.
