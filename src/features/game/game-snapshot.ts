import type { QuestionOption } from "../questions/domain/question";
import type { GameState, RoundPhase } from "./domain/game-state";

// Plain JSON view of the game shared by /host and /overlay. This is the
// contract that survives a future transport change (Decision 041): only how
// the overlay receives it changes, not its shape.

export type QuestionSnapshot = {
  id: string;
  prompt: string;
  context: string | null;
  options: QuestionOption[];
};

export type RoundSnapshot = {
  id: string;
  number: number;
  totalRounds: number;
  question: QuestionSnapshot;
};

export type GameSnapshot =
  | { status: "IDLE" }
  | { status: RoundPhase; round: RoundSnapshot }
  | { status: "FINISHED"; roundsPlayed: number; totalRounds: number };

export function toGameSnapshot(state: GameState): GameSnapshot {
  if (state.status === "IDLE") return { status: "IDLE" };

  if (state.status === "FINISHED") {
    return {
      status: "FINISHED",
      // Finishing is only possible from RESULT, so every played question was a completed round.
      roundsPlayed: state.session.playedQuestionIds.length,
      totalRounds: state.session.totalRounds,
    };
  }

  const { currentRound, session } = state;
  return {
    status: state.status,
    round: {
      id: currentRound.id,
      number: currentRound.number,
      totalRounds: session.totalRounds,
      question: {
        id: currentRound.question.id,
        prompt: currentRound.question.prompt,
        context: currentRound.question.context ?? null,
        options: currentRound.question.options,
      },
    },
  };
}
