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

## Phase 3 / Slice 3 – Local Voting

Status: **implemented**

Done:

- Voting domain in `src/features/voting/domain/`: individual votes with an opaque `participantId`, the replacement rule (`recordVote`), and derived results (`tallyVotes`). See Decision 043.
- `castVote` in the game domain: accepts votes only in VOTING and only for an option of the current question. A later valid vote replaces the earlier one, and a rejected vote changes nothing. The session keeps all effective votes across rounds (`session.votes`) and the host's participant id.
- Public snapshot without vote data before REVEAL. REVEAL and RESULT uncover the audience result (counts, percentages, winners) and the host's choice in the session's reveal order (Decision 044). Host-only data comes from a separate `HostRoundView`.
- `/host`: the host votes and can change their vote during VOTING, sees the vote count (not the distribution) during VOTING/LOCKED, and sees the full result from REVEAL on. A DEV panel simulates viewers: a named viewer (voting again replaces the vote) or 10 random votes from a fixed pool of 30.
- `/overlay`: once uncovered, each answer card shows percentage, vote count and a bar, and the winner(s) get a gold ring. The host's pick gets a sash and a spotlight, and the remaining cards step back. Styling is SCSS only.
- Tests cover replacement, invalid options, votes in every non-VOTING state, votes across rounds and into FINISHED, the tally (no votes, ties, host vote), snapshot visibility per phase, the host view, and the simulated vote picker.
- Configurable reveal order (Decision 044): `AUDIENCE_FIRST` (default) uncovers the audience result in REVEAL and the host's choice in RESULT; `HOST_FIRST` does the reverse. The phase that uncovers the host's choice shakes the banner and slams a sash with the host's name (`HOST_DISPLAY_NAME`) onto their card, with a spotlight. The host dashboard sees the audience result at the same moment as the overlay.

Known limitations:

- The reveal order can only be changed in code (`DEFAULT_REVEAL_ORDER` in `game-service.ts`). A per-game switch on the host panel is a planned follow-up.
- Overlay texts are English only. Bilingual texts with a language choice for the host are a later juicing pass.
- `/host` only updates after its own actions. Votes from other sources will need host polling (Phase 5).
- The overlay gives no live feedback for incoming votes yet (Phase 4).
- The simulated-viewer controls are available in every environment (Decision 043, revisit in Phase 5).
- Percentages are rounded per option, so their sum may be 99 or 101.

Pending:

- **Motion integration** (still open from Slices 1 and 2).
- Manual OBS check (see Slice 1).

Open points from playtesting (for Phase 4 unless noted):

- **Rules for rounds without a host vote.** Without a host vote the host-pick step has nothing to uncover (with `AUDIENCE_FIRST`, RESULT only says "Chat has spoken"). Options: a warning on the host panel before locking, an explicit "Louis sat this one out" moment, or merging both reveal steps when the host did not vote.
- **"And chat says…" is a placeholder.** The banner promises suspense while the numbers are already visible. The numbers should follow the banner (e.g. bars counting up).
- **Winner ring comes too early.** With `AUDIENCE_FIRST` it already appears in REVEAL, so the final step only adds the host's pick. Decide whether winner emphasis belongs to the last step.
- **Spotlight design.** The current CSS light cone is a first version and needs a nicer look.
- **Reveal-order switch** on the host panel, per game (see Decision 044).

Next: Motion follow-up / Phase 4 reveal presentation, or Phase 5 Twitch chat voting.
