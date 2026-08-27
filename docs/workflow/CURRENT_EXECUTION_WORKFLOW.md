# Current Opening Trainer execution workflow

## Authority

This is the current product-repository execution overlay for Assistant Memory project `PRJ-CHESS-OPENING-TRAINER`.

Durable semantic authority is the verified private GitHub repository `lucakollmer/assistant` (repository ID `1327919572`, node ID `R_kgDOTyZx1A`). Google Drive is recovery/audit-only. Mutable product facts are read live from `lucakollmer/opening-trainer`.

## Supersession rule

This file, current Assistant Memory, `AGENTS.md`, `CHATGPT_START_HERE.md` and `CHATGPT_WORKFLOW_PROFILE.md` supersede only obsolete execution mechanics in older repository prose, including:

- `plans.md` section 0 and programme-wide references to Drive bootstrap or GitHub Actions validation;
- phase-specific headings that say GitHub Actions is the technical evidence source;
- historical start/migration instructions;
- the sentence in `docs/product/PRODUCT_CONTRACT.md` section 15 that assigns exact-candidate technical evidence to GitHub Actions.

The phase goals, entry gates, scope, non-scope, tests, rollback rules and numbered manual Product checklists in `plans.md` remain programme requirements unless current Assistant Memory explicitly changes them. Product semantics in the domain, training, UI and storage contracts are not weakened by this overlay.

## Runtime-first review

Before publishing a review candidate, perform the maximum checks reliably available in the current implementation runtime. This includes focused/unit tests, lint, strict TypeScript, formatting and affected browser/static review when those tools are available. Record unavailable checks rather than claiming they ran.

The repository's full developer command remains:

```text
pnpm validate
```

## Exact-SHA provider gate

Accepted workflow: `cloudflare-workers-direct`.

Automatic non-production branch builds are disabled. Trigger a review build deliberately from the retained exact-SHA trigger using the candidate commit hash.

Provider coordinates:

```yaml
worker: opening-trainer
worker_tag: a3b7d0830d3046268ba91f587c25fa70
trigger_uuid: c9def933-0eb2-47ba-93bd-d55912a228c4
trigger_name: Upload version - main - no traffic change
```

Provider build/deploy commands:

```text
pnpm integrity:check && pnpm build && pnpm test:pwa && git diff --check
npx wrangler@4.126.0 versions upload
```

A successful upload changes no production traffic. Require the immutable Worker Version Preview and `/deployment.json` exact match for SHA, branch and build UUID, then run proportionate affected browser smoke. Any candidate-head change invalidates earlier evidence.

## Manual and merge gate

Technical success only permits Luca's manual review. Luca retains phase acceptance, merge, and continuation authority. Production traffic promotion is separate from review-version upload and remains explicitly gated.
