# Harbicht Twitch Shows – Project Specification

## 1. Project Vision

Harbicht Twitch Shows is a collection of interactive Twitch entertainment tools.

The first application is an interactive game-show-style voting game in which
the streamer and Twitch viewers answer uncomfortable, difficult, funny, or
absurd questions.

The project is intentionally designed as more than a single Twitch poll.

The long-term goal is to build a reusable platform for different interactive
stream formats, games, viewer interactions, overlays, and Twitch integrations.

The project should also serve as a learning project for professional
AI-assisted software development using Claude Code.

Claude should perform a significant amount of implementation work, while the
human developer remains responsible for product decisions, architecture,
review, quality control, and understanding the generated code.


## 2. Development Philosophy

The project follows an AI-assisted development approach.

The goal is not traditional "vibe coding", where an AI receives only a vague
feature description and autonomously generates an application.

Instead:

- the developer defines product requirements
- architecture is discussed before implementation
- important decisions are documented
- Claude Code receives persistent project context
- external documentation should be consulted when necessary
- implementation should happen in small vertical slices
- generated code should be reviewed
- important concepts should be explained through a Teacher skill
- Git should be used throughout development
- infrastructure should only be introduced when it solves an actual problem

The developer should not have to manually write every implementation detail,
but should remain able to understand and maintain the resulting system.


## 3. Initial Game Concept

The first game is inspired by "Would You Rather" style questions.

A question contains a situation and usually three unpleasant or difficult
choices.

Example:

> Whenever you die in a game, which punishment would you rather receive?

Options:

- A: 10 push-ups
- B: eat something extremely spicy
- C: lose access to the game for 30 minutes

Another question may not require a trigger at all.

Example:

> What would you rather permanently lose?

Options:

- A: hearing
- B: eyesight
- C: sense of taste

The data model must therefore not assume that every question has a trigger.

A question may optionally contain contextual or trigger text.


## 4. Game Sessions

A game consists of a session containing several rounds.

Example:

Game Session

- Round 1
- Round 2
- Round 3
- Round 4
- Round 5

Each round contains one question.

The number of rounds should not be hard-coded.

For the initial game, five questions per session is a reasonable default.


## 5. Questions

Questions are stored persistently and organized into decks.

Example decks:

- General Would You Rather
- Gaming
- Dark / Uncomfortable
- Stream-specific
- Community Suggestions

For V1, questions are chosen randomly from the selected deck.

Future versions may support:

- manually selecting questions before a stream
- favorites
- tags
- categories
- difficulty or intensity
- safe / adult / dark filters
- recently-used filtering
- question history

The system should allow different numbers of answer options internally.

However, the first game is primarily designed around exactly three options.

The visual design should therefore be optimized for three answer cards.


## 6. Voting

### Twitch Chat Voting

V1 uses Twitch chat as the primary viewer voting mechanism.

Example commands:

!vote 1
!vote 2
!vote 3

Alternative command formats may be introduced later.

Each Twitch user is identified through the Twitch user ID rather than their
display name.

One Twitch user may only have one active vote per round.

If a viewer votes multiple times, the latest valid vote replaces the previous
vote.

Example:

Viewer votes A.

Later the same viewer votes C.

Only C counts.


## 7. Host Voting

The streamer may participate in the game.

The host vote behaves like a normal viewer vote and therefore contributes to
the total result.

However, the system must additionally know that the vote belongs to the host.

This allows the overlay to later reveal information such as:

"Daniel chose B."

The host vote can also be used as the reference vote for similarity scoring.

The streamer should feel like a participant in the game rather than a separate
special voting category.


## 8. Voting Privacy

Chat votes in V1 are inherently public because viewers send messages into
Twitch chat.

Even if messages were automatically deleted afterwards, they may already have
been visible to viewers or chat overlays.

Therefore V1 should not pretend that chat voting is secret.

A later web voting mode should support genuinely private voting.

Future voting sources may include:

- CHAT
- WEB

Votes from different sources still belong to the same Twitch user.

If the same user votes through both chat and web, the latest vote wins.


## 9. Voting Timer

Rounds may optionally use a timer.

Possible configurations:

- 30 seconds
- 60 seconds
- 90 seconds
- custom duration
- no timer

When no timer is configured, the host manually closes voting.

Example flow:

PREPARE
→ INTRO
→ VOTING
→ LOCKED
→ REVEAL
→ WINNER / RESULT
→ FINISHED

The exact state model may evolve during implementation.


## 10. Result Reveal

Vote counts should not be displayed while voting is active.

Viewers should not know which option is currently winning.

This reduces bandwagon effects and creates a more dramatic game-show reveal.

During voting the overlay may still visually react to incoming votes without
showing actual totals.

After voting closes, the result is revealed using an animated sequence.

Possible result visualizations include:

- animated bars
- percentages
- result cards
- pie/donut visualization
- winner highlight

The exact visualization may vary by game or theme.


## 11. Similarity Scoring

The game should eventually be able to calculate how similarly viewers voted
compared with the host.

Example:

Host:
A, B, C, B, A

Viewer:
A, B, C, B, C

Similarity:
80%

At the end of a session the application may display viewers who voted most
similarly to the host.

Example:

1. ViewerOne – 100%
2. ViewerTwo – 80%
3. ViewerThree – 80%

Votes must therefore be stored per round and Twitch user rather than only
aggregated into totals.


## 12. Host Dashboard

The streamer receives a dedicated host interface.

The dashboard is not the same page as the OBS overlay.

Possible controls include:

- start game
- start next round
- start voting
- lock voting
- reveal result
- next question
- skip question
- end game

The dashboard should also display useful information such as:

- current question
- current game state
- number of votes
- remaining timer
- current round
- pending viewer suggestions

The host dashboard does not need to be fully mobile optimized in V1.


## 13. OBS Overlay

OBS receives a dedicated browser-source route.

The overlay must:

- have a transparent background
- target a 1920×1080 reference canvas
- scale sensibly
- contain no dashboard controls
- react to live game state
- display questions
- display answer options
- display countdowns when enabled
- perform animated reveals
- support future viewer interaction effects

The visual experience is a core part of the application rather than an
afterthought.


## 14. Visual Direction

The application should feel like a colorful television game show mixed with an
arcade game and Twitch culture.

Inspiration may loosely come from games such as Buzz!, without copying their
visual identity.

Desired characteristics include:

- large expressive typography
- bold answer cards
- bright colors
- exaggerated transitions
- playful geometry
- glow and lighting effects
- squash and stretch
- spring animations
- animated backgrounds
- particles
- countdown pulses
- dramatic reveal sequences
- sound effects
- restrained screen shake
- Twitch emote interactions

The application should explicitly avoid looking like a generic SaaS dashboard.

The project should not default to a typical minimal gray card-based interface.


## 15. Styling Strategy

The project uses SCSS Modules for component styling.

Tailwind CSS is intentionally not used.

Reason:

The application requires highly custom visual styling and animation.

Large chains of Tailwind utility classes and arbitrary values would reduce
readability, make generated code harder to review, and make visual behavior
more difficult to explain.

Motion is used for state-driven and interactive animation.

General responsibility:

SCSS:
- visual design
- layout
- pseudo-elements
- responsive styling
- custom keyframes

Motion:
- enter/exit animations
- state transitions
- spring animations
- orchestrated UI movement

React:
- application state
- rendering logic
- game behavior


## 16. Twitch Channel Point Suggestions

The streamer is a Twitch Affiliate.

Therefore custom Channel Point rewards can be used.

A viewer may spend Channel Points to submit a game/question idea.

The viewer is not expected to understand the internal Question data structure.

Instead the redemption initially contains free-form text.

Example:

"Whenever you die: 10 push-ups, spicy food or no gaming for 30 minutes."

This creates a Suggestion, not a Question.


## 17. Suggestion Moderation

Viewer suggestions are never published automatically.

Suggestions appear in the host dashboard with status PENDING.

The host can:

- edit
- accept
- reject with refund
- reject without refund

Possible workflow:

Channel Point Redemption
→ Suggestion
→ Moderation
→ Question Editor
→ Accepted Question

When accepted, the host converts the raw suggestion into the structured
question format.

This may involve editing:

- context / trigger
- main question
- answer options
- deck
- tags

Reject with refund is appropriate for suggestions that are reasonable but
cannot be used.

Reject without refund may be used for spam, abuse, deliberate rule violations,
or obviously malicious submissions.


## 18. Audience Influence

A future Channel Point feature may allow viewers to promote their argument
during an active vote.

Example reward:

"Convince the Chat"

The viewer submits:

"People, vote B! C makes absolutely no sense!"

The text is displayed temporarily on the OBS overlay.

This mechanic should influence viewers socially rather than directly changing
vote counts.

Channel Points should not simply purchase additional votes.

Viewer-generated overlay content requires moderation and safety consideration
before being displayed publicly.


## 19. Twitch Emotes

Future versions may react to Twitch emotes in chat.

Examples:

- emotes flying across the screen
- emote bursts during reveals
- viewer reactions
- game-specific visual effects

The Twitch integration should avoid unnecessarily discarding useful event
information that may later support these features.

This functionality is not required for V1.


## 20. Viewer Web Application

The viewer-facing web interface is not part of the initial V1.

V1 primarily uses Twitch chat.

A later V1.5 may introduce a mobile-friendly viewer website.

Users authenticate using Twitch.

Features may include:

- private voting
- question interaction
- player profile
- game state
- future avatar functionality

The Twitch user ID remains the canonical viewer identity.


## 21. Persistent Viewer Profiles

Not required for V1.

Future versions may contain:

- XP
- levels
- custom currency
- avatars
- cosmetic items
- achievements
- participation statistics
- game history

These systems should not be prematurely designed before their requirements are
clear.


## 22. Future Stream Games

Harbicht Twitch Shows should eventually support multiple game types.

The first game must therefore avoid unnecessary assumptions that every future
game is simply a three-option poll.

Possible future tools include:

- different voting games
- audience mini games
- RPG-style interactions
- Stream Avatar integration
- interactive overlays
- emote-based games
- event-triggered entertainment tools

Shared functionality may later be extracted when real duplication appears.


## 23. Authentication

V1 is primarily a tool for the repository owner and streamer.

Multi-streamer support is not required initially.

The architecture should not unnecessarily prevent adding additional streamers
later.

Viewer authentication becomes relevant when web voting is introduced.

Twitch identity should be preferred over custom username/password accounts.


## 24. Persistence

Persistent storage will eventually be required for:

- questions
- decks
- suggestions
- game sessions
- rounds
- votes
- Twitch user references
- historical results

PostgreSQL is the preferred database.

Prisma is currently the preferred ORM.

The exact database schema should be designed when persistence becomes part of
the current implementation slice rather than prematurely implementing the full
future data model.


## 25. Realtime Communication

The host dashboard and OBS overlay need access to the current game state.

The exact realtime technology has not yet been selected.

Possible options should be evaluated when the first real-time vertical slice is
implemented.

Technology should be selected based on project requirements rather than added
because it is popular.


## 26. Twitch Integration

Twitch integration will eventually handle:

- chat messages
- votes
- Channel Point redemptions
- viewer identity
- possibly subscriptions
- Bits
- raids
- emotes
- future Twitch events

Only functionality required by the current development stage should initially
be implemented.

A visible Twitch bot account is not currently required.

The application may receive Twitch events without actively posting messages to
chat.


## 27. Reliability

During early local development, advanced reliability is not a priority.

Once hosted, the application should recover from temporary connection loss.

Examples:

- OBS overlay reconnects and retrieves current game state
- Twitch connection reconnects
- current session state survives browser refreshes where appropriate
- duplicate Twitch events should not cause duplicated actions

Persistence and recovery requirements should grow with the deployment stage.


## 28. Technology Stack

Initial stack:

- Next.js
- React
- TypeScript
- App Router
- React Compiler
- ESLint
- SCSS Modules
- Motion
- Zod
- clsx
- npm

Planned / likely later:

- PostgreSQL
- Prisma
- Docker
- Twitch EventSub
- realtime communication solution

Not currently selected:

- realtime library
- state management library
- authentication library
- deployment provider


## 29. Local Development

Initial development runs locally on the developer's Mac.

A local development environment is sufficient for the first implementation
steps.

OBS may use local URLs during development.


## 30. Deployment

Deployment is intentionally undecided.

Potential environments include:

### VPS

For example a rented Linux VPS.

Advantages may include:

- public IP
- predictable networking
- always online
- simple domain configuration

### Home Server

For example a Raspberry Pi or mini PC.

Public access may be provided through an outbound tunnel rather than traditional
router port forwarding.

The final application should preferably be containerizable so deployment is not
strongly tied to either option.

Hosting decisions should not unnecessarily influence early application
architecture.


## 31. Docker

Docker is expected to become useful once the project contains multiple runtime
dependencies such as PostgreSQL, the Next.js application, or a separate Twitch
worker.

Docker should not be introduced merely for the sake of using Docker.

It should be added when it solves an actual development or deployment problem.


## 32. Git and GitHub

Git is part of the development workflow from the beginning.

Repository:

Daniel-Batzer/harbicht-twitch-shows

Development should use meaningful commits.

AI-generated changes should be reviewed before being committed.

The repository should remain buildable between meaningful milestones where
practical.


## 33. AI Development Infrastructure

Claude Code will be used as the primary coding agent.

Planned AI tooling includes:

- CLAUDE.md
- AGENTS.md
- Context7 MCP
- reusable Skills
- custom Teacher skill
- planning workflows
- potentially specialized agents
- review workflows

AI tooling should be introduced intentionally and documented.


## 34. Context7

Context7 should be used when implementation depends on external framework or
library APIs whose current usage is not already established in the repository.

Examples:

- Next.js
- Motion
- Prisma
- Twitch-related libraries
- authentication libraries

Context7 should not be called unnecessarily for basic code that does not depend
on changing external APIs.


## 35. Teacher Skill

A custom Teacher skill should be introduced early.

The Teacher should help the developer understand AI-generated implementation
without explaining trivial programming concepts.

The developer already has professional React / TypeScript experience.

The Teacher should focus on:

- architecture
- unfamiliar patterns
- library-specific behavior
- important data flow
- unusual implementation details
- trade-offs
- technical debt
- alternatives
- code that deserves human review

The Teacher should be able to explain features after Claude implements them.

It should not merely paraphrase every line of source code.


## 36. Scope Discipline

The project should be developed through small vertical slices.

Do not implement speculative systems simply because they may be useful later.

A future requirement may influence architecture, but should not automatically
cause the future feature to be implemented.

Examples:

Do not implement:

- avatar economy during V1
- multi-streamer administration during V1
- complex deployment infrastructure before deployment
- generic plugin architecture without multiple real use cases
- excessive microservices

Prefer the simplest architecture that handles the current requirement while
leaving sensible extension points.


## 37. Initial Vertical Slices

A likely implementation sequence is:

1. Host interface can start a local game.
2. Game selects a random question.
3. OBS overlay displays the current question.
4. Host can move through basic game states.
5. Voting model is implemented locally.
6. Twitch chat votes are integrated.
7. Voting lock and result reveal are implemented.
8. Gameshow visual design and animations are improved.
9. Persistence is introduced.
10. Channel Point suggestions are introduced.
11. Similarity scoring is implemented.
12. Deployment is prepared.

This sequence is not immutable.

Architecture and requirements should be reevaluated as implementation reveals
new information.


## 38. Definition of Success for V1

V1 is successful when the streamer can:

- start a game session
- receive random questions from a deck
- display them in an OBS overlay
- allow Twitch viewers to vote through chat
- optionally vote as the host
- close voting manually or through a timer
- reveal results through a polished animated sequence
- play several rounds
- calculate viewer similarity to the host
- receive Channel Point question suggestions
- moderate those suggestions through a dashboard

The application should be visually entertaining enough to use during a real
Twitch stream.