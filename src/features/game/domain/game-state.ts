import type { Deck, Question } from "../../questions/domain/question";
import { selectRandomQuestion } from "../../questions/domain/select-random-question";

// Slice 1 implements only IDLE ↔ INTRO. The remaining states of the planned
// machine (VOTING, LOCKED, REVEAL, RESULT, FINISHED) arrive in Phase 2.

export type CurrentRound = {
  id: string;
  number: number;
  question: Question;
};

export type GameState =
  | { status: "IDLE" }
  | { status: "INTRO"; sessionId: string; deckId: string; currentRound: CurrentRound };

export type TransitionFailureReason = "GAME_ALREADY_RUNNING" | "NO_GAME_RUNNING" | "DECK_EMPTY";

export type TransitionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: TransitionFailureReason };

/** Side effects the domain needs but must not own (randomness, id generation). */
export type StartGameDependencies = {
  randomNumber: () => number;
  createId: () => string;
};

export const initialGameState: GameState = { status: "IDLE" };

export function startGame(
  state: GameState,
  deck: Deck,
  dependencies: StartGameDependencies,
): TransitionResult {
  if (state.status !== "IDLE") return { ok: false, reason: "GAME_ALREADY_RUNNING" };

  const question = selectRandomQuestion(deck.questions, dependencies.randomNumber());
  if (!question) return { ok: false, reason: "DECK_EMPTY" };

  return {
    ok: true,
    state: {
      status: "INTRO",
      sessionId: dependencies.createId(),
      deckId: deck.id,
      currentRound: { id: dependencies.createId(), number: 1, question },
    },
  };
}

export function endGame(state: GameState): TransitionResult {
  if (state.status === "IDLE") return { ok: false, reason: "NO_GAME_RUNNING" };

  return { ok: true, state: initialGameState };
}
