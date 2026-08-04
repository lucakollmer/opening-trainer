# Product contract — Opening Trainer MVP

## 1. Product promise

Opening Trainer helps a user build reliable opening recall by playing selected repertoire lines from the initial position while scheduling memory at individual contextual decisions.

The product is not an engine, analysis board, opening explorer, social network or marketplace. It trains the user's selected repertoire.

## 2. Primary user outcomes

A user can:

1. import or select repertoire material;
2. organise branches into playlists;
3. start a due-material session;
4. play complete lines against a deterministic repertoire opponent;
5. receive clear feedback for correct, illegal, outside-repertoire and wrong-variation moves;
6. use progressive hints;
7. repair mistakes and be retested;
8. review learning state by branch and decision;
9. practise opening names separately;
10. export repertoire, settings and review history in a portable format.

## 3. Main surface

The application is one persistent workspace.

### Desktop

```text
compact toolbar
┌───────────────┬───────────────────────┬──────────────────┐
│ repertoire    │                       │ current task     │
│ tree          │      chessboard       │ feedback         │
│               │                       │ hint controls    │
└───────────────┴───────────────────────┴──────────────────┘
line/opening context and session progress
```

### Phone

```text
compact toolbar
chessboard
task / feedback card
line context and progress
repertoire tree in temporary drawer or bottom sheet
```

The board remains the dominant element. Core training requires no dashboard navigation.

## 4. Modes

### Train

- Due/weak material is selected by the session generator.
- The already-played path is visible.
- Future answer-bearing tree labels are masked.
- The board is the recall cue.
- Feedback and hints appear in the task panel.

### Browse

- Full tree labels are visible.
- The user may navigate the repertoire freely.
- Position notes, opening names and learning state are visible.
- Browse interactions never create review evidence.

### Guided learning

- Used for unseen or newly imported lines.
- Demonstrate a bounded segment, rewind, ask the user to reproduce it, then extend progressively.
- Notes may appear before or after moves according to the lesson step.

### Later modes

- Strict move-order drill: test an exact route when move order itself matters.
- Contrast drill: compare branches the user repeatedly confuses.

These later modes are implemented only in their named phase.

## 5. Training exercise contract

A training exercise contains:

- active repertoire and playlist context;
- user colour;
- route from initial position;
- one or more explicitly targeted decision items;
- deterministic opponent-choice policy;
- accepted user-move set at each user decision;
- hint state;
- evidence log;
- completion and repair state.

Normal sequence:

1. start from the initial position;
2. user and deterministic opponent traverse the selected route;
3. at a user decision, accept any move permitted by the active repertoire context;
4. replan the continuation from the resulting position;
5. classify errors without conflating legality and repertoire membership;
6. complete or repair the line;
7. record targeted and incidental evidence separately;
8. update the scheduler only through the scheduling adapter;
9. present a concise line summary;
10. advance to the next exercise.

## 6. Move outcomes

### Correct accepted move

The move is legal and included in the current contextual accepted set. Follow the resulting branch. For a target item, record full positive evidence. For an incidental item, record capped positive evidence.

### Accepted transposition

The legal move reaches a known allowed contextual position. Accept it and continue from the graph node unless strict move order is the explicit prompt.

### Wrong sibling variation

The move is legal and belongs to another known sibling context but not the current prompt's accepted set. Record variation confusion, show a concise comparison after the response, repair the decision and consider a future contrast drill.

### Legal outside-repertoire move

The move is legal but does not belong to an accepted relevant context. Record recall failure. Do not use an engine to judge quality.

### Illegal move

Reject without advancing the position. Record it separately from repertoire recall. Repeated illegal attempts may lower confidence in the exercise but do not automatically equal a full memory lapse.

## 7. Hints

Progressive levels:

1. indicate the moving piece or piece type;
2. show a small candidate destination set;
3. show the saved purpose/note;
4. reveal the move.

Each hint request is logged. The full answer must not be present in hidden UI text before reveal.

## 8. Error repair

For a wrong or fully revealed target decision:

1. show the accepted move and relevant note;
2. rewind enough context to ask the decision again;
3. require a correct replay before continuing;
4. schedule a delayed same-session retest from the beginning of the containing line;
5. preserve the original failed evidence and the repair evidence separately.

A repair is not reclassified as an original correct recall.

## 9. Tree behaviour

Browse mode shows all labels.

Train mode:

- shows the path already played;
- shows that future branches exist without exposing labels;
- reveals the chosen move after the response;
- keeps unrelated future branches masked;
- scrolls the active path into view;
- provides text/icon distinctions for new, learning, due, weak and mature states;
- does not depend on colour alone.

Tree state is a projection of domain data. It is not the canonical repertoire store.

## 10. Session controls

MVP controls:

- repertoire/playlist selector;
- Train/Browse mode;
- session length by number of target decisions or approximate duration;
- start/pause/end session;
- hint;
- board orientation;
- tree open/close on compact layouts;
- undo only where the current mode explicitly permits browsing or repair.

Do not expose Anki-style grading buttons after every move by default. The system infers evidence from correctness, time and hints. A bounded line-end override may be added later.

## 11. Progress

Progress is not one percentage per opening.

Show, as appropriate:

- new/learning/due/mature decision counts;
- due count under each branch;
- branch confidence constrained by weak important decisions;
- never-trained branches;
- recent confusion relationships;
- upcoming review distribution;
- separate name-recall progress.

Do not call a line mastered while a deep required decision remains weak.

## 12. Repertoire management

MVP supports:

- PGN import with variations where the chosen parser preserves them;
- repertoire name and user colour;
- branch inclusion/exclusion;
- playlist creation from branches/tags/depth;
- user notes attached to contextual positions or moves;
- complete JSON backup and restore;
- PGN export of repertoire content where representable.

A destructive replacement import requires explicit confirmation and a verified backup path. Prefer transactional merge or create-new-repertoire behaviour.

## 13. Non-functional requirements

- Works after initial load without a network connection.
- Supports current desktop and mobile-sized browsers.
- Core training is usable by touch and mouse.
- Essential controls have keyboard-accessible alternatives.
- First meaningful interaction is fast enough for a lightweight local application.
- Data survives ordinary reload, browser restart and app update.
- Exports remain documented and versioned.
- No telemetry or cloud account is required.

## 14. MVP non-scope

- engine analysis/evaluation;
- tactical punishment of non-repertoire moves;
- multiplayer or playing-strength opponent;
- cloud accounts and sync;
- coach administration;
- marketplace or third-party paid repertoire distribution;
- social features;
- opening-explorer browsing inside the trainer;
- native app-store packaging;
- elaborate dashboard or gamification;
- automated generation of strategic notes.

## 15. Acceptance boundary

ChatGPT authors bounded changes and GitHub Actions establishes technical evidence for the exact candidate tree. Luca accepts visual density, touch feel, tree masking, feedback clarity and overall training rhythm. Technical success never implies visible acceptance, merge or continuation.
