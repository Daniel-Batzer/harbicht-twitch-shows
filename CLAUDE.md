# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Harbicht Twitch Shows is a set of interactive Twitch stream tools. The first is a game-show-style "Would You Rather" voting game: a streamer and Twitch chat answer questions (usually three options), and results are revealed through animated sequences on an OBS overlay.

The project is in an early stage: currently only the `create-next-app` scaffold exists. Read the docs before planning features. They are the source of truth, and this file only summarizes them:

- `docs/PROJECT_SPEC.md`: product requirements and V1 definition of success
- `docs/ARCHITECTURE.md`: boundaries, dependency direction, domain concepts, planned folder layout
- `docs/DECISIONS.md`: numbered decision log (ADR-style), including open/TBD decisions
- `docs/ROADMAP.md`: phased vertical slices and the current position

Implementation progress belongs in `docs/` (e.g. a future `docs/PROGRESS.md`), not in this file (Decision 038). When an important product or architecture decision changes, update the relevant doc.

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint (flat config, next core-web-vitals + typescript)
npx tsc --noEmit # type-check only
```

No test runner is configured yet. Testing should prioritize domain logic (vote replacement, invalid option rejection, state transitions, question selection, similarity, suggestion status). Choosing a test framework counts as a dependency decision, so propose it instead of adding it silently.

## Stack

Next.js 16 (App Router, `src/app`), React 19 with the React Compiler (`reactCompiler: true`), TypeScript strict, SCSS Modules, Motion (`motion` package), Zod, clsx, npm. Path alias `@/*` → `src/*`.

Twitch chat voting (Phase 5) uses EventSub over WebSocket inside the Next.js server process, with Node's built-in `WebSocket` and no Twitch SDK (Decision 046). Planned but **not yet introduced**: PostgreSQL + Prisma, Docker. **Intentionally undecided**: realtime transport, client state library, auth library, worker process boundary, deployment provider, sound library.

## Architecture rules

- **Domain is framework-free.** Game logic (sessions, rounds, questions, votes, voting rules, similarity) must not import Next.js, React, Twitch types, Prisma, or browser APIs. Dependency direction: UI → Application → Domain ← Infrastructure adapters. For example, the Twitch adapter turns raw EventSub/chat payloads into a domain `VoteInput`, and the domain decides validity.
- **Two separate routes, one app:** `/host` is the streamer's control dashboard. `/overlay` is the OBS browser source: presentation only, transparent background, 1920×1080 reference canvas, no admin controls.
- **Game flow is an explicit state machine:** IDLE → INTRO → VOTING → LOCKED → REVEAL → RESULT → (INTRO | FINISHED), with END_GAME back to IDLE from any running state (PREPARE deferred, Decision 042). Invalid transitions must not silently mutate state. Use plain code first; XState only if the complexity justifies it.
- **Votes are stored individually** (participantId, roundId, optionId, source, castAt; Decision 043). Totals are derived from them. One effective vote per participant per round, and the latest valid vote wins. `participantId` is opaque and namespaced (`local:host`, `twitch:<userId>` since Phase 5), so the Twitch user ID (not display name) is the identity. The host is recognized by `session.hostParticipantId`, not by vote source.
- **The host vote is a normal vote** tagged with the host identity, with no separate vote system. It is the reference for similarity scoring.
- **Results stay hidden while voting is active.** The overlay may react to incoming votes but must not show totals until reveal.
- **Question options are a collection**, not fixed `optionA/B/C` fields. Three options is a game/presentation rule, not a model rule. `context` (trigger text) is optional.
- **Suggestions are not Questions.** Channel Point redemptions create a moderated `Suggestion` (PENDING / ACCEPTED / REJECTED_REFUND / REJECTED_NO_REFUND) that the host converts into a Question via an editor.
- **Persistence boundary:** domain code must not call Prisma directly. Go through a service or repository so Prisma types never become the domain model.
- **Zod at boundaries only:** API input, Twitch events, config, external data. Don't add it to internal functions.
- **Questions start as static TypeScript fixtures.** The database comes later (Decision 031).
- Animations follow domain state. Don't hide game logic inside Motion definitions or animation components.

## Code organization

Planned layout (`docs/ARCHITECTURE.md` §7–9): routes in `src/app/` (`host/`, `overlay/`, `api/`), feature code in `src/features/<feature>/` (e.g. `game`, `questions`, `voting`, `suggestions`, later `twitch`) with `domain/`, `components/`, `hooks/`, `services/` subfolders as needed, and genuinely reusable UI in `src/components/`. Don't create empty folders to match the plan, and keep feature components in their feature until real reuse appears. Route handlers should be use-case shaped (`/api/game/vote`), not table CRUD.

## Styling

SCSS Modules + Motion. **Tailwind is intentionally not used, so do not add it.** SCSS handles visuals, layout, pseudo-elements, and keyframes. Motion handles enter/exit, springs, and orchestrated state transitions. The visual target is a loud, colorful TV game show/arcade look (bold cards, glow, springs, dramatic reveals), not a generic SaaS dashboard.

## Working rules

- Work in small vertical slices following `docs/ROADMAP.md`. Don't implement speculative future features (viewer profiles, multi-streamer, plugin systems, etc.).
- **Do not silently add major dependencies or layers** (Prisma, Docker, Redis, XState, Zustand, Socket.IO/WebSockets, auth frameworks, monorepo tooling, workers, test frameworks). First answer: what current problem it solves, why the existing approach is insufficient, what complexity it adds, the alternatives, and how reversible it is. Then let the developer decide.
- Prefer explicit, readable code over clever code: descriptive names, small modules, explicit state transitions, no opaque type gymnastics or hidden global state. The developer is an experienced React/TS dev who reviews all generated code.
- For framework/library APIs that may have changed (Next.js 16, Motion, Prisma, Twitch libs), check current docs (`node_modules/next/dist/docs/`, Context7 when configured) instead of relying on memory.
- Never put secrets in source, docs, or committed `.env` files. `.env` and `.env.*` are gitignored (except `.env.example`). Don't log OAuth tokens.

- **Real environment files are human-owned.** Never read, create, edit, overwrite,
  delete, or print `.env`, `.env.local`, `.env.development`, `.env.production`,
  or other secret-bearing environment files.
- Claude may update `.env.example`, but it must contain placeholders and safe
  defaults only, never real credentials or tokens.
- When a new environment variable is required, update `.env.example` and tell
  the developer exactly which value must be added to their local environment.
- Do not inspect environment files to determine whether a secret already exists.
  Ask the developer or check only whether the variable is present in the process
  environment without printing its value.
- Enforced by `permissions.deny` in `.claude/settings.json` plus the PreToolUse hook
  `.claude/hooks/protect-env-files.mjs` (protects `.env` and `.env.*`, allows
  `.env.example`; `.envrc` is not covered). If blocked, ask the developer instead
  of finding a workaround. If a filesystem-capable MCP server is added, extend the
  hook matcher.
