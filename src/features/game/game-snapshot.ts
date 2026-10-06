import type { QuestionOption } from "../questions/domain/question";
import type { GameState } from "./domain/game-state";

// Plain JSON view of the game shared by /host and /overlay. This is the
// contract that survives a future transport change (Decision 041): only how
// the overlay receives it changes, not its shape.

export type QuestionSnapshot = {
  id: string;
  prompt: string;
  context: string | null;
  options: QuestionOption[];
};

export type GameSnapshot =
  | { status: "IDLE" }
  | { status: "INTRO"; roundId: string; roundNumber: number; question: QuestionSnapshot };

export function toGameSnapshot(state: GameState): GameSnapshot {
  if (state.status === "IDLE") return { status: "IDLE" };

  const { currentRound } = state;
  return {
    status: "INTRO",
    roundId: currentRound.id,
    roundNumber: currentRound.number,
    question: {
      id: currentRound.question.id,
      prompt: currentRound.question.prompt,
      context: currentRound.question.context ?? null,
      options: currentRound.question.options,
    },
  };
}
