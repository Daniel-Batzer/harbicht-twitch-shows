# Harbicht Twitch Shows – Architecture

## 1. Purpose

This document describes the intended technical architecture of **Harbicht Twitch Shows**.

It defines:

- major system boundaries
- responsibilities
- data flow
- folder organization
- architectural constraints
- known future extension points

It does not attempt to define every implementation detail in advance.

When a technology decision has not yet been made, it should remain explicitly marked as **TBD** rather than being guessed.

---

## 2. Architectural Goals

The architecture should optimize for:

- understandability
- maintainability
- easy review of AI-generated code
- clear separation of game logic and UI
- testable domain logic
- incremental development
- Twitch integration without coupling the whole application to Twitch
- future OBS and web clients
- future persistence
- future deployment through Docker
- reuse across additional Twitch games where useful

The architecture should avoid:

- premature microservices
- unnecessary abstraction
- speculative plugin systems
- framework-specific logic leaking into domain code
- deeply coupled Twitch and game logic
- large global state objects without clear ownership
- infrastructure introduced only because it may be useful someday

---

## 3. Current Runtime Architecture

During the first development stage, the application runs locally.

Initial runtime:

```text
Browser – Host Dashboard
        │
        ▼
     Next.js
        │
        ├── Game logic
        ├── Question selection
        ├── Local voting state
        └── API / server logic
        │
        ▼
Browser – OBS Overlay
```

Initially, both the host dashboard and OBS overlay are part of the same Next.js application.

This avoids introducing unnecessary separate applications before they provide real value.

---

## 4. Expected Later Runtime Architecture

When Twitch integration becomes active, the architecture will likely evolve toward:

```text
                     TWITCH
                        │
                        │ EventSub / Chat events
                        ▼
                Twitch Integration
                        │
                        ▼
                   Game Domain
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
     Host Dashboard              OBS Overlay
          │                           │
          └─────────────┬─────────────┘
                        │
                        ▼
                   Persistence
                    PostgreSQL
```

The exact process boundaries are intentionally undecided.

The Twitch integration may initially run within the main Node runtime and later be moved into a dedicated worker if long-lived connections or deployment needs make this appropriate.

---

## 5. Application Boundaries

The application should conceptually contain the following areas:

```text
Presentation
│
├── Host Dashboard
├── OBS Overlay
└── Future Viewer Web UI

Application
│
├── Commands
├── Game orchestration
└── Session coordination

Domain
│
├── Game Session
├── Round
├── Question
├── Vote
├── Voting rules
└── Similarity calculation

Infrastructure
│
├── Twitch
├── Database
├── Realtime transport
└── External APIs
```

These are architectural boundaries, not necessarily separate packages.

---

## 6. Dependency Direction

Domain logic should not depend on:

- Next.js
- React
- Twitch APIs
- Prisma
- OBS
- browser APIs

Preferred dependency direction:

```text
UI
 ↓
Application
 ↓
Domain
 ↑
Infrastructure adapters
```

For example:

Bad:

```ts
function registerVote(twitchMessage: TwitchEventSubMessage) {
  // game rules here
}
```

Preferred:

```ts
function registerVote(vote: VoteInput) {
  // game rules
}
```

The Twitch adapter converts Twitch-specific data into a domain-level `VoteInput`.

---

## 7. Initial Source Structure

Recommended starting structure:

```text
src/
├── app/
│   ├── page.tsx
│   ├── host/
│   │   └── page.tsx
│   ├── overlay/
│   │   └── page.tsx
│   └── api/
│
├── features/
│   ├── game/
│   ├── questions/
│   ├── voting/
│   └── suggestions/
│
├── components/
├── lib/
├── styles/
└── types/
```

This structure should evolve based on actual requirements.

Do not create empty folders merely to match the theoretical architecture.

---

## 8. Feature Organization

Feature-specific code should preferably live close together.

Example:

```text
features/
└── game/
    ├── components/
    ├── domain/
    ├── hooks/
    ├── services/
    ├── game.types.ts
    └── game.constants.ts
```

Not every feature requires every folder.

Folders should only be introduced when they contain meaningful code.

---

## 9. Shared Components

`src/components/` should contain genuinely reusable presentation components.

Examples may include:

- Button
- Modal
- Countdown
- AnimatedText
- GameShowCard

Feature-specific components should remain inside their feature.

Avoid moving components into shared folders prematurely.

---

## 10. Game Domain

The core game domain should be independent of the rendering layer.

Expected concepts include:

```text
GameSession
Round
Question
QuestionOption
Vote
Participant
```

Possible relationship:

```text
GameSession
│
├── status
├── currentRound
└── rounds[]
       │
       └── Round
            ├── question
            ├── votes
            ├── state
            └── timing information
```

---

## 11. Game State Machine

The game behaves naturally as a state machine.

Initial candidate states:

```text
IDLE
 ↓
PREPARE
 ↓
INTRO
 ↓
VOTING
 ↓
LOCKED
 ↓
REVEAL
 ↓
RESULT
 ↓
NEXT_ROUND / FINISHED
```

This does not imply that an external state-machine library must be used.

The state model should first be implemented with the simplest clear approach.

A library such as XState should only be introduced if the complexity of the actual transitions justifies it.

---

## 12. State Transition Rules

Transitions should be explicit.

Example:

```text
INTRO
→ VOTING

VOTING
→ LOCKED

LOCKED
→ REVEAL

REVEAL
→ RESULT

RESULT
→ INTRO
or
RESULT
→ FINISHED
```

Invalid transitions should not silently mutate the game.

The application should eventually protect important transitions through domain or application-level rules.

---

## 13. Questions

A Question is structured application data.

Initial conceptual shape:

```ts
type Question = {
  id: string;
  prompt: string;
  context?: string;
  options: QuestionOption[];
};
```

The final implementation may differ.

`context` allows questions such as:

```text
Whenever you die in a game...
```

without forcing every question to contain a trigger.

Options should not be modeled as fixed properties such as:

```text
optionA
optionB
optionC
```

because future games may require a different number of choices.

Instead, use a collection.

The first game's presentation remains optimized for three choices.

---

## 14. Decks

Questions belong to one or more logical collections called Decks.

Initial concept:

```text
Deck
├── id
├── name
└── questions
```

For the earliest local vertical slice, questions may temporarily exist as static TypeScript fixtures.

Persistence should be introduced when it becomes necessary.

This allows the game flow and visuals to be developed before database work.

---

## 15. Random Question Selection

V1 may select random questions from a chosen deck.

The selection mechanism should be isolated from UI rendering.

Example responsibility:

```text
QuestionSelector
→ receives available questions
→ receives session history
→ returns next question
```

Later this allows avoiding repeated questions or supporting manual selection.

---

## 16. Voting Domain

A vote conceptually contains:

```text
Vote
├── userId
├── roundId
├── optionId
├── source
└── timestamp
```

Possible sources:

```text
HOST
CHAT
WEB
```

The exact representation may change.

The same Twitch user should have at most one effective vote per round.

New valid votes replace older votes from the same user.

---

## 17. Host Vote

The host is also a participant.

Do not maintain a separate mathematical vote system for the host.

Instead, the host vote:

- contributes normally to totals
- is associated with the host identity
- may be displayed separately during reveal
- serves as a reference for similarity scoring

This avoids duplicating voting logic.

---

## 18. Vote Aggregation

The system should store individual votes.

Do not only store:

```text
A = 5
B = 10
C = 8
```

Instead individual votes should be available:

```text
user1 → A
user2 → B
user3 → B
...
```

Aggregated results are derived from those votes.

This is necessary for:

- vote changes
- similarity calculation
- viewer history
- future statistics

---

## 19. Similarity

Similarity is derived from historical round votes.

The first implementation can use a simple percentage:

```text
matching host answers
---------------------
rounds both participated in
```

Example:

```text
4 matching answers / 5 rounds
= 80%
```

More advanced scoring should not be introduced without a real requirement.

---

## 20. Host Dashboard

Route:

```text
/host
```

The host dashboard owns streamer-facing control.

Responsibilities may include:

- creating a session
- starting a session
- moving game state forward
- showing current state
- voting as host
- showing incoming vote count
- handling suggestions
- revealing results
- ending sessions

The host dashboard should not contain OBS-specific rendering logic.

---

## 21. OBS Overlay

Route:

```text
/overlay
```

The OBS route is presentation-only.

It should not expose administrative controls.

It should render the current game state using a transparent background.

Reference canvas:

```text
1920 × 1080
```

The overlay should remain useful when resized to other common stream layouts.

---

## 22. Overlay Rendering

The overlay reacts to game state.

Example:

```text
INTRO
→ animate question into view

VOTING
→ show answers + optional countdown

LOCKED
→ stop vote feedback

REVEAL
→ animate result visualization

RESULT
→ highlight outcome / host answer
```

Animations should follow domain state rather than creating independent hidden business logic inside animation components.

---

## 23. Styling

Primary styling approach:

```text
SCSS Modules
+
Motion
```

SCSS Modules handle:

- styling
- layout
- responsive behavior
- pseudo-elements
- visual effects
- custom keyframes

Motion handles:

- enter / exit
- springs
- state-driven motion
- animation sequences
- layout transitions

Avoid putting significant game logic inside animation definitions.

Tailwind CSS is intentionally not used for this project.

Reason:

The application is expected to use highly customized gameshow visuals and complex animations. Long utility-class chains and frequent arbitrary values would make AI-generated visual code harder to review and explain.

---

## 24. Sound

Sound effects are planned but not required in the earliest slice.

Sound handling should eventually be isolated behind a small interface or service rather than being triggered randomly across UI components.

Possible categories:

```text
COUNTDOWN
VOTE
LOCK
REVEAL
WINNER
TRANSITION
```

Licensing of sound assets must be considered before public distribution.

---

## 25. Twitch Adapter

Twitch-specific code should be isolated.

Conceptual structure:

```text
features/
└── twitch/
    ├── twitch-client
    ├── event-parser
    ├── chat-vote-adapter
    └── channel-point-adapter
```

Names are illustrative.

The goal is that the rest of the game does not need to understand raw Twitch EventSub payloads.

---

## 26. Twitch Chat Votes

The Twitch adapter receives a chat event.

Example input:

```text
viewer123:
!vote 2
```

Adapter responsibility:

```text
raw Twitch event
        ↓
validate
        ↓
identify Twitch user
        ↓
parse vote command
        ↓
create domain vote input
```

The game domain then decides whether the vote is valid.

---

## 27. Channel Point Suggestions

Channel Point redemption data is translated into a Suggestion.

Conceptually:

```text
Twitch Redemption
        ↓
Twitch Adapter
        ↓
Suggestion Service
        ↓
Suggestion
```

A Suggestion is intentionally different from a Question.

---

## 28. Suggestions

Conceptual model:

```text
Suggestion
├── id
├── twitchUserId
├── rawText
├── status
├── submittedAt
└── redemption reference
```

Possible states:

```text
PENDING
ACCEPTED
REJECTED_REFUND
REJECTED_NO_REFUND
```

Accepted suggestions are used as input to the Question Editor.

They do not automatically become Questions.

---

## 29. Persistence Boundary

The domain should not directly call Prisma.

Preferred direction:

```text
Game Logic
     ↓
Repository Interface / Service
     ↓
Prisma implementation
     ↓
PostgreSQL
```

This does not require a complex enterprise repository pattern for every model.

The goal is simply to prevent Prisma-specific objects from becoming the application's domain model.

---

## 30. Database

Preferred database:

```text
PostgreSQL
```

Preferred ORM:

```text
Prisma
```

Database infrastructure should be introduced once persistent data becomes part of the active implementation slice.

Potential persisted entities include:

```text
Deck
Question
Suggestion
Session
Round
Vote
Viewer
```

The schema should be designed based on actual use cases at that stage.

---

## 31. Realtime Communication

The host page and overlay eventually need synchronized state.

Realtime transport is currently:

```text
TBD
```

Candidates may include:

- WebSocket-based communication
- Server-Sent Events
- library-based realtime transport
- another appropriate mechanism

Selection criteria should include:

- simplicity
- reconnect behavior
- deployment environment
- server compatibility
- OBS browser compatibility
- development ergonomics

Do not add Socket.IO, WebSocket infrastructure, Redis, or similar technology until this decision is made.

---

## 32. Client State

No global client state library is selected.

React state and server-driven state should be used first.

Libraries such as Zustand should only be introduced if actual cross-component state complexity makes them useful.

Do not install a state library merely because the project may eventually become large.

---

## 33. Validation

Zod is part of the initial stack.

Zod should primarily validate boundaries.

Examples:

- API input
- Twitch event transformations
- configuration
- external data
- future form submissions

Do not add runtime validation to every internal function unnecessarily.

---

## 34. API

Next.js route handlers may be used for HTTP APIs.

Example future endpoints:

```text
/api/game/start
/api/game/vote
/api/game/lock
/api/game/reveal
```

These paths are illustrative.

Internal server APIs should be designed around use cases rather than direct CRUD exposure of database tables.

---

## 35. Configuration

Environment-specific values must not be committed.

Expected future environment variables may include:

```text
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
DATABASE_URL
```

`.env.local` should remain ignored by Git.

A checked-in example file may later document required values:

```text
.env.example
```

---

## 36. Security

Secrets must never be stored in:

- source files
- CLAUDE.md
- AGENTS.md
- documentation
- committed `.env` files
- prompts copied into version control

Claude should never be asked to print or commit real secrets.

Twitch OAuth permissions should follow least privilege.

---

## 37. Error Handling

Expected errors should be handled at system boundaries.

Examples:

- malformed Twitch event
- invalid vote command
- Twitch connection interruption
- invalid state transition
- database unavailable
- overlay reconnect

Avoid blanket try/catch blocks that silently hide failures.

During development, failures should be observable.

---

## 38. Logging

Simple structured logging is sufficient initially.

Do not introduce a logging platform during local development.

Future hosted versions may distinguish:

```text
debug
info
warn
error
```

Twitch events should not log sensitive OAuth tokens.

---

## 39. Testing Strategy

Testing should prioritize domain behavior.

High-value unit test candidates:

- vote replacement
- invalid option rejection
- game state transitions
- random question constraints
- similarity calculation
- suggestion status transitions

UI tests should focus on important interactive behavior rather than snapshotting every component.

Integration tests become useful once Twitch adapters and persistence exist.

---

## 40. Development Slices

Architecture should evolve through vertical slices.

### Slice 1

```text
Static questions
+
local game state
+
host page
+
overlay page
```

Goal:

A host starts a local game and the overlay displays the selected question.

### Slice 2

```text
Game state transitions
```

Goal:

Host can move through:

```text
INTRO
VOTING
LOCKED
REVEAL
RESULT
```

### Slice 3

```text
Local voting
```

Goal:

Voting rules work before Twitch is involved.

### Slice 4

```text
Twitch adapter
+
chat voting
```

### Slice 5

```text
Polished reveal
+
gameshow animation
```

### Slice 6

```text
Persistence
+
PostgreSQL
+
Prisma
```

### Slice 7

```text
Channel Point Suggestions
```

### Slice 8

```text
Similarity
+
session results
```

The exact sequence may change when implementation reveals better boundaries.

---

## 41. Worker Process

A dedicated Twitch worker is likely but not mandatory at project start.

Introduce it when at least one of the following becomes true:

- Twitch requires a long-running process that does not fit cleanly into the Next.js runtime
- deployment requires independent lifecycle management
- Twitch event processing should continue independently of web requests
- reliability requirements justify separation

Until then, avoid introducing an additional runtime merely to match a future diagram.

---

## 42. Monorepo

The repository should not become a monorepo by default.

Current approach:

```text
single Next.js repository
```

A structure such as:

```text
apps/
packages/
```

should only be introduced if multiple independently built applications or shared packages actually exist.

Potential future trigger:

```text
apps/web
apps/twitch-worker
packages/game-domain
```

That migration can happen later if justified.

---

## 43. Docker

Docker is not part of the earliest local architecture.

It becomes useful once one or more of the following are introduced:

- PostgreSQL
- dedicated worker
- reproducible deployment
- VPS deployment
- Raspberry Pi / home server deployment

Likely later architecture:

```text
Docker Compose

├── web
├── twitch-worker
└── postgres
```

A reverse proxy or tunnel may additionally be used in production.

---

## 44. Deployment Independence

Application code should avoid assumptions about:

- Vercel
- Netcup
- Raspberry Pi
- Cloudflare Tunnel
- specific Linux distribution

The application should ultimately be capable of running as a normal Node application in containers.

Deployment-specific configuration belongs in infrastructure configuration, not game logic.

---

## 45. AI-Friendly Architecture

Because a coding agent will write significant portions of the implementation, code should favor explicit structure over cleverness.

Prefer:

- descriptive names
- small modules
- explicit state transitions
- clear dependencies
- obvious data flow
- documented unusual decisions

Avoid:

- unnecessary metaprogramming
- hidden global state
- extremely clever TypeScript types
- large generic abstractions without immediate value
- magic behavior that requires extensive context to understand

AI-generated code must remain understandable to a human developer.

---

## 46. Architectural Review Rule

Before introducing a major dependency or architectural layer, answer:

1. What current problem does this solve?
2. Why is the existing approach insufficient?
3. What new complexity does it introduce?
4. What alternatives exist?
5. Is the decision easy to reverse?

Examples include introducing:

- Prisma
- Docker
- Redis
- XState
- Zustand
- Socket.IO
- authentication frameworks
- monorepo tooling
- separate services

The coding agent should not make these decisions silently.

---

## 47. Current Architectural Decisions

Currently selected:

```text
Framework          Next.js
UI                 React
Language           TypeScript
Router             App Router
Styling            SCSS Modules
Animation          Motion
Validation         Zod
Utility classes    clsx
Package manager    npm
Database           PostgreSQL planned
ORM                Prisma planned
Twitch             EventSub planned
```

Currently intentionally undecided:

```text
Realtime transport
Client state library
Authentication library
Deployment provider
Worker process boundary
Sound library
Database schema
Viewer web architecture
```

---

## 48. Architecture Principle

The guiding rule of this project is:

> Design for the requirement we understand today while avoiding decisions that unnecessarily block the requirement we expect tomorrow.

Future flexibility is valuable.

Future complexity is not.
