# Candidate dependency/source verification — 2026-08-03

This record supports pack authoring. PHASE-0 must re-read installed package metadata, lock exact versions and record licences before accepting the dependency baseline.

| Candidate | Official source | Licence observed | Intended use |
|---|---|---|---|
| OpenAI Codex CLI | https://github.com/openai/codex | Apache-2.0 | Local coding agent; not an app dependency |
| React | https://github.com/facebook/react | MIT | UI runtime |
| Vite | https://github.com/vitejs/vite | MIT | Build/dev server |
| Material UI | https://github.com/mui/material-ui | MIT | Standard UI components |
| MUI X Tree View Community | https://mui.com/x/react-tree-view/ | Community/MIT features only | Repertoire tree |
| react-chessboard | https://github.com/Clariity/react-chessboard | MIT | Chessboard presentation/input |
| chess.js | https://github.com/jhlywa/chess.js | BSD-2-Clause | Chess rules/state/notation |
| Dexie | https://github.com/dexie/Dexie.js | Apache-2.0 | IndexedDB wrapper |
| ts-fsrs | https://github.com/open-spaced-repetition/ts-fsrs | MIT | FSRS implementation behind adapter |
| vite-plugin-pwa | https://github.com/vite-pwa/vite-plugin-pwa | MIT | PWA/service worker integration |
| Lichess chess-openings | https://github.com/lichess-org/chess-openings | CC0-1.0 | Candidate opening-name/ECO data |
| Lichess Opening Explorer | https://github.com/lichess-org/lila-openingexplorer | AGPL-3.0 server source; API use requires separate review | Optional future frequency metadata |

## Boundaries

- Never import MUI X Pro/Premium packages or require a commercial licence for an MVP requirement.
- Do not copy Chessground or another GPL board implementation into this permissive web application without a separate licence/architecture decision.
- Do not bundle Opening Explorer server/database code or cached data under the assumption that an API makes redistribution unrestricted.
- Do not bundle commercial repertoire content.
- Record exact package versions from `pnpm-lock.yaml` after PHASE-0.
