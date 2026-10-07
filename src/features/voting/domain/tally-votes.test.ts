import { describe, expect, it } from "vitest";
import type { QuestionOption } from "../../questions/domain/question";
import { tallyVotes } from "./tally-votes";
import type { Vote } from "./vote";

const options: QuestionOption[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];

function makeVote(participantId: string, optionId: string, source: Vote["source"] = "SIMULATED"): Vote {
  return { participantId, optionId, source, roundId: "r1", castAt: "2026-10-07T12:00:00.000Z" };
}

describe("tallyVotes", () => {
  it("returns zero for every option and no winner when nobody voted", () => {
    expect(tallyVotes(options, [])).toEqual({
      totalVotes: 0,
      options: [
        { optionId: "a", voteCount: 0 },
        { optionId: "b", voteCount: 0 },
        { optionId: "c", voteCount: 0 },
      ],
      winningOptionIds: [],
    });
  });

  it("counts votes per option in question order, including options without votes", () => {
    const votes = [makeVote("p1", "c"), makeVote("p2", "a"), makeVote("p3", "c")];

    expect(tallyVotes(options, votes)).toEqual({
      totalVotes: 3,
      options: [
        { optionId: "a", voteCount: 1 },
        { optionId: "b", voteCount: 0 },
        { optionId: "c", voteCount: 2 },
      ],
      winningOptionIds: ["c"],
    });
  });

  it("reports every option with the highest count on a tie", () => {
    const votes = [makeVote("p1", "a"), makeVote("p2", "b"), makeVote("p3", "c"), makeVote("p4", "b"), makeVote("p5", "a")];

    expect(tallyVotes(options, votes).winningOptionIds).toEqual(["a", "b"]);
  });

  it("counts the host vote like any other vote", () => {
    const votes = [makeVote("local:host", "b", "HOST"), makeVote("p1", "a")];

    const tally = tallyVotes(options, votes);

    expect(tally.totalVotes).toBe(2);
    expect(tally.options[1]).toEqual({ optionId: "b", voteCount: 1 });
    expect(tally.winningOptionIds).toEqual(["a", "b"]);
  });
});
