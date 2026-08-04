# Opening Trainer ChatGPT + GitHub Actions workflow pack manifest

## Identity

```yaml
pack_name: opening-trainer-chatgpt-actions-pack-v2
project_id: PRJ-CHESS-OPENING-TRAINER
repository: lucakollmer/opening-trainer
pack_type: governance migration overlay
workflow: ChatGPT + GitHub Actions trial
created_date_europe_london: 2026-08-04
current_phase: PHASE-0
current_gate: COMPLETE_FOR_MANUAL_REVIEW
```

## Purpose

This pack migrates repository authority and execution instructions from the historical local-Codex workflow to the accepted ChatGPT-browser + GitHub Actions workflow. It preserves the existing PHASE-0 application candidate and uses the same branch and draft PR.

It is not a fresh repository scaffold. Follow `WORKFLOW_MIGRATION.md`; do not copy every archive file into GitHub indiscriminately.

## Expected pre-migration checkpoint

```yaml
base_sha: 87ccbce18384892601a6630494910e1ca0375f13
branch: phase-0-foundation
head_sha: 5477419fce1f13f4265ab82d6ee3058d851b5019
pull_request: 2
permanent_validation_run: 30906801969
review_artifact_id: 8891213897
```

All mutable values must be reverified before writing.

## Repository replacements

- `.github/pull_request_template.md`
- `AGENTS.md`
- `PACK_MANIFEST.md`
- `README.md`
- `START_DEVELOPMENT.md`
- `context.md`
- `docs/decisions/DECISIONS.md`
- `docs/dependencies/VERIFIED_CANDIDATES_2026-08-03.md`
- `docs/product/PRODUCT_CONTRACT.md`
- `docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md`
- `docs/ui/UI_AND_INTERACTION_CONTRACT.md`
- `plans.md`
- `prompts/README.md`
- `scripts/verify-pack.mjs`

## Repository additions

- `CHATGPT_START_HERE.md`
- `CHATGPT_WORKFLOW_PROFILE.md`
- `WORKFLOW_MIGRATION.md`
- `docs/workflow/ACTIONS_SECURITY_AND_EVIDENCE.md`
- `docs/workflow/CHATGPT_GITHUB_ACTIONS_CODING.md`
- `docs/workflow/PHASE_COMMANDS.md`
- `docs/workflow/PROMPT_WRITING_GUIDELINES.md`
- `docs/workflow/STRUCTURED_REPORT_TEMPLATE.md`
- `prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md`

## Reference-only/support files in the transfer archive

These files make the archive self-contained or support integrity verification. They are not automatically repository replacements unless `WORKFLOW_MIGRATION.md` says so.

- `.editorconfig`
- `.gitattributes`
- `.gitignore`
- `docs/architecture/ARCHITECTURE.md`
- `docs/dependencies/DEPENDENCY_AND_LICENSE_POLICY.md`
- `docs/domain/REPERTOIRE_DOMAIN_MODEL.md`
- `docs/fixtures/FIXTURE_CATALOGUE.md`
- `docs/storage/OFFLINE_DATA_AND_PORTABILITY.md`
- `docs/traceability/REQUIREMENTS_TRACEABILITY.md`
- `docs/training/TRAINING_AND_SCHEDULING.md`

## Explicit repository deletions

- `CODEX_START_HERE.md`
- `CODEX_PROMPT_PROFILE.md`
- `docs/codex/COMPLETION_REPORT_TEMPLATE.md`
- `docs/codex/PHASE_COMMANDS.md`
- `docs/codex/PROMPT_WRITING_GUIDELINES.md`
- `prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md`

## Files that must be preserved

- PHASE-0 application source and tests under `src/`.
- `package.json`, `pnpm-lock.yaml`, build and TypeScript configuration.
- `.github/workflows/ci.yml`.
- Current PHASE-0 focused records and helper scripts named in `WORKFLOW_MIGRATION.md`.
- The repository-generated full-tree `SHA256SUMS.txt`, regenerated after migration rather than replaced by the transfer checksum file.

## Transfer-file hashes

`SHA256SUMS.txt` covers every file in this transfer directory except itself, including this manifest. The table below covers all other payload files and is included for human inspection.

| SHA-256 | Bytes | Path |
|---|---:|---|
| `c02a7fbbcbb70b542917d7ac1f30de51c6629ef6d64912e1bcd1affc314b2e47` | 218 | `.editorconfig` |
| `06b066ad636583e31734568ccc426d531102315170deb76a83b83a4604103c3c` | 99 | `.gitattributes` |
| `6e631e54472464620e0483dc9e09144985eb1cc1cc826a5e99bf53c188385e29` | 1466 | `.github/pull_request_template.md` |
| `e8bc2cacd54369c436295cd07bd17645c388aaf9191f48cdce22e9a90dbd5389` | 146 | `.gitignore` |
| `763b0a18ddeb24b71ef7df16c60796302abc23c07dd0081800a7ed19c651e18f` | 20286 | `AGENTS.md` |
| `2c00419a20a251fcfe47a116c5f3918e673975d162b32d32a10802250ed42d8b` | 7220 | `CHATGPT_START_HERE.md` |
| `6a2612d8379a8251b2e6d44a57a5cae5c0a4a88afb1826d6b8d95875f93a6fe4` | 6864 | `CHATGPT_WORKFLOW_PROFILE.md` |
| `c16b199d0215b56d2eaf0c68402a297b81d27c5f5803ef4445979001dd0c6c63` | 2887 | `README.md` |
| `5b55dffa46789cc3fb4115f77ff52f42d9e1fa41b9867ea882171106222f1873` | 8279 | `START_DEVELOPMENT.md` |
| `348926753ff363798a67d5e013573260a0ea3ffe1705492ca81254bdd4afc4ba` | 5908 | `WORKFLOW_MIGRATION.md` |
| `eb25b657af21581d4194e21abe2c9c8d0cbcafd434f34a872ba702a2f1bd84d3` | 10535 | `context.md` |
| `b1fbc9846c5f6e97638788071e0dc58808cae6d0702f4b58a390c6bda611dc7f` | 8850 | `docs/architecture/ARCHITECTURE.md` |
| `24ba9ee9ec86655fd57816a91cbdda59d00ef576666adc11953ef6598905480b` | 3001 | `docs/decisions/DECISIONS.md` |
| `02c845274d8e637781a19296aa30b1860cadf1817e93b44d3612dc7241dc7bdd` | 3702 | `docs/dependencies/DEPENDENCY_AND_LICENSE_POLICY.md` |
| `6428b88c9d2e4d94d48a0b8b61a778ee3dcb5a1d4d331b736496e5d92caf549c` | 2097 | `docs/dependencies/VERIFIED_CANDIDATES_2026-08-03.md` |
| `eff43a9c520c93da6d14a00291fad9d31c0a6ffb36be61b4905b952ee96d5e3e` | 8515 | `docs/domain/REPERTOIRE_DOMAIN_MODEL.md` |
| `c789f2cdf9b47fc229ab16e6eaae258135ee1a9caa60ca248036218a148a7474` | 3403 | `docs/fixtures/FIXTURE_CATALOGUE.md` |
| `af359c994e555b3de88c63177a85f86e3f1ef2fdf334e97982a7cb51e23290b8` | 8691 | `docs/product/PRODUCT_CONTRACT.md` |
| `d0caf97f70115e50af258c4243579185bd4cfdf388e51e6b98cc7f4c401b2ed3` | 6058 | `docs/storage/OFFLINE_DATA_AND_PORTABILITY.md` |
| `2a0b6f63db8148a799b1792dc04f9573c37c5fdd478a189655679db653908c16` | 6183 | `docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md` |
| `09a7af93caa4039a1e12bc1a8947aedc15d5686b10f19e8d113657691968b019` | 2012 | `docs/traceability/REQUIREMENTS_TRACEABILITY.md` |
| `1df205b9ee8309752473389333ee56a38cce624814604bbe5673cd7393b506cd` | 9049 | `docs/training/TRAINING_AND_SCHEDULING.md` |
| `4a72bcc871d1a32ba4d6a167409a430114ce2c3f889dd09347e05c1d9d4d722e` | 6118 | `docs/ui/UI_AND_INTERACTION_CONTRACT.md` |
| `48f8186008ce14e47c8d8fe49a91db384d1a198f4aed927d7ab3c3850283a5dc` | 2656 | `docs/workflow/ACTIONS_SECURITY_AND_EVIDENCE.md` |
| `c5dd7d5f76801723de5392415e98c5ba1b3c54be550e2bdcfdc206f906c7ab8a` | 4587 | `docs/workflow/CHATGPT_GITHUB_ACTIONS_CODING.md` |
| `39a43682063d8739d97f69f7f56174d472054ac1c7e5b65327807068d3b2a9d2` | 1746 | `docs/workflow/PHASE_COMMANDS.md` |
| `672f140a8d9e6d14f94448584d98188fc62ffd49a16e0a16c8af44a0fd835da3` | 2590 | `docs/workflow/PROMPT_WRITING_GUIDELINES.md` |
| `fb0b096c61386998be922de419b3b2ab91518c03803144ca525c6b8eee04bbf2` | 2588 | `docs/workflow/STRUCTURED_REPORT_TEMPLATE.md` |
| `0cd9981ecbe8d85a59aa6f0da1c1baed2944cedb6d31265164a80b3f074eccba` | 50900 | `plans.md` |
| `2b6202fae840cace77a92ed998ef8ce480dba14476ec77a8103c8b18a8ef3304` | 866 | `prompts/README.md` |
| `772e7729b7b3e5addb3bb9111cec28b68794076a84e7f659ef98b434be7a149e` | 2824 | `prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md` |
| `e04a45a28daf6c87afe31b6d1cf8165d2939c15c6b04a09cb9cf58eb60960b25` | 6637 | `scripts/verify-pack.mjs` |

## Verification

From an extracted transfer archive:

```sh
node scripts/verify-pack.mjs
```

Expected prefix:

```text
PACK_VERIFICATION_OK
```

After repository migration, regenerate the repository-wide integrity manifest with its existing updater and run the same verifier through `pnpm validate`.
