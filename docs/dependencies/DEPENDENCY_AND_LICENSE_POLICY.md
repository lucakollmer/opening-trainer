# Dependency and licence policy

## 1. Principle

Use a small maintained dependency set. Record exact installed versions and licences in PHASE-0. Do not depend on a paid feature for an MVP requirement.

## 2. Accepted primary candidates

| Purpose | Candidate | Boundary |
|---|---|---|
| UI runtime | React | Presentation only |
| Build/dev | Vite | Web build and dev server |
| UI components | Material UI | Ordinary controls/layout/theme |
| Repertoire tree | MUI X Tree View Community | Community features only |
| Chessboard | react-chessboard | Presentation/input adapter |
| Chess rules | chess.js | Legality/state/notation; no engine |
| Local data | Dexie | IndexedDB persistence adapter |
| Scheduling | ts-fsrs | Behind project scheduling port |
| PWA | vite-plugin-pwa | Manifest/service-worker integration |
| Tests | Vitest + Testing Library | Local automated tests |
| Browser tests | Playwright | PHASE-7 only |

PHASE-0 records package name, installed version, source URL, licence and why it is needed.

## 3. Supporting dependencies

A small runtime schema validator may be added for backup/import boundaries when PHASE-0 or PHASE-4 records the choice and licence. It must not replace domain types with loosely inferred `unknown` handling.

Avoid utility libraries for operations available clearly in the platform or existing dependencies.

## 4. Licence rules

- Permissive dependencies are preferred.
- MUI X Community must remain within Community/MIT capabilities. Do not import Pro/Premium packages or require a commercial key.
- Record licences in a repository document and lockfile.
- Do not copy source/assets from examples without confirming their licence.
- Chess piece/board assets must have recorded provenance/licence or use package-provided assets according to package terms.

## 5. Opening data

### User PGN

Treat content supplied/created by the user as authoritative for their repertoire when permission is clear. Do not publish it automatically.

### Lichess chess-openings

May be evaluated for opening names/ECO and public-domain-compatible data. Record dataset version/commit and attribution policy even where attribution is not legally required.

### Lichess Opening Explorer

Treat as an optional external service/source. Before integration, record:

- API endpoint and stability;
- licence and server-source implications;
- allowed caching/redistribution;
- rate limits;
- offline fallback;
- privacy implications of queries.

Do not bundle its database or server code into the MVP.

### Third-party repertoires

Do not bundle commercial books, courses, studies or scraped repertoire content without explicit permission.

## 6. Version policy

PHASE-0 installs current compatible stable releases under a lockfile and records the environment. Do not hard-code unverified version numbers from this pack.

Updates after PHASE-0 are separate bounded dependency changes when they materially affect behaviour. Avoid broad `latest` upgrades during feature phases.

## 7. Dependency acceptance checks

Before accepting a new dependency:

- active maintenance and compatible runtime;
- TypeScript support or adequate types;
- licence compatible with distribution;
- bundle/runtime impact proportionate;
- no overlapping dependency already meets the need;
- testability/offline behaviour;
- no mandatory cloud account or telemetry;
- documented replacement boundary through a project-owned adapter where risk is material.

## 8. Deferred/native dependencies

Capacitor and native plugins are not installed during MVP phases 0–7. PHASE-8 may compare PWA-only versus Capacitor packaging, but no native package is authorised unless Luca explicitly accepts that decision.
