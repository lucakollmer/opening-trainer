# UI and interaction contract

## 1. Principle

Use a small number of stable surfaces and standard Material UI components. The UI exists to support rapid recall, not to display a large product dashboard.

## 2. Component inventory target

Prefer these library components:

| Behaviour | Default implementation |
|---|---|
| Top bar | MUI `AppBar`, `Toolbar` |
| Mode selection | `ToggleButtonGroup` or `Tabs` when semantics fit |
| Repertoire/playlist selection | `Select`, `Autocomplete` or `Menu` |
| Desktop side panels | `Drawer`, `Paper`, CSS grid |
| Compact tree | temporary/`SwipeableDrawer` |
| Repertoire tree | MUI X `RichTreeView` Community |
| Task and feedback | `Paper`, `Card`, `Alert`, `Typography` |
| Hints and commands | MUI `Button`, `IconButton`, `Menu` |
| Progress/state | `LinearProgress`, `Chip`, icons plus text |
| Import/settings | `Dialog`, forms, `Stepper` only when genuinely sequential |
| Transient feedback | `Snackbar` only for non-critical transient events |
| Destructive confirmation | `Dialog` with explicit target and consequence |

The chessboard is the specialised exception and uses `react-chessboard` behind a project-owned adapter.

## 3. Desktop layout

Use CSS grid or MUI layout primitives with bounded panel widths. The board receives the largest square area and remains centred.

Recommended starting proportions, not immutable pixel requirements:

```text
tree: 260–320 px
board: min(available centre, viewport height minus chrome)
task: 300–360 px
```

Panels may collapse, but the current prompt/feedback must remain visible during training.

## 4. Compact layout

At phone widths:

1. toolbar;
2. square board using available width;
3. task/feedback card;
4. line/session context;
5. tree via temporary drawer/bottom sheet.

Do not shrink three desktop columns into unreadable narrow panels.

## 5. Board interaction

- Drag-and-drop and click/tap source/destination are acceptable.
- Illegal moves snap back or remain uncommitted with accessible feedback.
- The board shows last move after it is known.
- Hint highlights are visually distinct from accepted/revealed move feedback.
- Promotion uses a bounded accessible selector.
- Board orientation follows user colour by default and can be changed.
- Browse navigation does not create training evidence.
- Repair/replay states explicitly control whether backward navigation is available.

## 6. Task-panel states

Implement explicit states rather than scattered conditional fragments:

```text
idle
session-start
awaiting-user-move
opponent-moving
correct-feedback
illegal-feedback
outside-repertoire-feedback
wrong-variation-feedback
hint-offered
answer-revealed
repair-replay
line-complete
session-complete
error
```

Each state defines title, instruction, permitted commands, live-region behaviour and whether the tree reveals the responded move.

## 7. Feedback timing

Correct feedback should be brief enough to preserve rhythm. Errors remain until understood/repaired. Do not auto-dismiss critical explanations before keyboard/screen-reader users can access them.

Opponent moves may use a short configurable delay, but tests use an injected zero/controlled delay. Respect reduced motion.

## 8. Masking and non-disclosure

Before the user's move in Train mode:

- do not render future SAN/UCI as visible text;
- do not place the answer in `aria-label`, `title`, tooltip, data attribute or accessible hidden text;
- do not expose answer-bearing notes;
- use neutral branch placeholders with stable non-answer IDs;
- ensure snapshots/tests inspect DOM non-disclosure.

After response/reveal, show the selected/accepted move and keep unrelated future labels masked.

## 9. Tree item content

A tree item may show:

- move number and SAN when visible;
- masked placeholder when not visible;
- learning-state icon plus text/accessible label;
- due/weak descendant count;
- inclusion checkbox only in management mode;
- transposition marker;
- active-path/current-position marker.

Avoid turning every node into a dense analytics row.

## 10. Import flow

Use a dialog with a small number of steps only when needed:

1. choose file/paste PGN;
2. parse and preview repertoire/variations/warnings;
3. choose create/merge destination and user colour;
4. commit transaction and show report.

Parse/validation errors must identify location where available. Unsupported annotations/variations are reported before commit. Cancellation leaves no partial data.

## 11. Repertoire management

Use Browse plus an explicit management mode/drawer rather than a separate complex editor initially. Support branch inclusion, naming, notes and playlist membership. Drag-and-drop branch reordering is not required for MVP.

## 12. Accessibility

- Semantic headings and landmarks.
- Visible focus and logical tab order.
- Tree keyboard behaviour from MUI is preserved rather than reimplemented.
- Board has an alternative accessible move-entry route if the board library cannot expose adequate square semantics.
- Feedback uses appropriate live regions without repeating every board change.
- Touch targets are comfortably sized.
- Contrast meets accepted MUI/theme baselines.
- Status is not colour-only.
- Dialog focus is trapped and restored by MUI patterns.

## 13. Theme

One `theme.ts` owns typography, spacing, breakpoints and palette choices. Start with a restrained default MUI treatment and system fonts. Support light mode first; dark mode may be included only if low-cost and tested, but must not delay MVP phases.

Do not copy arbitrary spacing, colours or shadows into feature files.

## 14. Manual acceptance responsibilities

Luca verifies:

- desktop/phone density;
- board size and touch feel;
- tree usefulness without answer leakage;
- feedback clarity and timing;
- hint discoverability;
- import comprehension;
- focus and keyboard feel;
- installed/offline experience in real browsers.

Codex supplies exact actions, expected visible results, expected persisted results and failure evidence for each item.
