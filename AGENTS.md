# AGENTS.md — Opening Trainer

## Authority and project identity

Opening Trainer is the managed product repository `lucakollmer/opening-trainer` for Assistant Memory project `PRJ-CHESS-OPENING-TRAINER`.

Durable project authority lives in the private GitHub Assistant Memory repository `lucakollmer/assistant`, repository ID `1327919572`, node ID `R_kgDOTyZx1A`, default branch `main`. A modifying session must verify that trust anchor, pin current Assistant Memory `main`, read `START_HERE.md`, then read `projects/PRJ-CHESS-OPENING-TRAINER/context.json` at the same cut and apply valid later project events before inferring current state. Google Drive is recovery/audit-only and is not a normal semantic authority.

Mutable product-repository facts must also be checked live in this repository before mutation.

## Current development and validation workflow

The accepted development mode is `cloud`.

The accepted validation workflow is `cloudflare-workers-direct`.

GitHub is the source/ref publication surface. Cloudflare Workers Builds is the authoritative exact-SHA build and deployment surface. GitHub Actions is not part of the accepted validation workflow and must not be dispatched, rerun, waited on, depended on, or intentionally triggered as validation.

For each reviewable candidate:

1. run the maximum feasible focused/runtime checks before publication;
2. publish the exact candidate SHA to the intended GitHub ref;
3. verify the ref points to that SHA;
4. observe the Cloudflare Workers Build whose `commitHash` equals that exact SHA;
5. require terminal build success;
6. obtain the provider-authored immutable Version Preview URL for the uploaded Worker version;
7. read `/deployment.json` from that immutable preview and require its `sha` to equal the candidate SHA;
8. perform proportionate browser/HTTP smoke validation on the immutable preview, including affected routes;
9. report pending or failed provider state explicitly rather than implying readiness.

The canonical Workers Builds commands are:

- build: `pnpm validate && git diff --check`
- non-production deploy: `npx wrangler versions upload`
- production deploy: `npx wrangler deploy`

The Worker is `opening-trainer`. Static assets are built into `dist` and served using the SPA fallback configured in `wrangler.jsonc`.

Cloudflare API Full is the authorized ChatGPT Cloudflare write surface for provider configuration changes within the current task scope and the fallback observation surface when the dedicated Workers Builds capability is unavailable or insufficient. This does not grant blanket authority for destructive account, DNS, domain, or unrelated Cloudflare changes.

## Product and phase gates

Luca retains phase acceptance, merge, and continuation authority.

Automated validation, a successful Worker deployment, a preview URL, or an open pull request never implies Product acceptance.

Do not:

- merge a phase or migration candidate without Luca's current explicit authorization;
- start a later phase without the required separate authority;
- cut over production domains, DNS, or delete the legacy Pages project without explicit production-cutover authority;
- force-push or rewrite history;
- broaden a bounded implementation into a new Product decision.

The existing PHASE-2 Product gate remains separate from this infrastructure migration unless current Assistant Memory state says otherwise.

## Implementation defaults

Prefer bounded changes with clear ownership and reuse existing architecture and components before creating new primitives.

During implementation use focused checks that give fast feedback. Before a final reviewable candidate, the Cloudflare build command owns the aggregate repository gate; do not duplicate its broad stages without a diagnostic reason.

The aggregate `pnpm validate` includes:

- integrity verification;
- lint;
- TypeScript validation;
- deterministic tests;
- production build;
- PWA validation;
- Prettier.

`git diff --check` is additionally owned by the Workers Build command.

When visible UI behavior changes, preserve desktop, tablet, phone, keyboard, touch, focus, masked-answer and error-boundary behavior as applicable. Browser evidence does not substitute for Luca's Product acceptance.

## Repository integrity

`SHA256SUMS.txt` is the repository integrity manifest. Any repository file addition, removal or content change must be reflected in it. Run `pnpm integrity:update` only when intentionally regenerating the manifest, then ensure the resulting manifest itself is committed. Final candidates must pass `pnpm integrity:check` without first rewriting the manifest.

Text files use UTF-8 without BOM, LF endings, no trailing whitespace and one terminal LF.

Issued work-request artifacts under `prompts/` are immutable historical records unless the governing workflow explicitly creates a new revision.

## Historical workflow documents

Some repository documents retain filenames or historical discussion referring to the former GitHub Actions / Google Drive workflow. They are historical execution evidence, not current authority. Legacy integrity compatibility markers are `Google Drive Assistant Memory` and `ChatGPT + GitHub Actions`; these strings name the retired workflow only and do not confer authority. When a historical document conflicts with this file or current Assistant Memory, current Assistant Memory and this workflow profile govern. Migrate or archive those documents only in bounded maintenance work; do not resurrect the old validation model from their filenames or prose.

## Completion reporting

For a candidate handoff report:

- exact product Git SHA and ref;
- changed paths;
- runtime checks actually performed;
- Cloudflare Worker name/tag;
- exact Cloudflare build UUID and terminal outcome;
- build and deploy commands;
- Worker version ID;
- immutable Version Preview URL;
- `/deployment.json` SHA readback;
- affected-route/browser smoke result;
- any superseded failed candidate SHAs/builds;
- remaining Product, merge, release or production-cutover gate.

Do not call a candidate technically ready while required exact-SHA Cloudflare or browser evidence is pending or failed.
