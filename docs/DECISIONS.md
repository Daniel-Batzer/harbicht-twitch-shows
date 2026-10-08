# Harbicht Twitch Shows – Architecture Decision Log

## Purpose

This document records important product and technical decisions that should not be silently reversed by a coding agent.

It is intentionally lightweight.

Each decision should explain:

- what was decided
- why it was decided
- what alternatives were considered
- whether the decision may be revisited

This file is not a changelog.

---

# Decision 001 – Next.js as Initial Application Framework

## Status

Accepted

## Decision

Use Next.js with React, TypeScript, and App Router as the initial application framework.

## Reason

The project needs:

- host-facing web UI
- OBS browser-source UI
- future viewer web UI
- server-side endpoints
- future authentication
- future persistence integration

The developer already has significant React / Next.js experience.

Using a familiar full-stack framework reduces unnecessary learning overhead while the main learning goal is Claude Code and agentic development.

## Alternatives

- separate React frontend + Node backend
- Vite + Express/Fastify
- monorepo with separate applications

## Notes

A separate worker may be introduced later if Twitch's long-running connection requirements justify it.

---

# Decision 002 – Single Repository Before Monorepo

## Status

Accepted

## Decision

Start with a normal single Next.js repository.

Do not introduce `apps/` and `packages/` monorepo structure at project start.

## Reason

There is currently only one real application.

A monorepo would add tooling and structural complexity without solving an existing problem.

## Revisit When

Consider a monorepo when multiple independently built runtimes actually exist, for example:

- web application
- dedicated Twitch worker
- genuinely reusable domain package

---

# Decision 003 – SCSS Modules Instead of Tailwind CSS

## Status

Accepted

## Decision

Use SCSS Modules as the primary styling system.

Do not use Tailwind CSS.

Use Motion for state-driven and interactive animation.

## Reason

The project is expected to contain highly customized gameshow visuals:

- expressive cards
- pseudo-elements
- custom shapes
- glow effects
- bespoke responsive behavior
- animation-specific styling
- complex visual states

Large Tailwind utility chains and arbitrary values would make this kind of AI-generated styling harder to:

- read
- review
- explain
- refactor

SCSS Modules provide a clearer boundary between component structure and complex visual design.

## Responsibility Split

SCSS:

- layout
- component visuals
- responsive styling
- pseudo-elements
- custom keyframes
- decorative effects

Motion:

- enter/exit behavior
- springs
- state transitions
- orchestrated UI movement

React:

- application state
- game logic
- rendering decisions

## Revisit When

Only revisit if SCSS becomes a proven productivity or maintainability problem.

---

# Decision 004 – Motion as Initial Animation Library

## Status

Accepted

## Decision

Use Motion as the initial React animation library.

## Reason

The application requires:

- enter/exit animation
- state-driven animation
- spring motion
- layout transitions
- reveal sequences

Motion integrates naturally with React component state.

## Alternatives

Potential future specialized tools:

- GSAP
- Remotion
- custom Web Animations API

## Notes

Do not introduce additional animation frameworks until a concrete animation requirement cannot be handled cleanly with the existing approach.

Remotion remains potentially useful for rendered video or highly choreographed generated sequences, but is not the core live overlay framework.

---

# Decision 005 – Host Dashboard and OBS Overlay Are Separate Routes

## Status

Accepted

## Decision

Use dedicated routes for host controls and OBS presentation.

Initial routes:

```text
/host
/overlay
```

## Reason

The host UI and OBS output have different responsibilities.

The overlay should:

- contain no administrative controls
- support transparent background
- target stream presentation
- remain visually clean

The host page should:

- control the game
- display operational information
- moderate future suggestions

Combining both would tightly couple operational UI and stream presentation.

---

# Decision 006 – OBS Reference Canvas Is 1920×1080

## Status

Accepted

## Decision

Design the OBS overlay around a 1920×1080 reference canvas.

## Reason

Full HD is the intended stream design target.

The overlay should still scale sensibly when used in different OBS layouts.

---

# Decision 007 – Questions Support Optional Context

## Status

Accepted

## Decision

Do not force every question into a fixed "trigger + three answers" format.

A question may contain optional contextual or trigger text.

Conceptually:

```ts
type Question = {
  prompt: string;
  context?: string;
  options: QuestionOption[];
};
```

## Reason

Some questions are conditional:

> Whenever you die...

Other questions are self-contained:

> What would you rather permanently lose?

The model must support both naturally.

---

# Decision 008 – Options Are a Collection, Not Fixed A/B/C Fields

## Status

Accepted

## Decision

Represent answer options as a collection.

Do not model the domain as:

```text
optionA
optionB
optionC
```

## Reason

The initial game is visually optimized for three choices, but future games may use different numbers of options.

The domain should not encode an unnecessary three-option limitation.

## Notes

The initial UI can still intentionally optimize for exactly three cards.

---

# Decision 009 – Viewer Suggestions Are Not Questions

## Status

Accepted

## Decision

Treat a Twitch Channel Point submission as a `Suggestion`, not directly as a structured `Question`.

## Reason

Viewers should be able to submit natural-language ideas without understanding the application's internal question schema.

Example:

```text
Whenever you die: push-ups, spicy food, or no gaming for 30 minutes.
```

The host can later convert this into a structured question.

## Workflow

```text
Channel Point Redemption
        ↓
Suggestion
        ↓
Moderation
        ↓
Question Editor
        ↓
Question
```

---

# Decision 010 – Suggestions Require Moderation

## Status

Accepted

## Decision

Viewer-generated question suggestions are never automatically published or shown in the game.

Initial moderation outcomes:

```text
PENDING
ACCEPTED
REJECTED_REFUND
REJECTED_NO_REFUND
```

## Reason

This protects the stream from:

- spam
- abusive content
- malformed suggestions
- duplicate ideas
- unusable questions

Refund and no-refund rejection are intentionally distinct.

---

# Decision 011 – Twitch User ID Is Canonical Viewer Identity

## Status

Accepted

## Decision

Use Twitch user ID as the canonical identity for Twitch participants.

Do not use display name as identity.

## Reason

Display names can change.

A stable Twitch user ID allows later correlation between:

- chat votes
- web votes
- viewer profiles
- similarity
- Channel Point submissions
- statistics

---

# Decision 012 – One Effective Vote Per User Per Round

## Status

Accepted

## Decision

Each Twitch user may have one effective vote per round.

If the same user submits another valid vote, the latest valid vote replaces the previous one.

## Example

```text
Viewer votes A
Viewer later votes C

Effective vote = C
```

## Future Behavior

The same rule should apply across vote sources such as:

```text
CHAT
WEB
```

---

# Decision 013 – Host Vote Is a Normal Vote With Additional Meaning

## Status

Accepted

## Decision

The streamer participates as a normal voter.

The host's vote:

- contributes to normal totals
- is stored as belonging to the host
- may be revealed separately
- becomes the reference for similarity scoring

## Reason

The streamer should feel like part of the game rather than a mathematically separate category.

Avoid maintaining duplicate voting logic.

---

# Decision 014 – Individual Votes Are Stored

## Status

Accepted

## Decision

Do not store only aggregated counts.

Keep individual per-user votes available.

## Reason

Required for:

- vote replacement
- host identification
- similarity calculation
- future viewer history
- future statistics

Aggregated totals should be derived from individual votes.

---

# Decision 015 – Results Remain Hidden During Voting

## Status

Accepted

## Decision

Do not display vote totals or percentages while voting is active.

## Reason

This:

- reduces bandwagon behavior
- makes individual choices less influenced by current results
- creates a stronger reveal moment
- fits the desired gameshow experience

The overlay may still visually react to incoming votes without exposing totals.

---

# Decision 016 – Voting May Be Timed or Host-Controlled

## Status

Accepted

## Decision

Do not force every round to have a timer.

A round may use:

- fixed timer
- configurable timer
- no timer

In no-timer mode, the host manually closes voting.

## Reason

The streamer may want to discuss a question for an unpredictable amount of time.

Stream pacing should remain flexible.

---

# Decision 017 – Chat Voting Is Public, Web Voting May Be Private

## Status

Accepted

## Decision

Do not describe Twitch chat voting as anonymous or secret.

Chat messages are public when sent.

A future authenticated web-voting mode may provide genuinely private votes.

## Reason

Even if a chat message is deleted immediately, it may already have been visible to:

- viewers
- moderators
- chat overlays
- logging systems

---

# Decision 018 – Channel Points May Buy Attention, Not Additional Votes

## Status

Accepted as Future Direction

## Decision

Future Channel Point audience-influence mechanics should affect presentation or attention rather than directly increasing vote weight.

Example:

```text
"Convince the Chat"
```

A viewer may spend points to display a moderated argument temporarily on the overlay.

## Reason

Selling extra votes would undermine the meaning of the poll.

Social persuasion can create entertainment without directly manipulating the mathematical result.

---

# Decision 019 – Twitch Affiliate Features Are Available

## Status

Confirmed Constraint

## Decision

The project owner is a Twitch Affiliate.

Therefore Affiliate-supported Channel Point features can be considered for V1/V1.x.

## Notes

Exact Twitch API capabilities and scopes must still be checked against current Twitch documentation before implementation.

---

# Decision 020 – No Visible Chat Bot Required for V1

## Status

Accepted

## Decision

Do not require a separate bot identity merely because Twitch events are being consumed.

## Reason

V1 primarily needs to:

- receive Twitch events
- parse chat votes
- process Channel Point events

The application does not initially need to post chat messages.

A dedicated bot identity may be introduced later when real bot behavior exists.

---

# Decision 021 – Domain Logic Should Not Depend on Twitch

## Status

Accepted

## Decision

Raw Twitch events must be translated through an adapter before entering game-domain logic.

## Preferred Flow

```text
Raw Twitch Event
        ↓
Twitch Adapter
        ↓
Domain Input
        ↓
Game Logic
```

## Reason

This keeps the game testable and reusable.

It also allows future vote sources such as web voting without rewriting game rules.

---

# Decision 022 – Domain Logic Should Not Depend on Prisma

## Status

Accepted

## Decision

Prisma should eventually implement persistence, but Prisma-generated data structures should not automatically become the application's domain model.

## Reason

The game rules should remain understandable without requiring database implementation details.

This does not require an excessive enterprise repository architecture.

Use only as much abstraction as is needed to maintain the boundary.

---

# Decision 023 – PostgreSQL Is Preferred Persistence

## Status

Planned

## Decision

Use PostgreSQL when persistent storage is introduced.

Use Prisma as the preferred ORM unless new information changes this decision.

## Reason

The project expects relational entities such as:

- decks
- questions
- sessions
- rounds
- votes
- suggestions
- viewer references

PostgreSQL is suitable for both local/self-hosted and VPS deployment.

## Notes

Do not design the full database schema before persistence becomes an active development slice.

---

# Decision 024 – Docker Is Delayed Until It Solves a Real Problem

## Status

Accepted

## Decision

Do not introduce Docker during the initial static/local slice.

## Introduce When

Docker becomes useful when the project includes one or more of:

- PostgreSQL
- dedicated Twitch worker
- reproducible production deployment
- VPS deployment
- home-server deployment

## Reason

The current Next.js project already runs locally with:

```text
npm run dev
```

Adding Docker now would add complexity without meaningful benefit.

---

# Decision 025 – Deployment Provider Is Intentionally Undecided

## Status

Accepted

## Decision

Do not select a permanent hosting target during early development.

Potential targets include:

- Linux VPS
- Raspberry Pi
- home mini PC

## Reason

The application can be designed to remain deployment-independent.

A home server may later be made public using an outbound tunnel even without traditional router port forwarding.

A VPS remains a straightforward alternative.

## Constraint

Application logic must not assume a specific provider.

---

# Decision 026 – Realtime Transport Is TBD

## Status

Open

## Decision

Do not install or commit to a realtime library yet.

## Candidates

- Server-Sent Events
- WebSockets
- focused realtime library

## Evaluate When

The host dashboard and OBS overlay require real authoritative synchronization.

## Evaluation Criteria

- reconnect behavior
- simplicity
- Next.js compatibility
- OBS browser compatibility
- deployment environment
- operational complexity

---

# Decision 027 – No Global State Library Yet

## Status

Accepted

## Decision

Start with React state and server-driven state.

Do not install Zustand, Redux, XState, or similar state libraries merely in anticipation of future complexity.

## Revisit When

A concrete state-management problem appears that is awkward with the existing solution.

---

# Decision 028 – State Machine Concept Without Mandatory State-Machine Library

## Status

Accepted

## Decision

Model game flow explicitly as states and transitions.

Do not assume this requires XState.

## Reason

The game naturally behaves like a state machine, but a library should only be introduced if transition complexity justifies it.

---

# Decision 029 – Zod Is Used at Boundaries

## Status

Accepted

## Decision

Use Zod primarily when data crosses trust or system boundaries.

Examples:

- external API data
- Twitch payload transformation
- HTTP input
- configuration
- future forms

## Avoid

Do not wrap every internal function call in runtime validation.

---

# Decision 030 – No Premature Worker Process

## Status

Accepted

## Decision

Do not create a dedicated Twitch worker before the connection/lifecycle requirements justify one.

## Revisit When

A separate worker becomes useful because:

- Twitch requires reliable long-running process behavior
- Twitch event processing must survive independently of web requests
- deployment lifecycle separation becomes useful
- reliability requirements justify it

---

# Decision 031 – Questions Begin as Static Fixtures

## Status

Accepted

## Decision

Use static TypeScript question data for the earliest vertical slices.

## Reason

The first goal is validating:

- game flow
- architecture
- host controls
- overlay
- visual design

A database is not necessary to learn whether those pieces work.

Persist questions later when editing/storage becomes a real requirement.

---

# Decision 032 – Random Questions First, Manual Selection Later

## Status

Accepted

## Decision

Initial session creation may simply choose questions randomly from a deck.

Manual pre-stream question selection is deferred.

## Reason

Random selection is the smallest useful version.

Future enhancements may include:

- manual selection
- favorites
- tags
- categories
- recently-used filtering

---

# Decision 033 – Three Options Are a Game Rule, Not a Platform Rule

## Status

Accepted

## Decision

The first game's UX is designed around three choices.

The platform/domain should not assume that every future game must use exactly three options.

## Reason

The three-option limitation is part of the intended tension of this particular game.

It is not necessarily a universal requirement for all future Harbicht Twitch Shows.

---

# Decision 034 – AI Coding Should Be Controlled, Not Blind

## Status

Accepted

## Decision

Claude Code will perform substantial implementation work.

The human developer remains responsible for:

- requirements
- architecture
- major dependency decisions
- review
- acceptance
- understanding important generated code

## Workflow Principle

Do not ask Claude simply to "build the app."

Prefer:

```text
Requirement
   ↓
Plan
   ↓
Review
   ↓
Small implementation slice
   ↓
Tests/build
   ↓
Diff review
   ↓
Teacher explanation
   ↓
Commit
```

---

# Decision 035 – Context7 Will Be the Initial MCP

## Status

Accepted

## Decision

Use Context7 as the first MCP integration.

## Purpose

Use current documentation when implementing external-library or framework behavior that may have changed.

Examples:

- Next.js
- Motion
- Prisma
- authentication libraries
- Twitch-related libraries where supported

## Rule

Do not call Context7 unnecessarily for basic project-local logic.

---

# Decision 036 – Teacher Skill Is Introduced Early

## Status

Accepted

## Decision

Create a reusable Teacher skill near the beginning of the project.

## Developer Background

The developer already has professional React and TypeScript experience.

The Teacher should therefore avoid explaining trivial syntax unless requested.

## Teacher Focus

Explain:

- architecture
- data flow
- unfamiliar patterns
- important framework behavior
- external library behavior
- trade-offs
- unusual implementation choices
- technical debt
- code deserving human review

The Teacher should not merely paraphrase source code line by line.

---

# Decision 037 – AGENTS.md and CLAUDE.md Have Different Roles

## Status

Accepted

## Decision

Keep framework/agent guidance and project guidance conceptually separate.

`AGENTS.md`:

- generated or provided guidance for coding agents
- current Next.js-specific context

`CLAUDE.md`:

- project-specific working rules
- development workflow
- important project context
- links/pointers to project documentation
- instructions for Claude Code behavior

Detailed product and architecture documentation belongs in `docs/`, not duplicated completely into `CLAUDE.md`.

---

# Decision 038 – Progress Should Not Live in CLAUDE.md

## Status

Accepted

## Decision

Do not store frequently changing implementation progress directly in `CLAUDE.md`.

## Reason

`CLAUDE.md` should remain stable project guidance.

A separate file such as:

```text
docs/PROGRESS.md
```

or:

```text
docs/STATUS.md
```

may be introduced once progress tracking becomes useful.

---

# Decision 039 – Significant Dependencies Require Review

## Status

Accepted

## Decision

Claude must not silently introduce major architectural dependencies.

Before adding a major dependency, evaluate:

1. What current problem does it solve?
2. Why is the existing approach insufficient?
3. What complexity does it add?
4. What alternatives exist?
5. How reversible is the decision?

Examples:

- Prisma
- Docker
- XState
- Zustand
- Redis
- Socket.IO
- authentication frameworks
- monorepo tooling
- dedicated services

---

# Decision 040 – Prefer Explicit Code Over Clever Code

## Status

Accepted

## Decision

Favor code that is easy for both humans and coding agents to understand.

Prefer:

- explicit data flow
- descriptive names
- small modules
- clear state transitions
- focused abstractions
- documented unusual decisions

Avoid:

- unnecessary metaprogramming
- clever but opaque type gymnastics
- hidden mutable global state
- generic abstraction before repeated use cases exist
- magic behavior requiring large amounts of implicit context

---

# Decision 041 – Temporary In-Memory Game State and Overlay Polling

## Status

Accepted – **temporary**. To be replaced when realtime requirements justify a transport decision (Decision 026, Roadmap Phase 11).

## Decision

For the first local slices, the current game state lives in server memory, and the OBS overlay polls it.

- `src/features/game/services/game-store.ts` keeps the single current `GameState` on `globalThis`. That file is the only place that touches the global.
- The host changes state through Server Actions (`src/app/(dashboard)/host/actions.ts`).
- The overlay reads a plain JSON `GameSnapshot` from `GET /api/game/state` about once per second (`usePolledGameSnapshot`).

## Reason

- The OBS browser source runs in its own browser process. Browser-only sharing (`localStorage`, `BroadcastChannel`, React state) cannot reach it, so the state has to live on the server.
- Polling needs no new dependency and does not prejudge the transport choice in Decision 026.
- `globalThis` is used instead of a module-level variable because, in `next dev`, Route Handlers and Server Actions can be bundled as separate module instances, and HMR re-evaluates modules.

## Consequences

- State is lost when the server restarts. There is one game per server process, and it is not safe across multiple instances.
- Overlay updates arrive with roughly 1 second of latency. That is acceptable for showing a question, but not for live vote feedback.
- Pages that read this state must opt out of prerendering. `/host` does this with `await connection()`.

## Replacement Path

Only the transport changes: `usePolledGameSnapshot` and `/api/game/state`. The domain, the service, the `GameSnapshot` contract and the components stay as they are. Persistence (Phase 7) replaces `game-store.ts`.

---

# Decision 042 – Phase 2 Game Flow

## Status

Accepted

## Decision

The game flow is implemented as plain, pure transition functions in `src/features/game/domain/game-state.ts` (no state-machine library, Decision 028).

States:

```text
IDLE → INTRO → VOTING → LOCKED → REVEAL → RESULT ─┬→ INTRO (next round)
                                                  └→ FINISHED
END_GAME: any running state (including FINISHED) → IDLE
```

- **PREPARE is deferred.** It gets a real purpose once deck or round-count selection exists.
- **Host commands:** `START_GAME`, `OPEN_VOTING`, `LOCK_VOTING`, `REVEAL_RESULT`, `SHOW_RESULT`, `START_NEXT_ROUND`, `FINISH_GAME`, `END_GAME`. `getAvailableCommands(state)` is the readable transition table. A test checks that it agrees with the guards of the transition functions.
- **Invalid commands** return `INVALID_TRANSITION` (with command and current status) and leave the state unchanged.
- **One Server Action** receives the command as a form field and validates it with Zod (Decision 029). An unknown command is a boundary failure (`UNKNOWN_COMMAND`) and never reaches the domain.
- **Session length:** a session has `totalRounds` (positive integer, default 5, set by the service, not hard-coded in the domain). After the last round only Finish/End are possible. The host can finish early after any round's result.
- **No repeated questions within a session.** This is a minimal version pulled forward from Phase 8: the session tracks `playedQuestionIds`, and starting fails with `NOT_ENOUGH_QUESTIONS` if the deck is smaller than `totalRounds`.
- **REVEAL → RESULT is a manual host step for now.** It may become automatic with the reveal sequence (Phase 4).
- **Answers are hidden during INTRO** (ARCHITECTURE §22). Answer cards appear when voting opens.

## Reason

- The roadmap requires explicit transitions, multiple rounds, a clean end, and testable logic. Eight commands over seven states are easy to read as plain switch statements, so a library would add more than it saves.
- Without the no-repeat rule, a 5-round session over the 6-question fixture deck would repeat a question about 91% of the time.

## Revisit When

- PREPARE has real content (deck or round-count choice).
- Timers (Phase 6) or reveal choreography (Phase 4) add automatic transitions.
- Votes (Phase 3) need a round history beyond `playedQuestionIds`. (Phase 3 did not need one: votes carry their `roundId`, see Decision 043.)

---

# Decision 043 – Local Voting Model and Participant Identity

## Status

Accepted

## Decision

Phase 3 implements voting locally, with simulated viewers instead of Twitch chat. The model is shaped so that Twitch only changes who builds the vote input, not the rules or the stored data.

- **Vote** (`src/features/voting/domain/vote.ts`): `{ participantId, roundId, optionId, source, castAt }`. This is ARCHITECTURE §16 with `userId` named `participantId`.
- **Participant identity:** `ParticipantId` is an opaque string. The domain only compares it and never parses it. The application layer builds namespaced ids (`src/features/voting/participant-ids.ts`): `local:host`, `local:sim-<key>`, and in Phase 5 `twitch:<twitchUserId>`. Chat and web votes of one Twitch user therefore share one id (Decisions 011, 012).
- **Host identity comes from the participant id, not the source.** The session stores `hostParticipantId`, which the service supplies (`local:host` now, the broadcaster's Twitch id later). If the streamer also votes through chat later, that replaces their dashboard vote instead of adding a second one. The host's participant id never comes from client input.
- **Sources** are only added when they exist: `HOST` (host dashboard) and `SIMULATED` (dev controls). `CHAT` and `WEB` follow in Phases 5 and 12. Simulated votes are not tagged `CHAT`, so the data never claims a false origin.
- **Storage:** `session.votes` is one flat list of the session's effective votes across all rounds, keyed by `roundId`. It survives `START_NEXT_ROUND` and `FINISHED`, so it is available for similarity later. `END_GAME` discards it (no persistence yet). Each `(roundId, participantId)` pair has at most one entry, which is enforced when a vote is recorded.
- **Rules** (`castVote` in `src/features/game/domain/cast-vote.ts`): votes are accepted only in VOTING (`VOTING_NOT_OPEN` otherwise, including INTRO), and only for an option of the current question (`INVALID_OPTION`). A later valid vote replaces the earlier one, even for the same option. A rejected vote leaves the previous valid vote untouched. "Latest" means processing order, not a comparison of timestamps. `castAt` is passed in, and the domain never reads the clock. A vote is not a `GameCommand`: it never changes the status or the round.
- **Results** are derived on demand (`tallyVotes`) and never stored: one count per option in question order, every option with the highest count as winner (several on a tie, none without votes). The host vote counts like any other vote. Percentages are rounded per option in the snapshot, so their sum may be 99 or 101.
- **Visibility is enforced on the server.** The public `GameSnapshot` (`GET /api/game/state`) contains no vote data in INTRO, VOTING or LOCKED, not even the vote count. What REVEAL and RESULT uncover depends on the reveal order (Decision 044). Host-only data (vote count, own choice) lives in a separate `HostRoundView` (`src/features/game/host-view.ts`), which only the `/host` server component renders. During voting the host sees the count and their own vote, not the distribution, because they are a participant and are on stream.
- **Simulated viewers** (dev controls on `/host`): a named viewer, where voting again replaces the vote, and random batches drawn from a fixed pool of 30 viewers. They pass through exactly the same rules as any other vote. They are not gated by environment yet.

## Reason

- Twitch user ids become the real identity in Phase 5. Keeping the id opaque and namespaced means that change happens in one adapter, not in the voting rules, the stored shape, or the tests.
- Recognizing the host by source would break as soon as the host can vote through more than one channel.
- One flat vote list with `roundId` is the simplest shape that satisfies replacement, host identification, and later similarity, and it maps directly onto a future `Vote` table with a unique `(roundId, participantId)`.
- Hiding results in the snapshot mapping, not in the overlay components, means no client can read totals early, including clients that call the public API directly.

## Alternatives

- Raw Twitch ids without a namespace: no way to tell local ids from Twitch ids, and collisions become possible once more origins exist.
- A structured identity object (`{ kind, id }`): more ceremony for the same guarantee.
- Votes stored per round object: needs a round history before it is required, and is harder to query across rounds for similarity.
- Tagging simulated votes as `CHAT`: one fewer source, but the data would lie about where votes came from.

## Revisit When

- ~~Phase 5 (Twitch chat): add `CHAT` and the `twitch:` ids, map `!vote N` to an option id in the adapter, decide on event de-duplication and whether event timestamps should order votes, and remove or gate the simulated-viewer controls.~~ Done in Decision 046: `CHAT` and `twitch:` ids added, EventSub message ids are de-duplicated, processing order still decides "latest", and the simulated-viewer controls are development-only.
- Phase 4 (reveal): whether percentages should add up to exactly 100, and live vote feedback in the overlay.
- Phase 7 (persistence): `session.votes` becomes a table. `playedQuestionIds` and a per-round history can then be derived from stored rounds.

---

# Decision 044 – Configurable Reveal Order

## Status

Accepted

## Decision

The session has a reveal order. It decides what the existing REVEAL and RESULT phases uncover:

```ts
type RevealOrder = "AUDIENCE_FIRST" | "HOST_FIRST";
```

| | REVEAL | RESULT |
|---|---|---|
| `AUDIENCE_FIRST` | audience distribution | adds the host's choice |
| `HOST_FIRST` | host's choice | adds the audience distribution |

- **No new states.** The state machine stays `LOCKED → REVEAL → RESULT`, and there is no generic reveal-sequence system.
- The order is part of `GameSettings`, is stored in the session by `startGame`, and stays fixed for the session. The domain only stores it.
- The public snapshot projection (`toGameSnapshot`) interprets it. REVEAL carries either `result` or `host`, and RESULT carries both, plus `hostPickedWinner`: whether the host's choice is among the winners (also on a tie), or `null` if the host did not vote. Components never see data that is not uncovered yet.
- The host chooses the order per game on the `/host` start form (Slice 4). The service default `AUDIENCE_FIRST` is preselected. The Server Action validates the field with Zod and rejects a missing or unknown value (`INVALID_REVEAL_ORDER`) instead of silently falling back.
- The host dashboard shows the audience result at the same moment as the overlay, so the reveal is a surprise for the streamer too.
- **Host display name:** `HOST_DISPLAY_NAME` (server-side env variable, validated with Zod, falls back to `Host`). It is passed into the snapshot projection as presentation data and is not stored in the domain. Phase 5 replaces it with the broadcaster's Twitch display name.
- Overlay presentation: the phase that uncovers the host's choice shakes the banner ("Louis picked…"), then slams a sash with the host's name onto their card and puts a spotlight on it. The full choreography is Decision 045.

## Reason

Showing the full distribution in REVEAL and only adding a winner ring in RESULT left the second phase without a real moment. Two uncoverings make two reveal beats. Which beat should come first is a matter of stream taste, so the order is a setting rather than a rule.

## Alternatives

- Fixed order: simpler, but the streamer asked to switch between both.
- Extra states such as `HOST_REVEAL`: more transitions and commands for what is only a presentation choice.

## Revisit When

- PREPARE gets real content: the reveal-order choice could move there.

---

# Decision 045 – Reveal Choreography

## Status

Accepted

## Decision

REVEAL and RESULT are presented as timed beats with Motion. The beats are presentation only: the state machine, the snapshot contract and the voting rules are unchanged, and the host still moves REVEAL → RESULT by hand (Decision 042).

- **One pure module decides what happens when:** `getRoundPresentation(snapshot)` in `src/features/game/components/overlay/round-presentation.ts`. It returns the banner (a lead line, and a payoff that replaces it once the phase's last beat has landed) and, per answer card, when its bar fills, when the host's spotlight and sash land, when it is crowned, and how its focus changes. All times are seconds from the moment the overlay receives the phase and live in one named table, `REVEAL_TIMING`. The components only turn these values into Motion targets and delays; there is no generic timeline system.
- **Beats per reveal order:**

| | REVEAL | RESULT |
|---|---|---|
| `AUDIENCE_FIRST` | suspense ("And chat says…", empty bars with "?"), then bars fill and percentages count up in option order, payoff "The votes are in!" | "Louis picked…", spotlight, the other cards step back, sash lands; then the winners are crowned and the verdict follows |
| `HOST_FIRST` | "Louis picked…", spotlight, sash; payoff "Will chat agree?" | suspense, the stepped-back cards return, bars fill; then the winners are crowned and the verdict follows |

- **Winner emphasis is always the last beat of RESULT**, in both orders, and never part of REVEAL. It comes after everything new in RESULT has landed. Winners get a gold ring, a "Winner" tag and grow slightly; cards that neither won nor are the host's pick step back.
- **No host vote:** the overlay says "Louis sat this one out" instead of the host beat (no spotlight, no sash), and RESULT still crowns the winners, ending with "Chat has spoken!". `HOST_FIRST` REVEAL then hands over with "It's all up to chat!". While voting is open, `/host` warns the host that the host-pick reveal will be skipped without their vote. It does not block locking.
- **Nobody voted:** bars stay empty with "No votes", nobody is crowned, and the payoff is "No votes this round".
- **Ties:** every winner is crowned. The verdict keeps the `hostPickedWinner` rule: a host in the tie counts as agreement.
- **Robust against skipped phases:** a beat that an earlier phase already uncovered has time 0 in the next phase. Elements already on screen do not animate again, and elements that mount late (overlay reload, a phase skipped between two polls) appear right away. If the host clicks on before a phase's beats are done, the running Motion animations retarget and the new phase starts at 0. The polling hook no longer re-renders when a poll returns an unchanged snapshot.
- **SCSS ↔ Motion boundary:** Motion owns `transform`, `opacity` and `filter` of the animated overlay elements (answer cards, banner lines, spotlight, sash, crown, result bars). SCSS draws them, keeps the looping effects (voting pulse, drumroll, crown glow) on separate elements, and does not animate the same properties. The question card is still SCSS only.
- **Reduced motion:** the overlay is wrapped in `<MotionConfig reducedMotion="user">`, so Motion skips transform animations when the viewer asks for reduced motion and keeps fades. The standalone count-up checks `useReducedMotion()` and jumps to the number, and SCSS turns its loops off under `prefers-reduced-motion`.
- React Motion APIs are imported from `motion/react` only (the existing `motion` dependency).

## Reason

Playtesting showed that REVEAL and RESULT felt alike, that "And chat says…" promised suspense while the numbers were already visible, and that the winner ring arrived before the last step had anything left to show. Giving every phase a lead, its own beats and a payoff, and keeping the crowning for the end of RESULT, gives both phases a real moment in either order, including rounds without a host vote.

## Alternatives

- Extra states or an automatic REVEAL → RESULT transition: more transitions for what is presentation timing, and they would turn the beats into game timers (Phase 6).
- Crowning the winner at the end of REVEAL with `AUDIENCE_FIRST`: the leading option is obvious from the numbers anyway, but RESULT would then only add the host's pick again.
- Merging both reveal steps when the host did not vote: needs an automatic transition or a state change.
- Beat timers in React state (`setTimeout`): more moving parts than Motion delays, and harder to keep in sync with interrupted animations.

## Revisit When

- Live vote feedback during VOTING or a faster transport (Decision 041) makes the overlay react between polls.
- Sound (ARCHITECTURE §24) needs cues at the same beats; it should read the same `REVEAL_TIMING`.
- The question card and round-to-round transitions move to Motion as well.
- Percentages that do not add up to 100 look wrong next to the count-up (Decision 043).

---

# Decision 046 – Twitch Chat Voting

## Status

Accepted

## Decision

Phase 5 connects Twitch chat as the first real vote source. Chat votes enter the existing `castVote` rules unchanged. Requirements imposed by Twitch are marked **[Twitch]**. Everything else is our choice.

- **Transport and subscription:** EventSub over WebSocket (`wss://eventsub.wss.twitch.tv/ws`), subscription `channel.chat.message` version 1 with condition `broadcaster_user_id = user_id = <broadcaster>`. **[Twitch]** WebSocket subscriptions require a user access token. Reading chat needs only `user:read:chat` from the reading user. `user:bot`/`channel:bot` are only required with app access tokens. Webhooks would need a public HTTPS endpoint and an app token, so they are not used. IRC is not used either.
- **No bot account (Decision 020 holds):** the broadcaster reads their own chat with their own token. **[Twitch]** Twitch documents this for "installed chatbots": a single user access token from the broadcaster is enough.
- **Authentication:** server-side Authorization Code Grant, started from `/host` (`/api/twitch/auth/start` → Twitch consent → `/api/twitch/auth/callback`). The only scope is `user:read:chat`. CSRF protection is a random `state` in a short-lived httpOnly, SameSite=Lax cookie limited to `/api/twitch/auth`. Credentials come from `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` and `TWITCH_REDIRECT_URI`, which must match the registered redirect URL exactly. If the console offers a Confidential/Public choice, Confidential is used.
- **Tokens stay in memory only** (`src/features/twitch/twitch-connection-store.ts`, on `globalThis` like the game store, Decision 041). They are never written to files or logged. After a server restart the host clicks "Connect Twitch" again. **[Twitch]** Tokens are validated when the OAuth session starts and hourly afterwards, and refreshed reactively on HTTP 401. A rotated refresh token is kept. The token lifetime is not assumed: `expires_in` is kept as metadata only.
- **Connection lifecycle** (`twitch-connection.ts`, `eventsub-client.ts`): open the socket, then **[Twitch]** subscribe within 10 seconds of the welcome message. A keepalive watchdog (keepalive timeout plus 5 s) detects silent connections. **[Twitch]** On `session_reconnect` the client opens the given URL, waits for its welcome and closes the old socket. Subscriptions move along. A lost connection reconnects with backoff (1, 2, 5, 10, then 30 s) and subscribes again, because **[Twitch]** subscriptions are disabled when their socket closes. Chat sent during the gap is lost. A revocation or an unrecoverable token ends the connection, and the host has to connect again. A generation counter drops results of async work that belongs to an older connection. Starting a connection always closes the previous one, so HMR or a double click never leaves two connections running.
- **Runtime:** the socket lives in the Next.js server process (`next dev` / `next start`), not in a worker (Decision 030 stays). It uses Node's built-in `WebSocket`, `fetch` and Zod, and adds no dependency (no Twitch SDK). It does not work on serverless hosting.
- **Adapter boundary:** all Twitch-specific code is in `src/features/twitch/`. The pipeline is: WebSocket frame → `JSON.parse` → Zod envelope → **de-duplication by `metadata.message_id`** → Zod payload per message type (`readEventSubFrame`) → Zod `channel.chat.message` event → `toChatVote`. `toChatVote` checks the channel and the Shared Chat mode, parses `!vote N` and turns `chatter_user_id` into `twitch:<id>`. The result is a platform-neutral `ChatVote { participantId, optionNumber }` (`src/features/game/chat-vote-input.ts`). The application layer never sees a Twitch user id. `toChatVoteInput` maps the 1-based number to the option at that position (`findOptionIdByNumber`, the same number as the overlay badge), tags the vote `CHAT`, and then `castVote` decides as before. No field of an external payload is read before it has been validated.
- **De-duplication:** **[Twitch]** delivery is at least once, and a resend keeps its message id. A bounded set of the last 1000 message ids prevents a late duplicate of `!vote 1` from overwriting the same viewer's newer `!vote 2`, also during the `session_reconnect` overlap. A frame with an invalid envelope is never remembered. A frame with a valid envelope is remembered even if its payload is invalid. Message timestamps do not order votes: processing order still decides "latest" (Decision 043).
- **Command syntax:** `!vote N`, case-insensitive, exactly one number of one or two digits, at least 1, nothing after it. Invisible characters that chat clients append (zero-width characters, U+E0000) are stripped first. A malformed `!vote` counts as a rejected attempt. Ordinary chat is ignored. A rejected vote never touches the viewer's earlier valid vote.
- **Identity:** viewers are `twitch:<userId>` (Decision 011). With Twitch connected, a new game's `hostParticipantId` is `twitch:<broadcasterId>`. The broadcaster's chat votes are always recorded under `session.hostParticipantId`. A dashboard vote and a chat vote of the host therefore replace each other, even if the game started before Twitch was connected (`local:host`). The vote source stays `CHAT`.
- **Shared Chat:** a per-session setting `SharedChatVotingMode` (`OWN_CHANNEL_ONLY`, the default, or `INCLUDE_SHARED_CHAT`), chosen on the start form like the reveal order. The game domain stores it and never interprets it. Only the Twitch adapter reads `source_broadcaster_user_id`. Votes carry no channel data. A viewer seen through several channels still has one participant id and one vote.
- **Host dashboard:** a Twitch panel shows not configured / offline / connecting / live / reconnecting, the connected login, counted and rejected chat votes, the time since the last chat message, the last error in plain words, and Connect/Disconnect. Disconnect closes the connection and forgets the tokens. A failed connect attempt never disconnects a running connection. `/host` refreshes itself every 2 s (`HostAutoRefresh`, `router.refresh`), because chat votes change its data without a host action. The overlay polling is unchanged.
- **Overlay:** while voting is open, a hint shows `!vote 1 · !vote 2 · !vote 3` (one per option, colored like the cards). Chat votes are public and are not presented as secret (Decision 017).
- **Simulated viewers** are development-only (`NODE_ENV === "development"`). The panel is hidden otherwise, and the Server Actions reject with `SIMULATION_DISABLED`.
- **Overlay host name:** `HOST_DISPLAY_NAME` stays. The streamer's personal name may differ from the channel name.

## Reason

- The roadmap asks for real chat votes without changing the voting rules or leaking Twitch payloads into the domain. Decision 043 prepared this: only the vote source and the participant id builder change.
- WebSocket and a broadcaster user token are the smallest setup Twitch allows for a locally running app. A webhook would need public HTTPS, an app token and extra scopes.
- In-memory tokens and a one-click connect avoid storing long-lived credentials in files until persistence exists (Phase 7).

## Alternatives

- Tokens in the local environment file (generated with the Twitch CLI): automatic connect on start, but long-lived secrets in a file.
- A Twitch SDK (e.g. Twurple): handles reconnect and refresh, but it is a large dependency for one subscription.
- A dedicated worker process: a cleaner lifecycle, but not needed while everything runs locally.
- A Twitch-specific vote model or a Twitch user id in the application layer: rejected, because it would duplicate the rules and break the opaque-participant boundary.
- Loose syntax (`!vote 2 lol`, `!2`, `A/B/C`): can be added later. Tightening the syntax later would break viewer habits.

## Revisit When

- Deployment (Phase 15): serverless hosting, an unauthenticated `/host`, and a worker for the connection lifecycle.
- Persistence (Phase 7): whether tokens should survive restarts.
- Timers (Phase 6): a grace period for chat votes typed just before locking.
- A realtime transport (Phase 11) replaces the host auto-refresh and the overlay polling.
- The first long playtest shows whether a subscription survives the access token's expiry (the hourly validation and refresh keep a valid token ready either way).

---

# Open Decisions

The following are intentionally unresolved:

- realtime transport
- authentication library
- dedicated Twitch worker timing
- sound library / sound handling implementation
- exact PostgreSQL schema
- exact Prisma version when persistence begins
- hosting provider
- home server vs VPS
- production reverse proxy / tunnel
- viewer web architecture
- future avatar/progression architecture
- Stream Avatars integration
- exact multi-streamer model

These should remain open until their requirements are concrete.
