# Harbicht Twitch Shows – Roadmap

## Purpose

This roadmap describes the planned development order for Harbicht Twitch Shows.

It is intentionally incremental. Each phase should result in a working system or a meaningful improvement to an already working system.

The roadmap is not immutable. Implementation may reveal better boundaries, dependencies, or priorities.

The guiding rule is:

> Build the smallest useful vertical slice, validate it, understand it, then expand it.

---

# Phase 0 – Project Foundation

## Goal

Create a stable development foundation before feature implementation begins.

## Scope

- Next.js project initialized
- TypeScript enabled
- App Router enabled
- React Compiler enabled
- ESLint enabled
- SCSS available
- Motion installed
- Zod installed
- clsx installed
- Git repository connected to private GitHub account
- initial project documentation written
- Claude Code project configuration created
- Context7 MCP configured
- Teacher skill created
- initial AI workflow documented

## Completion Criteria

Phase 0 is complete when:

- `npm run dev` works
- `npm run build` succeeds
- repository is pushed to GitHub
- `PROJECT_SPEC.md` exists
- `ARCHITECTURE.md` exists
- `ROADMAP.md` exists
- `DECISIONS.md` exists
- Claude Code has been initialized
- Claude can access the relevant project documentation
- Context7 is available
- Teacher skill is available

---

# Phase 1 – First Local Game Slice

## Goal

Create the smallest end-to-end playable structure without Twitch, persistence, or realtime networking.

## Scope

- static question fixtures
- one default deck
- random question selection
- host route
- overlay route
- basic local game session state
- start game action
- current question rendering
- three-option presentation
- initial SCSS structure
- initial Motion integration

## Example Flow

```text
Host opens /host
        ↓
Start Game
        ↓
Random question selected
        ↓
Overlay displays question
```

## Completion Criteria

- host can start a session
- one random question appears
- overlay can display the same conceptual question state
- visual structure is clearly designed for a gameshow
- game logic is not embedded directly into presentation components
- project still passes lint/build checks

## Explicitly Out of Scope

- Twitch
- database
- Channel Points
- real viewer votes
- full reveal animation
- web viewer login
- Docker
- deployment

---

# Phase 2 – Game Flow and State Transitions

## Goal

Turn the static question display into an actual round-based game flow.

## Scope

Candidate states:

```text
IDLE
PREPARE
INTRO
VOTING
LOCKED
REVEAL
RESULT
FINISHED
```

The exact names may change during implementation.

Host controls should allow progression through valid transitions.

## Completion Criteria

- state transitions are explicit
- invalid transitions cannot silently occur
- host can start and advance a round
- overlay reacts to game state
- multiple rounds can be played
- session can end cleanly
- game-state logic is testable outside the UI

---

# Phase 3 – Local Voting

## Goal

Validate voting behavior before Twitch is introduced.

## Scope

- participant identity
- vote model
- option validation
- one effective vote per participant per round
- latest valid vote replaces previous vote
- host vote
- vote aggregation
- vote count hidden during active voting
- local development controls for simulated viewers

## Completion Criteria

- simulated participants can vote
- vote replacement works
- invalid options are rejected
- host vote is included in totals
- individual votes remain available for later similarity calculation
- aggregated results can be derived
- voting rules have focused tests

---

# Phase 4 – Reveal and Gameshow Presentation

## Goal

Make the game visually entertaining enough to feel like a stream feature rather than a technical prototype.

## Scope

- polished question entrance
- animated answer cards
- voting-state feedback
- optional countdown
- lock transition
- reveal sequence
- animated result visualization
- winner/result emphasis
- host answer reveal
- visual transitions between rounds

Potential visual language:

- bold typography
- expressive card shapes
- arcade/game-show influence
- bright colors
- glow
- spring movement
- squash and stretch
- particles
- limited screen shake

## Completion Criteria

- transitions communicate game state clearly
- reveal feels intentional and dramatic
- overlay works on a transparent 1920×1080 canvas
- animations are driven by application state
- UI does not resemble a generic SaaS dashboard
- styling remains understandable and maintainable

---

# Phase 5 – Twitch Chat Voting

## Goal

Replace simulated viewer votes with real Twitch chat participation.

## Scope

- Twitch application setup
- Twitch OAuth setup
- minimum required permissions
- Twitch EventSub connection
- chat event handling
- vote command parsing
- Twitch user ID extraction
- adapter from Twitch event to domain vote input
- reconnect behavior suitable for development
- duplicate-event awareness

Initial command format:

```text
!vote 1
!vote 2
!vote 3
```

Alternative formats may be considered later.

## Completion Criteria

- real Twitch users can vote through chat
- Twitch display names are not used as canonical identity
- latest valid vote replaces previous vote
- raw Twitch payloads do not leak into game-domain logic
- reconnect behavior is understandable
- Twitch credentials remain outside version control

---

# Phase 6 – Timer and Host Control Improvements

## Goal

Support different stream pacing styles.

## Scope

Voting may be:

- host-controlled
- timer-controlled

Possible timer presets:

- 30 seconds
- 60 seconds
- 90 seconds
- custom duration
- no timer

## Completion Criteria

- host can configure voting duration
- no-timer mode works
- timer expiration locks voting
- countdown is synchronized with game state
- host can still manually control appropriate transitions

---

# Phase 7 – Persistence

## Goal

Persist data that now has proven value.

## Scope

Introduce:

- PostgreSQL
- Prisma
- local database setup
- likely Docker Compose for PostgreSQL
- migration workflow

Likely persisted concepts:

- Deck
- Question
- Session
- Round
- Vote
- Suggestion
- Twitch viewer reference

The final schema must be designed when this phase begins.

## Completion Criteria

- questions survive restart
- completed sessions can be stored
- individual votes can be persisted where required
- database schema reflects real implemented use cases
- domain model is not replaced by raw Prisma models
- migrations are committed
- local setup is documented

---

# Phase 8 – Question Deck Management

## Goal

Move beyond static fixtures.

## Scope

- stored decks
- stored questions
- random selection from a deck
- avoid repeats within a session
- basic question editor
- create/edit questions
- optional context/trigger field
- variable number of answer options internally
- UI optimized for three options

## Completion Criteria

- host can manage questions without editing source code
- session can draw random questions from a selected deck
- question structure supports both triggered and non-triggered questions

---

# Phase 9 – Channel Point Suggestions

## Goal

Allow the Twitch community to submit ideas using Channel Points.

## Scope

- custom Channel Point reward
- redemption events
- free-form viewer submission
- Suggestion entity
- moderation queue
- edit
- accept
- reject with refund
- reject without refund
- convert accepted suggestion into Question editor input

## Completion Criteria

- Channel Point redemption creates a pending suggestion
- suggestions never appear publicly without moderation
- host can convert useful suggestions into structured questions
- refund/no-refund behavior is explicit
- reward permissions and ownership behavior are documented

---

# Phase 10 – Similarity Scoring

## Goal

Turn a set of poll rounds into a coherent game result.

## Scope

- host vote used as reference
- viewer answers compared per round
- percentage similarity
- minimum participation rules if necessary
- session leaderboard
- final result screen

Example:

```text
1. ViewerOne   100%
2. ViewerTwo    80%
3. ViewerThree  80%
```

## Completion Criteria

- similarity is derived from individual stored votes
- missing rounds are handled intentionally
- host remains part of normal vote totals
- final session result can be presented in the overlay

---

# Phase 11 – Realtime Architecture

## Goal

Synchronize host dashboard and OBS overlay reliably once local state separation requires it.

## Scope

Select a realtime strategy based on actual requirements.

Candidates may include:

- Server-Sent Events
- WebSockets
- a focused realtime library

Do not choose before evaluating:

- reconnect behavior
- host/overlay synchronization
- Next.js runtime compatibility
- OBS browser compatibility
- deployment implications
- operational complexity

## Completion Criteria

- host and overlay share authoritative state
- overlay recovers after temporary disconnect
- page refresh does not unexpectedly destroy active state where persistence is expected
- chosen transport is documented in `DECISIONS.md`

---

# Phase 12 – Viewer Web Voting (V1.5)

## Goal

Allow viewers to vote privately through a browser.

## Scope

- Twitch authentication
- mobile-first viewer interface
- current question display
- private web voting
- latest vote wins across chat and web
- Twitch user ID remains canonical identity

## Completion Criteria

- authenticated viewer can vote privately
- chat vote and web vote resolve to same Twitch identity
- duplicate identities do not create duplicate effective votes
- mobile interface is usable during a stream
- private vote is not exposed to other viewers

---

# Phase 13 – Audience Influence

## Goal

Add optional Channel Point interactions that increase entertainment without directly buying votes.

Potential example:

```text
"Convince the Chat"
```

Viewer submits a short argument.

After moderation/validation it may appear temporarily in the overlay.

## Principles

- attention may be purchasable
- votes should not simply be purchasable
- viewer-generated content must be moderated
- interactions should enhance the show rather than overwhelm it

## Potential Future Effects

- argument banners
- emote bursts
- temporary visual effects
- sound stingers
- option promotion visuals

---

# Phase 14 – Twitch Emote Interaction

## Goal

Use chat reactions as part of the visual show.

Possible features:

- emotes flying across the overlay
- reaction bursts
- reveal reactions
- game-specific emote events

This phase should reuse Twitch event data already captured rather than redesigning the integration from scratch.

---

# Phase 15 – Deployment

## Goal

Run the application outside the development Mac.

Potential targets:

- Linux VPS
- Raspberry Pi / home server
- mini PC

Likely infrastructure:

```text
Docker Compose

├── web
├── optional twitch worker
└── postgres
```

Public access may be provided through:

- reverse proxy
- standard public networking
- outbound tunnel

## Completion Criteria

- production build runs reliably
- secrets are configured outside repository
- HTTPS is available
- domain is configured
- application restarts safely
- database persistence is protected
- deployment steps are documented

---

# Phase 16 – CI/CD

## Goal

Automate quality checks and later deployment.

Likely GitHub Actions flow:

```text
Push / Pull Request
        ↓
Install
        ↓
Lint
        ↓
Typecheck
        ↓
Tests
        ↓
Build
```

Later:

```text
main
 ↓
Build container
 ↓
Deploy
```

Deployment automation should not be introduced before the hosting target is selected.

---

# Phase 17 – Multi-Streamer Support

## Goal

Allow selected other streamers to use Harbicht Twitch Shows.

This is not a V1 requirement.

Potential future concerns:

- streamer account model
- Twitch connection per streamer
- permissions
- decks per streamer
- settings
- overlay URLs
- reward configuration
- data isolation

The initial architecture should not unnecessarily prevent this, but V1 must not implement speculative multi-tenancy.

---

# Phase 18 – Viewer Profiles and Progression

## Goal

Add persistent community progression once game mechanics justify it.

Potential systems:

- XP
- levels
- custom currency
- avatars
- cosmetics
- achievements
- participation statistics
- game history

These systems should be designed as real game systems when requirements exist, not as empty database tables in advance.

---

# Phase 19 – Additional Twitch Games

## Goal

Grow Harbicht Twitch Shows into a reusable stream entertainment platform.

Possible future formats:

- different voting games
- audience mini-games
- RPG mechanics
- avatar interactions
- emote games
- event-triggered challenges
- Stream Avatars integration

Shared abstractions should only be extracted after multiple real games prove that they are actually shared.

---

# Ongoing – AI Development Workflow

Throughout every phase:

1. Define or review the current requirement.
2. Update documentation when important product or architecture decisions change.
3. Ask Claude to plan before significant implementation.
4. Use Context7 for current external-library documentation when appropriate.
5. Implement a small coherent slice.
6. Run lint, typecheck/tests, and build as relevant.
7. Review the diff.
8. Use the Teacher skill to explain important generated code.
9. Record important architectural decisions.
10. Commit a meaningful working state.

The developer remains responsible for accepting architectural decisions and understanding important generated code.

---

# Current Position

Current status at roadmap creation:

```text
Phase 0 – Project Foundation
IN PROGRESS
```

Already completed:

- GitHub repository created
- private SSH identity configured
- Next.js initialized
- TypeScript configured
- App Router configured
- React Compiler enabled
- ESLint configured
- SCSS installed
- Motion installed
- Zod installed
- clsx installed
- development server verified
- production build verified
- initial commit pushed
- project specification started
- architecture documentation created

Next:

- finish documentation foundation
- create `DECISIONS.md`
- initialize Claude Code
- review generated `CLAUDE.md`
- configure Context7
- create Teacher skill
