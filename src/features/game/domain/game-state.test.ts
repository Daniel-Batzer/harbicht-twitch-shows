import { describe, expect, it } from "vitest";
import type { Deck, Question } from "../../questions/domain/question";
import {
  applyGameCommand,
  endGame,
  finishGame,
  GAME_COMMANDS,
  getAvailableCommands,
  initialGameState,
  lockVoting,
  openVoting,
  revealResult,
  showResult,
  startGame,
  startNextRound,
  stopVotingTimer,
  type GameCommand,
  type GameCommandContext,
  type GameSettings,
  type GameState,
  type GameStatus,
  type RoundDependencies,
  type TransitionResult,
} from "./game-state";
import { settleVotingDeadline } from "./voting-timer";

function makeQuestion(id: string, context?: string): Question {
  return {
    id,
    prompt: `Prompt ${id}?`,
    context,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
  };
}

const deck: Deck = {
  id: "test-deck",
  name: "Test deck",
  questions: [makeQuestion("q1"), makeQuestion("q2", "Whenever something happens..."), makeQuestion("q3"), makeQuestion("q4")],
};

const TOTAL_ROUNDS = 3;
const HOST_PARTICIPANT_ID = "local:host";

// Voting timer (Decision 047): every command in these tests runs at NOW_MS
// unless a test says otherwise. A timed game's voting opens at NOW_MS.
const NOW_MS = 1_000_000;
const DURATION_SECONDS = 30;
const GRACE_MS = 3000;
const ENDS_AT_MS = NOW_MS + DURATION_SECONDS * 1000;
const CLOSES_AT_MS = ENDS_AT_MS + GRACE_MS;

function makeDependencies(randomNumber = 0): RoundDependencies {
  let nextId = 0;
  return {
    randomNumber: () => randomNumber,
    createId: () => `id-${++nextId}`,
  };
}

function makeSettings(totalRounds: number, votingDurationSeconds: number | null = null): GameSettings {
  return {
    totalRounds,
    hostParticipantId: HOST_PARTICIPANT_ID,
    revealOrder: "HOST_FIRST",
    sharedChatVotingMode: "INCLUDE_SHARED_CHAT",
    votingDurationSeconds,
    voteGracePeriodMs: GRACE_MS,
  };
}

type ContextOptions = { randomNumber?: number; nowMs?: number; votingDurationSeconds?: number | null };

function makeContext({ randomNumber = 0, nowMs = NOW_MS, votingDurationSeconds = null }: ContextOptions = {}) {
  const context: GameCommandContext = {
    deck,
    ...makeSettings(TOTAL_ROUNDS, votingDurationSeconds),
    ...makeDependencies(randomNumber),
    nowMs,
  };
  return context;
}

function expectOk(result: TransitionResult): GameState {
  if (!result.ok) throw new Error(`expected transition to succeed, got ${result.failure.reason}`);
  return result.state;
}

/** Reaches a state through real transitions instead of hand-building it. */
function play(commands: GameCommand[], context = makeContext()): GameState {
  return commands.reduce((state, command) => expectOk(applyGameCommand(state, command, context)), initialGameState);
}

const ROUND_STEPS: GameCommand[] = ["OPEN_VOTING", "LOCK_VOTING", "REVEAL_RESULT", "SHOW_RESULT"];
const LAST_ROUND_RESULT: GameCommand[] = [
  "START_GAME",
  ...ROUND_STEPS,
  "START_NEXT_ROUND",
  ...ROUND_STEPS,
  "START_NEXT_ROUND",
  ...ROUND_STEPS,
];

const timedContext = makeContext({ votingDurationSeconds: DURATION_SECONDS });

const reachableStates = {
  IDLE: initialGameState,
  INTRO: play(["START_GAME"]),
  VOTING: play(["START_GAME", "OPEN_VOTING"]),
  // At NOW_MS the countdown has just started, so the timer can still be stopped.
  "VOTING (timer running)": play(["START_GAME", "OPEN_VOTING"], timedContext),
  LOCKED: play(["START_GAME", "OPEN_VOTING", "LOCK_VOTING"]),
  REVEAL: play(["START_GAME", "OPEN_VOTING", "LOCK_VOTING", "REVEAL_RESULT"]),
  "RESULT (rounds left)": play(["START_GAME", ...ROUND_STEPS]),
  "RESULT (last round)": play(LAST_ROUND_RESULT),
  FINISHED: play([...LAST_ROUND_RESULT, "FINISH_GAME"]),
} satisfies Record<string, GameState>;

type StateLabel = keyof typeof reachableStates;
const stateLabels = Object.keys(reachableStates) as StateLabel[];

type ExpectedOutcome = { to: GameStatus } | { fails: "NO_ROUNDS_REMAINING" };

// The transition table from the Phase 2 plan / Decision 042. Every command not
// listed for a state must fail with INVALID_TRANSITION.
const expectedTransitions: Record<StateLabel, Partial<Record<GameCommand, ExpectedOutcome>>> = {
  IDLE: { START_GAME: { to: "INTRO" } },
  INTRO: { OPEN_VOTING: { to: "VOTING" }, END_GAME: { to: "IDLE" } },
  VOTING: { LOCK_VOTING: { to: "LOCKED" }, END_GAME: { to: "IDLE" } },
  "VOTING (timer running)": {
    LOCK_VOTING: { to: "LOCKED" },
    STOP_VOTING_TIMER: { to: "VOTING" },
    END_GAME: { to: "IDLE" },
  },
  LOCKED: { REVEAL_RESULT: { to: "REVEAL" }, END_GAME: { to: "IDLE" } },
  REVEAL: { SHOW_RESULT: { to: "RESULT" }, END_GAME: { to: "IDLE" } },
  "RESULT (rounds left)": {
    START_NEXT_ROUND: { to: "INTRO" },
    FINISH_GAME: { to: "FINISHED" },
    END_GAME: { to: "IDLE" },
  },
  "RESULT (last round)": {
    START_NEXT_ROUND: { fails: "NO_ROUNDS_REMAINING" },
    FINISH_GAME: { to: "FINISHED" },
    END_GAME: { to: "IDLE" },
  },
  FINISHED: { END_GAME: { to: "IDLE" } },
};

describe("transition matrix", () => {
  const cases = stateLabels.flatMap((label) => GAME_COMMANDS.map((command) => [label, command] as const));

  it.each(cases)("%s + %s", (label, command) => {
    const state = reachableStates[label];
    const stateBefore = structuredClone(state);
    const expected = expectedTransitions[label][command];

    const result = applyGameCommand(state, command, makeContext());

    if (!expected) {
      expect(result).toEqual({ ok: false, failure: { reason: "INVALID_TRANSITION", command, from: state.status } });
    } else if ("to" in expected) {
      expect(expectOk(result).status).toBe(expected.to);
    } else {
      expect(result).toEqual({ ok: false, failure: { reason: expected.fails } });
    }
    expect(state).toEqual(stateBefore);
  });
});

describe("getAvailableCommands", () => {
  it.each(stateLabels)("matches exactly the commands that succeed in %s", (label) => {
    const state = reachableStates[label];
    const succeedingCommands = GAME_COMMANDS.filter((command) => applyGameCommand(state, command, makeContext()).ok);

    expect([...getAvailableCommands(state, NOW_MS)].sort()).toEqual([...succeedingCommands].sort());
  });

  it.each([
    { at: "just opened", nowMs: NOW_MS },
    { at: "1 ms before the countdown ends", nowMs: ENDS_AT_MS - 1 },
    { at: "the countdown's end", nowMs: ENDS_AT_MS },
    { at: "the grace period", nowMs: ENDS_AT_MS + 1500 },
  ])("matches the commands that succeed while a timed round votes, at $at", ({ nowMs }) => {
    const state = reachableStates["VOTING (timer running)"];
    const context = makeContext({ nowMs });
    const succeedingCommands = GAME_COMMANDS.filter((command) => applyGameCommand(state, command, context).ok);

    expect([...getAvailableCommands(state, nowMs)].sort()).toEqual([...succeedingCommands].sort());
  });

  it("offers Stop timer only while the countdown runs", () => {
    const state = reachableStates["VOTING (timer running)"];

    expect(getAvailableCommands(state, ENDS_AT_MS - 1)).toContain("STOP_VOTING_TIMER");
    expect(getAvailableCommands(state, ENDS_AT_MS)).not.toContain("STOP_VOTING_TIMER");
    expect(getAvailableCommands(reachableStates.VOTING, NOW_MS)).not.toContain("STOP_VOTING_TIMER");
  });
});

describe("startGame", () => {
  it("moves from IDLE to INTRO with round 1, the session settings, injected ids and no votes", () => {
    // HOST_FIRST and INCLUDE_SHARED_CHAT (not the service defaults) prove the settings are taken over, not assumed.
    const result = startGame(initialGameState, deck, makeSettings(3, DURATION_SECONDS), makeDependencies(0.3));

    expect(result).toEqual({
      ok: true,
      state: {
        status: "INTRO",
        session: {
          id: "id-1",
          deckId: "test-deck",
          totalRounds: 3,
          playedQuestionIds: ["q2"],
          hostParticipantId: HOST_PARTICIPANT_ID,
          votes: [],
          revealOrder: "HOST_FIRST",
          sharedChatVotingMode: "INCLUDE_SHARED_CHAT",
          votingDurationSeconds: DURATION_SECONDS,
          voteGracePeriodMs: GRACE_MS,
        },
        currentRound: {
          id: "id-2",
          number: 1,
          question: deck.questions[1],
          votingTimer: null,
          votingClosedBy: null,
        },
      },
    });
  });

  it("allows a session that uses every question of the deck", () => {
    expectOk(startGame(initialGameState, deck, makeSettings(deck.questions.length), makeDependencies()));
  });

  it("rejects an empty deck", () => {
    const emptyDeck: Deck = { ...deck, questions: [] };

    expect(startGame(initialGameState, emptyDeck, makeSettings(1), makeDependencies())).toEqual({
      ok: false,
      failure: { reason: "NOT_ENOUGH_QUESTIONS" },
    });
  });

  it("rejects a deck with fewer questions than rounds", () => {
    expect(startGame(initialGameState, deck, makeSettings(deck.questions.length + 1), makeDependencies())).toEqual(
      { ok: false, failure: { reason: "NOT_ENOUGH_QUESTIONS" } },
    );
  });

  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects totalRounds = %s", (totalRounds) => {
    expect(startGame(initialGameState, deck, makeSettings(totalRounds), makeDependencies())).toEqual({
      ok: false,
      failure: { reason: "INVALID_TOTAL_ROUNDS" },
    });
  });

  it("stores a game without a timer", () => {
    const state = expectOk(startGame(initialGameState, deck, makeSettings(3, null), makeDependencies()));

    expect(state.status === "INTRO" && state.session.votingDurationSeconds).toBeNull();
  });

  it.each([0, -30, 1.5, Number.NaN])("rejects a voting duration of %s seconds", (votingDurationSeconds) => {
    expect(startGame(initialGameState, deck, makeSettings(3, votingDurationSeconds), makeDependencies())).toEqual({
      ok: false,
      failure: { reason: "INVALID_VOTING_DURATION" },
    });
  });
});

describe("round phase steps", () => {
  it.each([
    { step: (state: GameState) => openVoting(state, NOW_MS), from: "INTRO", to: "VOTING" },
    { step: revealResult, from: "LOCKED", to: "REVEAL" },
    { step: showResult, from: "REVEAL", to: "RESULT" },
  ] as const)("$from → $to changes only the status", ({ step, from, to }) => {
    const state = reachableStates[from];

    expect(step(state)).toEqual({ ok: true, state: { ...state, status: to } });
  });

  it("starts the session's voting timer when voting opens", () => {
    const intro = play(["START_GAME"], timedContext);
    if (intro.status !== "INTRO") throw new Error("expected INTRO");

    const voting = expectOk(openVoting(intro, NOW_MS));

    expect(voting).toEqual({
      ...intro,
      status: "VOTING",
      currentRound: {
        ...intro.currentRound,
        votingTimer: {
          durationSeconds: DURATION_SECONDS,
          startedAtMs: NOW_MS,
          endsAtMs: ENDS_AT_MS,
          closesAtMs: CLOSES_AT_MS,
        },
      },
    });
  });

  it("records that the host locked voting", () => {
    const state = reachableStates["VOTING (timer running)"];
    if (state.status !== "VOTING") throw new Error("expected VOTING");

    expect(lockVoting(state)).toEqual({
      ok: true,
      state: { ...state, status: "LOCKED", currentRound: { ...state.currentRound, votingClosedBy: "HOST" } },
    });
  });
});

describe("stopVotingTimer", () => {
  const timedVoting = reachableStates["VOTING (timer running)"];

  it("removes the timer before the countdown ends, so voting stays open until the host locks it", () => {
    if (timedVoting.status !== "VOTING") throw new Error("expected VOTING");

    const stopped = expectOk(stopVotingTimer(timedVoting, ENDS_AT_MS - 1));

    expect(stopped).toEqual({ ...timedVoting, currentRound: { ...timedVoting.currentRound, votingTimer: null } });
    // Without a timer there is no deadline left to settle.
    expect(settleVotingDeadline(stopped, CLOSES_AT_MS + 60_000)).toBe(stopped);
  });

  it.each([
    { at: "the countdown's end", nowMs: ENDS_AT_MS },
    { at: "the grace period", nowMs: ENDS_AT_MS + 1500 },
  ])("rejects stopping at $at without touching the timer", ({ nowMs }) => {
    const stateBefore = structuredClone(timedVoting);

    expect(stopVotingTimer(timedVoting, nowMs)).toEqual({ ok: false, failure: { reason: "VOTING_TIMER_EXPIRED" } });
    expect(timedVoting).toEqual(stateBefore);
  });

  it("rejects stopping when the round has no timer", () => {
    expect(stopVotingTimer(reachableStates.VOTING, NOW_MS)).toEqual({
      ok: false,
      failure: { reason: "INVALID_TRANSITION", command: "STOP_VOTING_TIMER", from: "VOTING" },
    });
  });

  it("rejects stopping once the timer has locked voting", () => {
    const locked = settleVotingDeadline(timedVoting, CLOSES_AT_MS);

    expect(stopVotingTimer(locked, CLOSES_AT_MS)).toEqual({
      ok: false,
      failure: { reason: "INVALID_TRANSITION", command: "STOP_VOTING_TIMER", from: "LOCKED" },
    });
  });
});

describe("startNextRound", () => {
  it("starts the next round with a new id and an unplayed question", () => {
    const resultState = reachableStates["RESULT (rounds left)"];
    if (resultState.status !== "RESULT") throw new Error("expected RESULT");

    const next = expectOk(startNextRound(resultState, deck, makeDependencies(0)));

    expect(next).toEqual({
      status: "INTRO",
      session: { ...resultState.session, playedQuestionIds: ["q1", "q2"] },
      currentRound: { id: "id-1", number: 2, question: deck.questions[1], votingTimer: null, votingClosedBy: null },
    });
  });

  it("starts the next round without the previous round's timer or lock", () => {
    const timedResult = play(["START_GAME", ...ROUND_STEPS], timedContext);

    const next = expectOk(startNextRound(timedResult, deck, makeDependencies()));

    expect(next.status === "INTRO" && next.currentRound).toMatchObject({ votingTimer: null, votingClosedBy: null });
  });

  it("rejects starting a round after the last one", () => {
    expect(startNextRound(reachableStates["RESULT (last round)"], deck, makeDependencies())).toEqual({
      ok: false,
      failure: { reason: "NO_ROUNDS_REMAINING" },
    });
  });

  it("rejects when the deck has no unplayed question left", () => {
    const resultState = reachableStates["RESULT (rounds left)"];
    const exhaustedDeck: Deck = { ...deck, questions: [deck.questions[0]] };

    expect(startNextRound(resultState, exhaustedDeck, makeDependencies())).toEqual({
      ok: false,
      failure: { reason: "NOT_ENOUGH_QUESTIONS" },
    });
  });
});

describe("finishGame", () => {
  it.each(["RESULT (rounds left)", "RESULT (last round)"] as const)("moves from %s to FINISHED", (label) => {
    const state = reachableStates[label];
    if (state.status !== "RESULT") throw new Error("expected RESULT");

    expect(finishGame(state)).toEqual({ ok: true, state: { status: "FINISHED", session: state.session } });
  });
});

describe("endGame", () => {
  it.each(stateLabels.filter((label) => label !== "IDLE"))("moves from %s back to IDLE", (label) => {
    expect(endGame(reachableStates[label])).toEqual({ ok: true, state: { status: "IDLE" } });
  });

  it("rejects ending when no game is running", () => {
    expect(endGame(initialGameState)).toEqual({
      ok: false,
      failure: { reason: "INVALID_TRANSITION", command: "END_GAME", from: "IDLE" },
    });
  });
});

describe("full session", () => {
  it.each([0, 0.5, 0.999])("plays every round without repeating a question (random %s)", (randomNumber) => {
    const context = makeContext({ randomNumber });
    const askedQuestionIds: string[] = [];
    let state = expectOk(applyGameCommand(initialGameState, "START_GAME", context));

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      if (state.status !== "INTRO") throw new Error("expected INTRO");
      expect(state.currentRound.number).toBe(round);
      askedQuestionIds.push(state.currentRound.question.id);

      for (const step of ROUND_STEPS) state = expectOk(applyGameCommand(state, step, context));
      if (round < TOTAL_ROUNDS) state = expectOk(applyGameCommand(state, "START_NEXT_ROUND", context));
    }

    state = expectOk(applyGameCommand(state, "FINISH_GAME", context));
    expect(state.status).toBe("FINISHED");
    if (state.status === "FINISHED") expect(state.session.playedQuestionIds).toEqual(askedQuestionIds);
    expect(new Set(askedQuestionIds).size).toBe(TOTAL_ROUNDS);

    expect(expectOk(applyGameCommand(state, "END_GAME", context))).toEqual(initialGameState);
  });
});
