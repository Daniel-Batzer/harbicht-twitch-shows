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
- Votes (Phase 3) need a round history beyond `playedQuestionIds`.

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
