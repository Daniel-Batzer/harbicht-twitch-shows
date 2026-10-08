import { describe, expect, it } from "vitest";
import type { Question } from "../questions/domain/question";
import type { Vote } from "../voting/domain/vote";
import type { GameSession } from "./domain/game-state";
import { toHostRoundView } from "./host-view";

const question: Question = {
  id: "q1",
  prompt: "Prompt?",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
};

function makeVote(participantId: string, optionId: string, roundId = "r2"): Vote {
  const source = participantId === "local:host" ? "HOST" : "SIMULATED";
  return { participantId, optionId, source, roundId, castAt: "2026-10-07T12:00:00.000Z" };
}

const session: GameSession = {
  id: "s1",
  deckId: "deck",
  totalRounds: 5,
  playedQuestionIds: ["q0", "q1"],
  hostParticipantId: "local:host",
  revealOrder: "AUDIENCE_FIRST",
  votes: [
    makeVote("local:host", "a", "r1"), // earlier round, must not count
    makeVote("local:sim-viewer-1", "b", "r1"),
    makeVote("local:sim-viewer-1", "a"),
    makeVote("local:host", "b"),
  ],
};

describe("toHostRoundView", () => {
  it.each(["INTRO", "VOTING", "LOCKED", "REVEAL", "RESULT"] as const)(
    "reports the current round's vote count and the host's choice in %s",
    (status) => {
      const view = toHostRoundView({ status, session, currentRound: { id: "r2", number: 2, question } });

      expect(view).toEqual({ voteCount: 2, hostOptionId: "b", revealOrder: "AUDIENCE_FIRST" });
    },
  );

  it("reports no host choice when the host has not voted in the current round", () => {
    const view = toHostRoundView({ status: "VOTING", session, currentRound: { id: "r3", number: 3, question } });

    expect(view).toEqual({ voteCount: 0, hostOptionId: null, revealOrder: "AUDIENCE_FIRST" });
  });

  it("is null when no round is in progress", () => {
    expect(toHostRoundView({ status: "IDLE" })).toBeNull();
    expect(toHostRoundView({ status: "FINISHED", session })).toBeNull();
  });
});
