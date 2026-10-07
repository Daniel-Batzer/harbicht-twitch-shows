import type { Deck, Question } from "../../questions/domain/question";
import { selectRandomQuestion } from "../../questions/domain/select-random-question";
import type { ParticipantId, Vote } from "../../voting/domain/vote";

// The game flow as an explicit state machine (Decision 028, Decision 042):
//
//   IDLE → INTRO → VOTING → LOCKED → REVEAL → RESULT ─┬→ INTRO (next round)
//                                                     └→ FINISHED
//   END_GAME leads from any running state (including FINISHED) back to IDLE.
//
// Every transition is a pure function that either returns the next state or a
// failure. A failed transition never mutates the given state.
// PREPARE is deferred until the session has something to prepare (deck or
// round-count selection).

export type RoundPhase = "INTRO" | "VOTING" | "LOCKED" | "REVEAL" | "RESULT";
export type GameStatus = "IDLE" | RoundPhase | "FINISHED";

/**
 * Presentation setting: which part of a round's outcome REVEAL uncovers first
 * (Decision 044). AUDIENCE_FIRST shows the vote distribution in REVEAL and adds
 * the host's choice in RESULT; HOST_FIRST does it the other way around.
 * The domain only stores it; the snapshot projection interprets it.
 */
export type RevealOrder = "AUDIENCE_FIRST" | "HOST_FIRST";

export type GameSession = {
  id: string;
  deckId: string;
  totalRounds: number;
  /** Includes the current round's question; used to avoid repeats within the session. */
  playedQuestionIds: string[];
  /** The host votes as a normal participant; this id marks their votes (Decision 013). */
  hostParticipantId: ParticipantId;
  /**
   * Every effective vote of the session, across all rounds (one per participant
   * per round). Kept after a round ends so similarity can use it later.
   */
  votes: Vote[];
  /** Fixed for the whole session. */
  revealOrder: RevealOrder;
};

export type CurrentRound = {
  id: string;
  number: number;
  question: Question;
};

export type RoundInProgressState = { status: RoundPhase; session: GameSession; currentRound: CurrentRound };
export type FinishedGameState = { status: "FINISHED"; session: GameSession };

export type GameState = { status: "IDLE" } | RoundInProgressState | FinishedGameState;

export const GAME_COMMANDS = [
  "START_GAME",
  "OPEN_VOTING",
  "LOCK_VOTING",
  "REVEAL_RESULT",
  "SHOW_RESULT",
  "START_NEXT_ROUND",
  "FINISH_GAME",
  "END_GAME",
] as const;

export type GameCommand = (typeof GAME_COMMANDS)[number];

export type TransitionFailure =
  | { reason: "INVALID_TRANSITION"; command: GameCommand; from: GameStatus }
  | { reason: "INVALID_TOTAL_ROUNDS" }
  | { reason: "NO_ROUNDS_REMAINING" }
  | { reason: "NOT_ENOUGH_QUESTIONS" };

export type TransitionResult = { ok: true; state: GameState } | { ok: false; failure: TransitionFailure };

/** Side effects the domain needs but must not own (randomness, id generation). */
export type RoundDependencies = {
  randomNumber: () => number;
  createId: () => string;
};

export type GameSettings = {
  totalRounds: number;
  hostParticipantId: ParticipantId;
  revealOrder: RevealOrder;
};

export type GameCommandContext = RoundDependencies & GameSettings & { deck: Deck };

export const initialGameState: GameState = { status: "IDLE" };

function invalidTransition(state: GameState, command: GameCommand): TransitionResult {
  return { ok: false, failure: { reason: "INVALID_TRANSITION", command, from: state.status } };
}

function hasRoundsRemaining(state: RoundInProgressState): boolean {
  return state.currentRound.number < state.session.totalRounds;
}

export function startGame(
  state: GameState,
  deck: Deck,
  settings: GameSettings,
  dependencies: RoundDependencies,
): TransitionResult {
  if (state.status !== "IDLE") return invalidTransition(state, "START_GAME");

  const { totalRounds, hostParticipantId, revealOrder } = settings;
  if (!Number.isInteger(totalRounds) || totalRounds < 1) {
    return { ok: false, failure: { reason: "INVALID_TOTAL_ROUNDS" } };
  }
  // Every round needs its own question (no repeats within a session).
  if (deck.questions.length < totalRounds) return { ok: false, failure: { reason: "NOT_ENOUGH_QUESTIONS" } };

  const question = selectRandomQuestion(deck.questions, dependencies.randomNumber());
  if (!question) return { ok: false, failure: { reason: "NOT_ENOUGH_QUESTIONS" } };

  return {
    ok: true,
    state: {
      status: "INTRO",
      session: {
        id: dependencies.createId(),
        deckId: deck.id,
        totalRounds,
        playedQuestionIds: [question.id],
        hostParticipantId,
        votes: [],
        revealOrder,
      },
      currentRound: { id: dependencies.createId(), number: 1, question },
    },
  };
}

export function openVoting(state: GameState): TransitionResult {
  if (state.status !== "INTRO") return invalidTransition(state, "OPEN_VOTING");
  return { ok: true, state: { ...state, status: "VOTING" } };
}

export function lockVoting(state: GameState): TransitionResult {
  if (state.status !== "VOTING") return invalidTransition(state, "LOCK_VOTING");
  return { ok: true, state: { ...state, status: "LOCKED" } };
}

export function revealResult(state: GameState): TransitionResult {
  if (state.status !== "LOCKED") return invalidTransition(state, "REVEAL_RESULT");
  return { ok: true, state: { ...state, status: "REVEAL" } };
}

/** REVEAL → RESULT is a manual host step for now; it may become automatic in Phase 4. */
export function showResult(state: GameState): TransitionResult {
  if (state.status !== "REVEAL") return invalidTransition(state, "SHOW_RESULT");
  return { ok: true, state: { ...state, status: "RESULT" } };
}

export function startNextRound(state: GameState, deck: Deck, dependencies: RoundDependencies): TransitionResult {
  if (state.status !== "RESULT") return invalidTransition(state, "START_NEXT_ROUND");
  if (!hasRoundsRemaining(state)) return { ok: false, failure: { reason: "NO_ROUNDS_REMAINING" } };

  const { session, currentRound } = state;
  const question = selectRandomQuestion(deck.questions, dependencies.randomNumber(), session.playedQuestionIds);
  if (!question) return { ok: false, failure: { reason: "NOT_ENOUGH_QUESTIONS" } };

  return {
    ok: true,
    state: {
      status: "INTRO",
      session: { ...session, playedQuestionIds: [...session.playedQuestionIds, question.id] },
      currentRound: { id: dependencies.createId(), number: currentRound.number + 1, question },
    },
  };
}

/** Allowed after any round's result, so the host can also finish early. */
export function finishGame(state: GameState): TransitionResult {
  if (state.status !== "RESULT") return invalidTransition(state, "FINISH_GAME");
  return { ok: true, state: { status: "FINISHED", session: state.session } };
}

/** Aborts a running game, or closes the game-over screen. */
export function endGame(state: GameState): TransitionResult {
  if (state.status === "IDLE") return invalidTransition(state, "END_GAME");
  return { ok: true, state: initialGameState };
}

/**
 * The commands that are valid from the given state: the transition table in
 * readable form. START_GAME can still fail on its settings or deck.
 * Tests check that this agrees with the guards of the functions above.
 */
export function getAvailableCommands(state: GameState): GameCommand[] {
  switch (state.status) {
    case "IDLE":
      return ["START_GAME"];
    case "INTRO":
      return ["OPEN_VOTING", "END_GAME"];
    case "VOTING":
      return ["LOCK_VOTING", "END_GAME"];
    case "LOCKED":
      return ["REVEAL_RESULT", "END_GAME"];
    case "REVEAL":
      return ["SHOW_RESULT", "END_GAME"];
    case "RESULT":
      return hasRoundsRemaining(state)
        ? ["START_NEXT_ROUND", "FINISH_GAME", "END_GAME"]
        : ["FINISH_GAME", "END_GAME"];
    case "FINISHED":
      return ["END_GAME"];
  }
}

export function applyGameCommand(state: GameState, command: GameCommand, context: GameCommandContext): TransitionResult {
  switch (command) {
    case "START_GAME":
      return startGame(
        state,
        context.deck,
        {
          totalRounds: context.totalRounds,
          hostParticipantId: context.hostParticipantId,
          revealOrder: context.revealOrder,
        },
        context,
      );
    case "OPEN_VOTING":
      return openVoting(state);
    case "LOCK_VOTING":
      return lockVoting(state);
    case "REVEAL_RESULT":
      return revealResult(state);
    case "SHOW_RESULT":
      return showResult(state);
    case "START_NEXT_ROUND":
      return startNextRound(state, context.deck, context);
    case "FINISH_GAME":
      return finishGame(state);
    case "END_GAME":
      return endGame(state);
  }
}
