# Opening Trainer Codex pack manifest

## 0. Pack identity

```yaml
pack_name: Opening Trainer Codex Agentic Pack
project_id: PRJ-CHESS-OPENING-TRAINER
namespace: project.chess_opening_trainer
planned_repository: lucakollmer/opening-trainer
programme: MVP
created_date_europe_london: 2026-08-03
pack_version: 1.0
```

## 1. Installation target

Extract the contents of the pack folder into the root of a new private `lucakollmer/opening-trainer` repository. Preserve relative paths and raw UTF-8/LF bytes. Run `node scripts/verify-pack.mjs` before committing.

## 2. Governing files

- `AGENTS.md` — repository rules, authority, architecture, phase discipline, validation and reporting.
- `context.md` — accepted project and execution state.
- `plans.md` — PHASE-0 through PHASE-8 with entry gates, branches, scope, tests, manual acceptance, rollback and memory capture.
- `CODEX_START_HERE.md` — short-command routing and first Codex instruction.
- `CODEX_PROMPT_PROFILE.md` — project adaptation of the accepted prompt-writing framework.
- `START_DEVELOPMENT.md` — precise Windows/GitHub/Codex start procedure.

## 3. File inventory

| Repository path | Bytes | SHA-256 |
|---|---:|---|
| `.editorconfig` | 218 | `c02a7fbbcbb70b542917d7ac1f30de51c6629ef6d64912e1bcd1affc314b2e47` |
| `.gitattributes` | 99 | `06b066ad636583e31734568ccc426d531102315170deb76a83b83a4604103c3c` |
| `.github/pull_request_template.md` | 834 | `4effd39487d956135870e53e8bfcb92dbb2762a83bf480c1d5723e3f29d3a715` |
| `.gitignore` | 146 | `e8bc2cacd54369c436295cd07bd17645c388aaf9191f48cdce22e9a90dbd5389` |
| `AGENTS.md` | 15956 | `86803d65cc4aa87f4bdda445d88665c1c21e839a80fd07602da8b5db2f1d0ed9` |
| `CODEX_PROMPT_PROFILE.md` | 6164 | `49c78d04e421e2e02d4925df09bbfb73d89b86f4986f5e19da5daf752f2aa32d` |
| `CODEX_START_HERE.md` | 4168 | `3e304469c0bfbe0e59aa39cd4b99b77af66d7604a2c333ce228654a1bffe4b1e` |
| `README.md` | 1653 | `f87176b233a9b689c2f61a9946d10a54388271f04ed45762c3a496be9429d366` |
| `START_DEVELOPMENT.md` | 7105 | `b5b00643294b1499e31ea872302537e4c4138d97a65fee4e5bc37a5e7c55437e` |
| `context.md` | 7431 | `b4204620a9df44b728a209de4e0a53c28e404cd22e8c234f068684740546eb33` |
| `docs/architecture/ARCHITECTURE.md` | 8850 | `b1fbc9846c5f6e97638788071e0dc58808cae6d0702f4b58a390c6bda611dc7f` |
| `docs/codex/COMPLETION_REPORT_TEMPLATE.md` | 2365 | `6b63b87633aced11b4634c9a8a72e3e5907a8f8555ef38c010a73b5cb94447ae` |
| `docs/codex/PHASE_COMMANDS.md` | 1465 | `3924e013f84f11f0cace8714479feae47d3ec76d1fae366e9638f387492dcc51` |
| `docs/codex/PROMPT_WRITING_GUIDELINES.md` | 2109 | `7b3a3a92a6e9d85418a428d161fe9ac9c09e91a7a340ada80e1ece8757419a41` |
| `docs/decisions/DECISIONS.md` | 2446 | `d690d79b458708201f2224c0c024709196f111e4b55ed806679285de35d2b870` |
| `docs/dependencies/DEPENDENCY_AND_LICENSE_POLICY.md` | 3702 | `02c845274d8e637781a19296aa30b1860cadf1817e93b44d3612dc7241dc7bdd` |
| `docs/dependencies/VERIFIED_CANDIDATES_2026-08-03.md` | 2060 | `fd83d665e186b8e168469245a8a18eb3ddabf79358f0fcec20f72f394dc7bcae` |
| `docs/domain/REPERTOIRE_DOMAIN_MODEL.md` | 8515 | `eff43a9c520c93da6d14a00291fad9d31c0a6ffb36be61b4905b952ee96d5e3e` |
| `docs/fixtures/FIXTURE_CATALOGUE.md` | 3403 | `c789f2cdf9b47fc229ab16e6eaae258135ee1a9caa60ca248036218a148a7474` |
| `docs/product/PRODUCT_CONTRACT.md` | 8579 | `bcaad212cda526afeb7723bdcdcb46f7f2b58c165892e5b430ac194c779609a4` |
| `docs/storage/OFFLINE_DATA_AND_PORTABILITY.md` | 6058 | `d0caf97f70115e50af258c4243579185bd4cfdf388e51e6b98cc7f4c401b2ed3` |
| `docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md` | 5891 | `358fe532a6f136f24dcd1951c7c03453e1129427c21b26936400017c019d0314` |
| `docs/traceability/REQUIREMENTS_TRACEABILITY.md` | 2012 | `09a7af93caa4039a1e12bc1a8947aedc15d5686b10f19e8d113657691968b019` |
| `docs/training/TRAINING_AND_SCHEDULING.md` | 9049 | `1df205b9ee8309752473389333ee56a38cce624814604bbe5673cd7393b506cd` |
| `docs/ui/UI_AND_INTERACTION_CONTRACT.md` | 6023 | `5e280fa66ed7ffb37c6ab756b6284bec14e20b3f6fe25b21332209324fd636a4` |
| `plans.md` | 47799 | `adae8f7e39fcf06b3587d3b904f5a32abe944f2838e302ba322907642311b59f` |
| `prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md` | 3989 | `b091a131f2f1196f828d8746893ace608cf8f90dc90a9a238544781e482727e2` |
| `prompts/README.md` | 559 | `b9abf3a4bd339f4067c44ec232d19ea5f5f41eecac53ea4895d216abf27f5339` |
| `scripts/verify-pack.mjs` | 4292 | `faa42475cf968268cb91d70c146b9b758c420bf11b87e8e7f7771b1351ff6991` |

## 4. Integrity model

- `SHA256SUMS.txt` contains hashes for every pack file except itself, including this manifest.
- `scripts/verify-pack.mjs` verifies hashes, required files, unmanifested files, UTF-8/LF/no-trailing-whitespace rules, the AGENTS size bound, phase presence and the prompt sentinel.
- After application code is added in PHASE-0, this initial pack verifier should remain available for pack provenance; application validation is owned by repository scripts.

## 5. Phase programme

```text
PHASE-0  Repository and application foundation
PHASE-1  Responsive board/tree/task training shell
PHASE-2  Deterministic training vertical slice
PHASE-3  Repertoire graph, transpositions, playlists and PGN import
PHASE-4  Offline persistence, recovery and portability
PHASE-5  FSRS adapter and adaptive session generator
PHASE-6  Repertoire management, progress and opening-name recall
PHASE-7  PWA, mobile, accessibility and operational hardening
PHASE-8  Release candidate, deployment and packaging decision
```

## 6. Exact first action

Follow `START_DEVELOPMENT.md`: create the private repository, extract and verify this pack, commit it on `main`, run Codex in the repository root, and execute PHASE-0 only.
