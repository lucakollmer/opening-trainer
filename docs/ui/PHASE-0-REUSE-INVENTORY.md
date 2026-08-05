# PHASE-0 reusable UI/UX inventory

| Behaviour           | Implementation                                             | Decision | Reason                                                   | Test coverage                            |
| ------------------- | ---------------------------------------------------------- | -------- | -------------------------------------------------------- | ---------------------------------------- |
| Application toolbar | MUI `AppBar`, `Toolbar`, `Typography` in `src/app/App.tsx` | reuse    | Ordinary shell chrome belongs to MUI                     | host render test                         |
| Foundation layout   | MUI `Container`, `Stack`, `Box`, `Paper`, `Card`           | compose  | Proves composition without a custom layout system        | host render test                         |
| Theme/provider      | MUI `ThemeProvider`, `CssBaseline`                         | reuse    | Single accepted theme source                             | host render test                         |
| Board placeholder   | `react-chessboard` in `ChessboardPreview`                  | wrap     | Specialised chess visual primitive                       | mocked host render plus production build |
| Tree placeholder    | MUI X Community `SimpleTreeView` and `TreeItem`            | reuse    | Accepted accessible community tree                       | host render test                         |
| Task placeholder    | MUI `Card`, `Chip`, `Typography`                           | compose  | Ordinary task surface uses existing controls             | host render test                         |
| Boot failure        | project error boundary plus MUI `Alert`                    | compose  | Small app-owned recovery boundary with standard feedback | focused boundary test                    |

The synthetic labels are not real opening content and do not reveal future training answers. Responsive product behaviour remains PHASE-1 scope.
