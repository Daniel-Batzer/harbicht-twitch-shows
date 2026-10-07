import { describe, expect, it } from "vitest";
import type { Question } from "../questions/domain/question";
import type { GameSession } from "./domain/game-state";
import { toGameSnapshot } from "./game-snapshot";

const question: Question = {
  id: "q1",
  prompt: "Prompt?",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ],
};

const session: GameSession = { id: "s1", deckId: "deck", totalRounds: 5, playedQuestionIds: ["q0", "q1"] };

describe("toGameSnapshot", () => {
  it("maps IDLE", () => {
    expect(toGameSnapshot({ status: "IDLE" })).toEqual({ status: "IDLE" });
  });

  it.each(["INTRO", "VOTING", "LOCKED", "REVEAL", "RESULT"] as const)("maps %s to its round view", (status) => {
    const snapshot = toGameSnapshot({ status, session, currentRound: { id: "r2", number: 2, question } });

    expect(snapshot).toEqual({
      status,
      round: {
        id: "r2",
        number: 2,
        totalRounds: 5,
        question: { id: "q1", prompt: "Prompt?", context: null, options: question.options },
      },
    });
  });

  it("keeps an optional question context", () => {
    const snapshot = toGameSnapshot({
      status: "INTRO",
      session,
      currentRound: { id: "r2", number: 2, question: { ...question, context: "Whenever..." } },
    });

    expect(snapshot.status === "INTRO" && snapshot.round.question.context).toBe("Whenever...");
  });

  it("maps FINISHED to the number of rounds played", () => {
    expect(toGameSnapshot({ status: "FINISHED", session })).toEqual({
      status: "FINISHED",
      roundsPlayed: 2,
      totalRounds: 5,
    });
  });
});
