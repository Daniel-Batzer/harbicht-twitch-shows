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

- ~~The reveal order can only be changed in code.~~ Resolved in Slice 4: per-game choice on the host start form.
- Overlay texts are English only. Bilingual texts with a language choice for the host are a later juicing pass.
- ~~`/host` only updates after its own actions. Votes from other sources will need host polling (Phase 5).~~ Resolved in Slice 5: `/host` refreshes itself every 2 s.
- The overlay gives no live feedback for incoming votes yet (deferred in Slice 4, needs a faster transport).
- ~~The simulated-viewer controls are available in every environment (Decision 043, revisit in Phase 5).~~ Resolved in Slice 5: development only.
- Percentages are rounded per option, so their sum may be 99 or 101.

Pending:

- **Motion integration** (still open from Slices 1 and 2).
- Manual OBS check (see Slice 1).

Open points from playtesting (all addressed in Slice 4, see there and Decision 045):

- **Rules for rounds without a host vote.** Without a host vote the host-pick step has nothing to uncover (with `AUDIENCE_FIRST`, RESULT only says "Chat has spoken"). Options: a warning on the host panel before locking, an explicit "Louis sat this one out" moment, or merging both reveal steps when the host did not vote.
- **"And chat says…" is a placeholder.** The banner promises suspense while the numbers are already visible. The numbers should follow the banner (e.g. bars counting up).
- **Winner ring comes too early.** With `AUDIENCE_FIRST` it already appears in REVEAL, so the final step only adds the host's pick. Decide whether winner emphasis belongs to the last step.
- **Spotlight design.** The current CSS light cone is a first version and needs a nicer look.
- **Reveal-order switch** on the host panel, per game (see Decision 044).

## Phase 4 / Slice 4 – Reveal Presentation and Motion

Status: **implemented, manual playtest and OBS check pending**

Done:

- Reveal choreography (Decision 045). `getRoundPresentation` (`src/features/game/components/overlay/round-presentation.ts`) derives from the snapshot when each beat happens: banner lead and payoff, bar fill and count-up per card, spotlight and sash on the host's pick, winner crowning, and each card's focus (normal, locked, stepped back). All times live in `REVEAL_TIMING`. It replaces `phase-banner.ts`.
- REVEAL and RESULT now differ in both reveal orders: suspense first, then the numbers. The winner is crowned only as the last beat of RESULT, followed by the verdict. Rounds without a host vote ("Louis sat this one out"), ties and rounds without votes have defined paths.
- First Motion code (`motion/react`): answer cards (staggered spring entrance, focus filter, crown, winner growth, impact when the sash lands), banner (lead pops in, payoff slams over it, one-off shake), spotlight (beam and floor light, redesigned), sash slam and wobble, `ResultMeter` (bar `scaleX` and a count-up driven by Motion values). The matching SCSS keyframes are gone; SCSS keeps the looping pulse, drumroll and crown glow on separate elements.
- Reduced motion: `MotionConfig reducedMotion="user"` around the overlay, the count-up jumps when reduced motion is requested, and the SCSS loops stop under `prefers-reduced-motion`.
- `/host`: reveal order chosen per game on the start form (preselected `AUDIENCE_FIRST`, Zod-validated, `INVALID_REVEAL_ORDER` on bad input). The current order is shown in every round phase (`HostRoundView.revealOrder`). While voting is open the host is warned if they have not voted.
- The overlay's polling hook ignores unchanged snapshots, so a poll alone never re-renders the stage.
- Tests: `round-presentation.test.ts` covers both orders × {host won, host lost, host in a tie, no host vote, no votes}. It checks that REVEAL never crowns, that the crowning comes after everything new in RESULT, that only uncovered data is shown, focus timelines, and the banner texts.

Known limitations:

- An overlay reload replays the current phase's beats. A skipped phase (two host clicks within one poll) shows the later phase's beats only.
- If the host clicks on before a phase's beats are done, the beats are cut short (nothing breaks, Motion retargets).
- The question card, round-to-round transitions and the game-over card are still SCSS only.
- Percentages are still rounded per option (sum may be 99 or 101).
- Timings in `REVEAL_TIMING` are first values and need tuning in a real playtest.

Pending:

- Manual playtest: both orders × {host won, host lost, tie, no host vote, no votes}, a fast click during the REVEAL beats, an overlay reload during RESULT, the reveal-order choice.
- Manual OBS check (see Slice 1).

## Phase 5 / Slice 5 – Twitch Chat Voting

Status: **implemented, manual test on the real channel pending**

Done (Decision 046):

- EventSub over WebSocket with a `channel.chat.message` subscription. The broadcaster's own user token reads their own chat, so there is no bot account. The only scope is `user:read:chat`. No new dependency: Node's built-in `WebSocket`, `fetch` and Zod.
- OAuth Authorization Code Grant from `/host` (`/api/twitch/auth/start` → Twitch → `/api/twitch/auth/callback`) with a CSRF state cookie. Tokens live in server memory only and are validated at start and hourly, and refreshed on 401. `expires_in` is metadata only.
- Connection lifecycle: subscribe after the welcome, keepalive watchdog, `session_reconnect` migration, reconnect with backoff (1/2/5/10/30 s) after a lost connection, revocation → disconnected, Disconnect forgets the tokens. A generation counter drops stale async results, and a new connection always replaces the old one.
- Strict validation order for external input: JSON → Zod envelope → de-duplication by EventSub `message_id` (last 1000) → Zod payload → Zod chat event.
- `!vote N` parser (case-insensitive, one number, nothing after it, invisible chat-client characters stripped). The Twitch adapter turns the chatter into `twitch:<userId>` and hands a platform-neutral `ChatVote { participantId, optionNumber }` to the application layer. `toChatVoteInput` maps the number to the option at that position (same as the overlay badge), tags it `CHAT`, and `castVote` decides as before.
- Host identity: a game started while Twitch is connected uses `twitch:<broadcasterId>` as the host id. The broadcaster's chat votes always map to `session.hostParticipantId`, so dashboard and chat votes of the host replace each other, even if Twitch was connected after the game started.
- Shared Chat: per-game setting on the start form (`OWN_CHANNEL_ONLY` by default, or `INCLUDE_SHARED_CHAT`), stored in the session and interpreted only by the Twitch adapter.
- `/host`: Twitch panel (not configured / offline / connecting / live / reconnecting, connected login, counted and rejected chat votes, last chat message, errors, Connect/Disconnect) and a 2 s auto-refresh. Simulated viewers are development-only.
- `/overlay`: "Vote in chat · !vote 1 · !vote 2 · !vote 3" hint while voting is open. Polling is unchanged.
- Tests: parser, frame reader (order, duplicates, invalid envelope vs. invalid payload, reconnect URL), chat event schema, adapter incl. the Shared Chat matrix, `toChatVoteInput`, chat votes through `castVote` (host dashboard + chat = one vote, invalid keeps valid, replacement, rejected after lock), `findOptionIdByNumber`.
- Checked against Twitch: a real `session_welcome` frame matches the schema. Twitch closes an unused session after ~15 s (code 4003), so subscribing right after the welcome is required.

Known limitations:

- Chat sent during a reconnect gap is lost. Votes typed just before Lock that arrive after it are rejected (a grace period belongs to the timer, Phase 6).
- Tokens are lost on server restart; the host clicks Connect again.
- `/host` has no authentication. Anyone who can reach the dev server can connect or disconnect Twitch (must be solved before deployment).
- The connection runs inside the Next.js server process and does not work on serverless hosting.
- In `next dev`, a running connection keeps executing the module code it started with until it reconnects (state is on `globalThis`, so this is harmless; Disconnect/Connect picks up new code).
- Not verified yet: whether a subscription survives the access token's expiry during a long stream.
- The Twitch CLI mock server does not support `channel.chat.message`, so network code is tested manually.

Pending:

- Manual test on the own channel (stream can be offline): Connect, `!vote` from a second account, host dashboard vote + own `!vote` = one host vote, invalid and late votes, Wi-Fi off → reconnect, Disconnect, `next build && next start` hides the simulated viewers.
- Manual OBS check (see Slice 1).

## Phase 6 / Slice 6 – Voting Timer and Round Controls

Status: **implemented, manual playtest and OBS check pending**

Done (Decision 047):

- Per-game voting timer on the `/host` start form: no timer (preselected), 30 / 60 / 90 s, or custom 10–600 s. Zod-validated at the boundary (`voting-duration-input.ts`), `INVALID_VOTING_DURATION` otherwise.
- Domain `voting-timer.ts`: absolute deadlines (`startedAtMs`, `endsAtMs`, `closesAtMs = endsAtMs + 3 s grace`) in server time, `settleVotingDeadline` for the one automatic transition VOTING → LOCKED, `votingClosedBy: HOST | TIMER` on the round. No new state, no server timer.
- `castVote` takes a `VoteReceipt { receivedAtMs, castAt }` from one reading of the server clock. A vote counts only if `receivedAtMs < closesAtMs` (`VOTING_DEADLINE_PASSED` otherwise). Manual lock stays immediate.
- `STOP_VOTING_TIMER`: the host can turn a timed round into a manual one, but only before the countdown ends (`VOTING_TIMER_EXPIRED` from then on, also enforced in `getAvailableCommands(state, nowMs)`).
- Service: every read and write settles the deadline first (`readCurrentGameState`). `closesAtMs` is the logical deadline. The stored VOTING → LOCKED transition is materialized on the next service access, so no page has to be polling. Any vote received at or after `closesAtMs` is rejected, because settlement runs before vote processing. Chat, host and simulated votes all go through it. The Twitch adapter is unchanged.
- Snapshot: `votingTimer` (without the grace period) in VOTING, `votingClosedBy` in LOCKED. Static per round, so the overlay's poll deduplication still holds.
- `/overlay`: countdown badge with a draining ring, urgent pulse for the last 10 s, "Time!" at zero, and a "Time's up!" banner once the timer has locked. Reloads resume the countdown from `endsAtMs`.
- `/host`: countdown with bar, "Lock voting now", "Stop timer" (hidden at zero), "Locked by the timer / by you", the timer setting in the round info, and a clear message when a Lock click comes after the timer.
- Tests: timer arithmetic and the exact lock boundary, settlement (same object before, LOCKED at `closesAtMs`, idempotent, no timer, other states), Stop timer before/at/after `endsAtMs` with no mutation on rejection, `getAvailableCommands` consistency at four points in time, votes in and after the grace period (incl. chat votes and "receive time, not castAt"), snapshot visibility, form parsing, countdown display, LOCKED banner and a check that a timed VOTING round presents exactly like an untimed one.

Known limitations:

- The overlay shows LOCKED up to ~1 s after `closesAtMs` (polling). Between "Time!" and the dimmed cards are about 3–4 s: votes still count during that time.
- 3 s of grace covers Twitch low-latency streams. With normal latency, viewers who vote at their own "1 s left" may still be too late.
- Browser clocks are assumed to be NTP-synced with the server (no offset correction). Skew only shifts the countdown display.
- Timer setting is per game only; no per-round override, extend or pause.

Pending:

- Manual playtest: no timer; 30 s timer to expiry (host + overlay in sync, "Time!", lock with "Time's up!"); a vote in the grace period and one after it (simulated and `!vote`); early lock; Stop timer, then a long wait without auto-lock; overlay reload during the countdown and after expiry; host tab in the background; Lock click just after the auto-lock; custom 9 / 601 rejected.
- Manual OBS check (see Slice 1).

Next: Motion follow-up for the question card and round transitions, or Phase 7 persistence.
