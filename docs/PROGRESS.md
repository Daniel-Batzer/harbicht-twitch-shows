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

Next: Phase 2 – game flow and state transitions.
