# PHASE-6 behavioural contract

PHASE-6 completes the local repertoire workspace on top of the PHASE-5 scheduling
core. The rules below are normative for the implementation and acceptance tests.

## Workspace and training lifecycle

- Browse is the default non-training surface for persisted repertoires. It may show
  complete move labels, notes, names, progress and excluded branches.
- Browse navigation is read-only with respect to review evidence and scheduler state.
- Starting move recall, opening-name recall or a contrast drill creates an explicit
  recoverable training session.
- A non-terminal training session freezes its semantic scope. Branch inclusion,
  playlist filters/membership, tags and authored hint/name metadata that could change
  the reconstructed prompt are rejected until the session is completed or abandoned.
- Opening Browse while recall is active is not a pause. The session is completed or
  explicitly abandoned first because Browse exposes answers.
- Display-only repertoire renames do not reinterpret a prompt and remain safe.
- Backup/restore and training/management writes share one serialized repository write
  barrier. A restore drains earlier writes, blocks later writes and then commits
  atomically.

## Repertoires and playlists

- Repertoires and playlists are soft-archived, never destructively deleted by PHASE-6
  management actions.
- Repertoire colour is immutable after import. Correcting a wrong colour requires a
  new import.
- An archived repertoire preserves graph data, move/name/contrast history and all
  scheduler projections but is ineligible for training.
- Playlist membership is preserved when a member repertoire is archived. The derived
  playlist state is `ready`, `partially-unavailable`, `unavailable` or `archived`.
- Restoring a repertoire automatically restores its preserved playlist membership.
- Playlist filters are bounded to repertoire membership, colour, include/exclude
  context subtrees, tags and maximum ply.
- `due-first` preserves scheduler urgency. `balanced` preserves scheduler-class
  priority but, inside equivalent urgency, prefers under-represented repertoire/root
  prefixes before deterministic tie-breakers.

## Browse and progress

- Browse uses context-rich nodes that retain context/position identity, explicit and
  effective inclusion, transposition information and derived progress.
- Excluded branches remain visible and selectable in Browse.
- Selecting a context synchronizes the read-only board to that context's FEN.
- Move progress is derived, not stored as a percentage. Per-decision dimensions are
  lifecycle (`new`, `learning`, `mature`), due, weak and ever-trained.
- `never-trained` is derived from immutable targeted move-review evidence, not only
  from current scheduler stage.
- Repertoire-wide counts deduplicate shared move-training identities; branch summaries
  may legitimately surface the same transposed decision under each relevant path.
- Weak/due descendants propagate upward and are never averaged away.
- Guided, strict and contrast schedules do not count toward ordinary move mastery.
- Opening-name progress is separate from move progress.

## Authored hints and annotations

- Context note, move note and move purpose are editable in Browse.
- Authored move/context guidance is not mounted in the Train DOM/accessibility tree
  before Hint 3.
- Hint 3 may show authored purpose/note; structural generated text is the fallback.
- Hint 4 remains the explicit move reveal.
- Existing PHASE-5 hint grading caps continue to apply even if a user's own Hint-3
  annotation effectively names the move.

## Confusions and contrast

- New move observations record the exact expected context used for that prompt.
- A contrast relation is directional: expected context -> confused sibling context.
- Eligibility requires at least 2 matching normal-recall sibling-confusion observations
  inside the preceding 30 days and the pair's independent contrast scheduler being new
  or due.
- Legacy confusion evidence without an unambiguous expected context is retained and
  displayed as ambiguous; PHASE-6 never invents the missing context.
- Contrast responses update only the contrast scheduler. Contrast mistakes do not add
  normal confusion evidence and therefore cannot self-perpetuate eligibility.
- The sibling comparison is revealed only after response/reveal.

## Opening-name recall

- Opening-name recall is a separate memory subsystem from move recall.
- A name has one primary label and zero or more explicit accepted aliases.
- Normalization v1 is Unicode NFKC, trim, whitespace collapse and locale-independent
  lowercase. There is no fuzzy matching or punctuation removal.
- The name item identity includes contextual path/position and normalized accepted
  answer set. A material answer-set change supersedes the prior item without rewriting
  old evidence.
- Accepted answer -> `Good`; incorrect answer or reveal -> `Again`. Response time is
  retained as evidence but does not synthesize `Easy` in v1.
- Name sessions are independently recoverable and idempotent.
- Name reviews must not mutate move-review logs, move scheduler state or move decisions.

## Portability

- Database/portable schema v3 adds PHASE-6 lifecycle and independent name/contrast
  evidence/scheduler/session tables while retaining every PHASE-5 move table unchanged.
- v1/v2 complete backups remain accepted and are staged into v3 without replaying move
  reviews or fabricating PHASE-6 history.
- Complete JSON is the lossless portable representation.
- PGN export preserves representable variations, NAGs and annotations. Any PHASE-6
  metadata that PGN cannot represent losslessly is reported explicitly to the user.

## Repository boundary and bounds

- UI code never writes raw Dexie tables.
- New user-authored names, notes, purposes, aliases, tags and playlist filters are
  bounded and validated at the repository/domain boundary.
- Unsupported scheduler adapter, parameter or mapping versions fail closed before a
  new name/contrast/move review is persisted.
- Semantic management operations expose an impact preview before commit.
