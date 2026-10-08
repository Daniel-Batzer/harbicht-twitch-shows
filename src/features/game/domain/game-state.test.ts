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
  type GameCommand,
  type GameCommandContext,
  type GameSettings,
  type GameState,
  type GameStatus,
  type RoundDependencies,
  type TransitionResult,
} from "./game-state";

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

function makeDependencies(randomNumber = 0): RoundDependencies {
  let nextId = 0;
  return {
    randomNumber: () => randomNumber,
    createId: () => `id-${++nextId}`,
  };
}

function makeSettings(totalRounds: number): GameSettings {
  return {
    totalRounds,
    hostParticipantId: HOST_PARTICIPANT_ID,
    revealOrder: "HOST_FIRST",
    sharedChatVotingMode: "INCLUDE_SHARED_CHAT",
  };
}

function makeContext(randomNumber = 0): GameCommandContext {
  return { deck, ...makeSettings(TOTAL_ROUNDS), ...makeDependencies(randomNumber) };
}

function expectOk(result: TransitionResult): GameState {
  if (!result.ok) throw new Error(`expected transition to succeed, got ${result.failure.reason}`);
  return result.state;
}

/** Reaches a state through real transitions instead of hand-building it. */
function play(commands: GameCommand[]): GameState {
  const context = makeContext();
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

const reachableStates = {
  IDLE: initialGameState,
  INTRO: play(["START_GAME"]),
  VOTING: play(["START_GAME", "OPEN_VOTING"]),
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

    expect([...getAvailableCommands(state)].sort()).toEqual([...succeedingCommands].sort());
  });
});

describe("startGame", () => {
  it("moves from IDLE to INTRO with round 1, the session settings, injected ids and no votes", () => {
    // HOST_FIRST and INCLUDE_SHARED_CHAT (not the service defaults) prove the settings are taken over, not assumed.
    const result = startGame(initialGameState, deck, makeSettings(3), makeDependencies(0.3));

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
        },
        currentRound: { id: "id-2", number: 1, question: deck.questions[1] },
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
});

describe("round phase steps", () => {
  it.each([
    { step: openVoting, from: "INTRO", to: "VOTING" },
    { step: lockVoting, from: "VOTING", to: "LOCKED" },
    { step: revealResult, from: "LOCKED", to: "REVEAL" },
    { step: showResult, from: "REVEAL", to: "RESULT" },
  ] as const)("$from → $to changes only the status", ({ step, from, to }) => {
    const state = reachableStates[from];

    expect(step(state)).toEqual({ ok: true, state: { ...state, status: to } });
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
      currentRound: { id: "id-1", number: 2, question: deck.questions[1] },
    });
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
    const context = makeContext(randomNumber);
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
