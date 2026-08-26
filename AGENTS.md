# AGENTS.md — Opening Trainer

## Authority and identity

Opening Trainer is `lucakollmer/opening-trainer`, managed by Assistant Memory project `PRJ-CHESS-OPENING-TRAINER`.

Before modifying the product, verify the private Assistant Memory repository `lucakollmer/assistant` by repository ID `1327919572` and node ID `R_kgDOTyZx1A`, pin current `main`, read `START_HERE.md` and the project context at the same cut, and apply valid later project events. Google Drive is recovery/audit-only. Recheck mutable product and Cloudflare state live.

## Development and validation workflow

Development mode is `cloud`; validation workflow is `cloudflare-workers-direct`. GitHub is source/ref transport. GitHub Actions is excluded from the accepted validation workflow.

Validation is deliberately split to conserve Cloudflare Workers Build minutes:

- `pnpm validate` is the full development/review gate: integrity, lint, standalone typecheck, deterministic tests, production build, PWA validation and Prettier.
- `pnpm validate:provider` is the cheap Workers provider gate: integrity, production build (including TypeScript), PWA validation and `git diff --check`.
- ChatGPT/Codex must run the maximum reliable full/focused validation available in its runtime before publishing a provider candidate. Do not use Workers Builds as the debugging loop.

Ordinary non-`main` pushes must not trigger a Workers Build. The non-production trigger watches only `.cloudflare-review`. To request one deliberate provider build, change `.cloudflare-review` in the final reviewable candidate commit after runtime validation. A superseding candidate must change the marker again. The marker is trigger metadata, not product semantics.

For a reviewable candidate, verify the exact Git SHA/ref, observe the matching Workers Build, require terminal success, obtain the provider-authored immutable Version Preview URL, require `/deployment.json` to bind that SHA, and perform proportionate browser/HTTP smoke validation.

Canonical provider commands:

- build: `pnpm validate:provider`
- non-production deploy: `npx wrangler versions upload`
- production deploy: `npx wrangler versions upload`

Production upload is not production traffic promotion. After the exact `main` version passes deployment-marker and browser/HTTP validation, promote that already-uploaded exact version explicitly through the Cloudflare Deployment API. Never promote a version whose source SHA is not current `main`.

The Worker is `opening-trainer`. `openings.lucakollmer.com` is the canonical production hostname. The legacy Cloudflare Pages project is recovery-only and its automatic production/preview deployments are disabled.

Cloudflare API Full is the authorized ChatGPT Cloudflare mutation surface within current task authority and the fallback observation surface when the dedicated Workers Builds capability is insufficient.

## Product and phase gates

Luca retains Product/phase acceptance and continuation authority. A successful build, preview, upload or production promotion never authorizes a later product phase.

PHASE-2 is accepted and merged. PHASE-3 remains separately gated unless current Assistant Memory says otherwise.

Do not force-push or rewrite history, broaden a bounded infrastructure change into Product work, or delete the retained Pages recovery project without separate authority.

## UI and implementation defaults

Prefer bounded changes and existing architecture/components. For visible behavior, preserve relevant desktop/tablet/phone, keyboard/touch, focus, masked-answer and error-boundary behavior. Browser evidence does not substitute for Product acceptance.

## Repository integrity

`SHA256SUMS.txt` is the integrity manifest. Every tracked repository content change must be reflected in it. Final candidates must pass `pnpm integrity:check` without first rewriting the manifest.

Text files use UTF-8 without BOM, LF endings, no trailing whitespace and one terminal LF. Issued artifacts under `prompts/` remain immutable historical records unless the governing workflow explicitly creates a new revision.

## Completion reporting

Report the exact Git SHA/ref, changed paths, runtime checks, Worker/tag, exact build UUID/outcome, build/deploy commands, Worker version ID and immutable preview, `/deployment.json` readback, browser smoke, production deployment/promotion identity when applicable, superseded failed candidates, and remaining Product/phase gates.
