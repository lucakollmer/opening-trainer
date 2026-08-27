# CHATGPT_START_HERE.md — Start or resume Opening Trainer development

## Fresh-chat bootstrap

Opening Trainer is Assistant Memory project `PRJ-CHESS-OPENING-TRAINER` and product repository `lucakollmer/opening-trainer`.

Before using repository history or phase plans, verify the private Assistant Memory trust anchor for `lucakollmer/assistant`: repository ID `1327919572`, node ID `R_kgDOTyZx1A`, visibility private, default branch `main`. Pin current Assistant Memory `main`, read its `START_HERE.md`, then read `projects/PRJ-CHESS-OPENING-TRAINER/context.json` at the same SHA and apply valid later immutable project events. If GitHub cannot be read or the identity mismatches, fail closed. Do not fall back to Google Drive; Drive is recovery/audit-only.

Then verify current product `main`, intended branch/PR and any current provider evidence live in `lucakollmer/opening-trainer`.

## Repository read order

Read:

```text
AGENTS.md
docs/workflow/CURRENT_EXECUTION_WORKFLOW.md
CHATGPT_WORKFLOW_PROFILE.md
plans.md
```

Then read the named phase's required Product/domain/architecture/testing documents. Treat phase scope and manual checklists in `plans.md` as current programme requirements, but do not use its legacy Drive/GitHub-Actions execution mechanics.

## Current workflow

Development mode is `cloud`; validation workflow is `cloudflare-workers-direct`. GitHub Actions is not the accepted validation surface.

Do maximum reliable runtime review first. Publish one exact candidate SHA only when reviewable. Automatic non-production Workers builds are disabled; deliberately trigger the retained Cloudflare build for the exact candidate SHA.

Provider gate:

```text
pnpm integrity:check && pnpm build && pnpm test:pwa && git diff --check
npx wrangler@4.126.0 versions upload
```

The version upload changes no production traffic. Require exact immutable-preview `/deployment.json` readback and affected browser smoke before handing a candidate to Luca.

## Phase commands

A command such as `continue phase 3` authorizes only that named phase once its predecessor gate is satisfied. Correction work stays on the current bounded branch/PR unless current Assistant Memory authorizes otherwise.

Technical completion never authorizes merge or continuation. Luca must explicitly accept or reject the exact candidate. Merge and production promotion require their own current authority.

## Safety

Do not force-update refs, rewrite history, change repository settings/permissions, resurrect GitHub Actions as a validation dependency, change production DNS/domain traffic or delete the retained Pages project without the separately required authorization.
