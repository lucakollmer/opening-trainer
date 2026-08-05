# PHASE-0 installed dependencies and environment

Generated: 2026-08-04T11:49:08.818Z

## Environment

- Node: v24.18.0
- npm: 11.16.0
- pnpm: 11.20.0
- packageManager: pnpm@11.20.0

## Direct dependency record

| Package                       | Installed version | Licence declared by package | Official package repository/homepage                            | Scope       |
| ----------------------------- | ----------------: | --------------------------- | --------------------------------------------------------------- | ----------- |
| `react`                       |          `19.2.8` | MIT                         | https://github.com/react/react                                  | runtime     |
| `react-dom`                   |          `19.2.8` | MIT                         | https://github.com/react/react                                  | runtime     |
| `@mui/material`               |           `9.2.0` | MIT                         | https://github.com/mui/material-ui                              | runtime     |
| `@mui/icons-material`         |           `9.2.0` | MIT                         | https://github.com/mui/material-ui                              | runtime     |
| `@mui/x-tree-view`            |          `9.10.1` | MIT                         | https://github.com/mui/mui-x                                    | runtime     |
| `@emotion/react`              |         `11.14.0` | MIT                         | https://github.com/emotion-js/emotion/tree/main/packages/react  | runtime     |
| `@emotion/styled`             |         `11.14.1` | MIT                         | https://github.com/emotion-js/emotion/tree/main/packages/styled | runtime     |
| `react-chessboard`            |          `5.11.0` | MIT                         | https://github.com/Clariity/react-chessboard                    | runtime     |
| `chess.js`                    |           `1.4.0` | BSD-2-Clause                | https://github.com/jhlywa/chess.js                              | runtime     |
| `dexie`                       |           `4.4.4` | Apache-2.0                  | https://github.com/dexie/Dexie.js                               | runtime     |
| `dexie-react-hooks`           |           `4.4.0` | Apache-2.0                  | https://github.com/dexie/Dexie.js                               | runtime     |
| `ts-fsrs`                     |           `5.4.1` | MIT                         | https://github.com/open-spaced-repetition/ts-fsrs               | runtime     |
| `vite`                        |           `8.2.0` | MIT                         | https://github.com/vitejs/vite                                  | development |
| `@vitejs/plugin-react`        |           `6.0.5` | MIT                         | https://github.com/vitejs/vite-plugin-react                     | development |
| `typescript`                  |           `6.0.3` | Apache-2.0                  | https://github.com/microsoft/TypeScript                         | development |
| `@types/node`                 |          `26.1.2` | MIT                         | https://github.com/DefinitelyTyped/DefinitelyTyped              | development |
| `@types/react`                |         `19.2.18` | MIT                         | https://github.com/DefinitelyTyped/DefinitelyTyped              | development |
| `@types/react-dom`            |          `19.2.4` | MIT                         | https://github.com/DefinitelyTyped/DefinitelyTyped              | development |
| `vite-plugin-pwa`             |           `1.3.0` | MIT                         | https://github.com/vite-pwa/vite-plugin-pwa                     | development |
| `vitest`                      |          `4.1.10` | MIT                         | https://github.com/vitest-dev/vitest                            | development |
| `jsdom`                       |          `30.0.1` | MIT                         | https://github.com/jsdom/jsdom                                  | development |
| `@testing-library/react`      |          `16.3.2` | MIT                         | https://github.com/testing-library/react-testing-library        | development |
| `@testing-library/jest-dom`   |           `7.0.0` | MIT                         | https://github.com/testing-library/jest-dom                     | development |
| `@testing-library/user-event` |          `14.6.1` | MIT                         | https://github.com/testing-library/user-event                   | development |
| `fake-indexeddb`              |           `6.2.5` | Apache-2.0                  | git://github.com/dumbmatter/fakeIndexedDB                       | development |
| `eslint`                      |          `9.39.5` | MIT                         | eslint/eslint                                                   | development |
| `@eslint/js`                  |          `9.39.5` | MIT                         | https://github.com/eslint/eslint                                | development |
| `typescript-eslint`           |          `8.65.0` | MIT                         | https://github.com/typescript-eslint/typescript-eslint          | development |
| `eslint-plugin-react-hooks`   |           `7.1.1` | MIT                         | https://github.com/facebook/react                               | development |
| `eslint-plugin-react-refresh` |           `0.5.3` | MIT                         | github:ArnaudBarre/eslint-plugin-react-refresh                  | development |
| `prettier`                    |           `3.9.6` | MIT                         | prettier/prettier                                               | development |
| `globals`                     |          `17.9.0` | MIT                         | sindresorhus/globals                                            | development |

## Acceptance notes

- MUI X usage is limited to `@mui/x-tree-view` Community/MIT features.
- `react-chessboard` is isolated behind a presentation component.
- `chess.js`, Dexie and `ts-fsrs` are behind project-owned domain/infrastructure boundaries.
- No package requires a cloud account, paid runtime feature or mandatory telemetry for this foundation.
- Exact transitive resolutions are recorded in `pnpm-lock.yaml`.
