# CHATGPT_WORKFLOW_PROFILE.md — Opening Trainer execution profile

## Identity

```yaml
project_id: PRJ-CHESS-OPENING-TRAINER
repository: lucakollmer/opening-trainer
integration_branch: main
programme: MVP
development_mode: cloud
validation_workflow: cloudflare-workers-direct
worker: opening-trainer
worker_tag: a3b7d0830d3046268ba91f587c25fa70
exact_sha_trigger_uuid: c9def933-0eb2-47ba-93bd-d55912a228c4
profile_version: 4.0
```

Durable project state is resolved from the private GitHub Assistant Memory repository `lucakollmer/assistant` using its exact numeric trust anchor. Google Drive is recovery/audit-only.

## Responsibility split

- Luca owns Product/manual acceptance, merge authorization, production-traffic promotion and continuation to later phases.
- Browser ChatGPT owns Assistant Memory bootstrap, scope resolution, GitHub source/ref operations, provider observation when available, browser/HTTP validation and handoff evidence.
- Runtime implementation owns the maximum reliable focused tests, lint/type review and formatting review before a provider build is requested.
- Cloudflare Workers Builds owns the exact-SHA packaging and non-traffic Worker Version upload gate.
- GitHub Actions is excluded from the accepted product validation workflow.

## Candidate workflow

1. Verify Assistant Memory and current product base/ref coordinates.
2. Make only authorized repository changes and complete runtime review first.
3. Publish one exact reviewable SHA and read the ref back.
4. Deliberately trigger the retained Workers Build for that exact commit SHA; automatic preview-branch builds are disabled.
5. Require provider build command `pnpm integrity:check && pnpm build && pnpm test:pwa && git diff --check` to succeed.
6. Require non-traffic deploy command `npx wrangler@4.126.0 versions upload` to succeed.
7. Retrieve the immutable Worker Version Preview URL and require `/deployment.json` to match the exact Git SHA, branch and build UUID.
8. Run affected desktop/mobile browser smoke on that immutable version.
9. Stop at Luca's manual Product gate. A later branch-head change invalidates the evidence.

The repository's full `pnpm validate` remains the aggregate developer command when a suitable runtime is available, but Workers Builds intentionally no longer repeats lint, unit tests or Prettier.

## Current-plan overlay

`docs/workflow/CURRENT_EXECUTION_WORKFLOW.md` supersedes legacy execution mechanics in `plans.md`, `START_DEVELOPMENT.md` history and the technical-provider sentence in `docs/product/PRODUCT_CONTRACT.md` section 15. Phase scope, tests, manual checklists and Product semantics remain controlled by their named contracts.

## Phase and merge safety

Luca retains phase acceptance, merge, and continuation authority. A successful Worker build/version upload never authorizes merge, production promotion or the next phase.

## Repository integrity

Every repository content change must be represented in `SHA256SUMS.txt`. Final provider validation must pass `pnpm integrity:check` without regenerating the manifest first.

## Completion evidence

Report exact ref/SHA, changed paths, runtime checks, provider build UUID/outcome, commands, Worker version ID, immutable preview, deployment-marker readback, browser smoke, any superseded candidate and every remaining manual/merge/production gate.
