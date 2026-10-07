# Harbicht Twitch Shows – Progress

Implementation status per roadmap slice. Product and architecture decisions live in `DECISIONS.md`, not here (Decision 038).

## Phase 1 / Slice 1 – First Local Game Slice

Status: **implemented, Motion integration pending**

Done:

- Static default deck (`src/features/questions/fixtures/default-deck.ts`). Options are a collection, and every question has three options.
- Pure random question selection with an injected random number.
- Minimal game state `IDLE ↔ INTRO` with explicit `startGame` / `endGame` transitions. Invalid transitions return a failure reason and leave the state unchanged.
- Temporary in-memory store, service, Server Actions for the host, and a polled `GET /api/game/state` for the overlay (Decision 041).
- `/host` (dashboard root layout): start/end controls, status, question preview, feedback for rejected transitions.
- `/overlay` (separate transparent root layout): a 1920×1080 stage scaled to the viewport, with the question card and three answer cards.
- Domain tests with Vitest (`npm run test`).

Pending:

- **Motion integration.** Context7 failed with "Invalid API key" during implementation, so no Motion code was written. The overlay entrance currently uses SCSS keyframes, and there is no exit animation when a game ends. Planned: wrap the round in `AnimatePresence` so the question springs in, the cards stagger in, and the round exits when the game ends.
- Manual OBS check: add `/overlay` as a Browser Source at 1920×1080, confirm the transparent background and that nothing is clipped.

## Phase 2 / Slice 2 – Game Flow and State Transitions

Status: **implemented**

Done:

- Explicit state machine `IDLE → INTRO → VOTING → LOCKED → REVEAL → RESULT → (INTRO | FINISHED)`, with `END_GAME` from any running state back to IDLE (Decision 042). PREPARE is deferred.
- Pure transition functions plus `getAvailableCommands` and `applyGameCommand`. Invalid transitions return `INVALID_TRANSITION` and never mutate state.
- A session has `totalRounds` (default 5) and never repeats a question (`playedQuestionIds`).
- Tests cover the full transition matrix (every reachable state × every command, including no-mutation checks), the consistency between `getAvailableCommands` and the transition guards, invalid `totalRounds`, deck exhaustion, and a full playthrough.
- `/host`: one Server Action with Zod-validated `command`. The buttons come from the domain's available commands: a fixed primary step, "Finish game early" while rounds remain, and End game / Close game kept apart.
- `/overlay`: round eyebrow (`Round n / 5`), question only in INTRO, answer cards from VOTING on (dimmed once locked), a phase banner per state, and a game-over card in FINISHED. Styling uses SCSS only.

Known limitations:

- REVEAL and RESULT are visual placeholders until votes exist (Phase 3) and the reveal sequence is built (Phase 4).
- With ~1 s polling, the overlay can skip a phase visually if the host clicks faster than the poll interval (Decision 041).
- There is no confirm dialog on End game.

Pending:

- **Motion integration** (still open from Slice 1, planned as its own small slice): question/answer enter and exit, phase banner transitions.
- Manual OBS check (see Slice 1).

Next: Motion follow-up, then Phase 3 – local voting.
