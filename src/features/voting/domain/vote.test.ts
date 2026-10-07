import { describe, expect, it } from "vitest";
import { findParticipantVote, getRoundVotes, recordVote, type Vote } from "./vote";

function makeVote(overrides: Partial<Vote> = {}): Vote {
  return {
    participantId: "local:sim-viewer-1",
    roundId: "r1",
    optionId: "a",
    source: "SIMULATED",
    castAt: "2026-10-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("recordVote", () => {
  it("stores a participant's first vote", () => {
    const vote = makeVote();

    expect(recordVote([], vote)).toEqual({ votes: [vote], replacedVote: null });
  });

  it("replaces the previous vote of the same participant in the same round", () => {
    const first = makeVote({ optionId: "a" });
    const second = makeVote({ optionId: "c", castAt: "2026-10-07T12:00:05.000Z" });

    const result = recordVote([first], second);

    expect(result.votes).toEqual([second]);
    expect(result.replacedVote).toEqual(first);
  });

  it("treats choosing the same option again as a replacement", () => {
    const first = makeVote({ optionId: "b" });
    const again = makeVote({ optionId: "b", castAt: "2026-10-07T12:00:05.000Z" });

    const result = recordVote([first], again);

    expect(result.votes).toEqual([again]);
    expect(result.replacedVote).toEqual(first);
  });

  it("keeps votes of different participants side by side", () => {
    const viewerOne = makeVote({ participantId: "local:sim-viewer-1" });
    const viewerTwo = makeVote({ participantId: "local:sim-viewer-2", optionId: "b" });

    expect(recordVote([viewerOne], viewerTwo)).toEqual({ votes: [viewerOne, viewerTwo], replacedVote: null });
  });

  it("keeps the same participant's votes in different rounds independent", () => {
    const roundOne = makeVote({ roundId: "r1" });
    const roundTwo = makeVote({ roundId: "r2", optionId: "c" });

    expect(recordVote([roundOne], roundTwo)).toEqual({ votes: [roundOne, roundTwo], replacedVote: null });
  });

  it("does not mutate the given votes", () => {
    const votes = [makeVote()];
    const votesBefore = structuredClone(votes);

    recordVote(votes, makeVote({ optionId: "c" }));

    expect(votes).toEqual(votesBefore);
  });
});

describe("getRoundVotes", () => {
  it("returns only the votes of the given round", () => {
    const roundOne = makeVote({ roundId: "r1" });
    const roundTwo = makeVote({ roundId: "r2" });

    expect(getRoundVotes([roundOne, roundTwo], "r2")).toEqual([roundTwo]);
  });
});

describe("findParticipantVote", () => {
  const host = makeVote({ participantId: "local:host", source: "HOST", optionId: "b" });
  const viewer = makeVote({ participantId: "local:sim-viewer-1" });

  it("finds a participant's vote in a round", () => {
    expect(findParticipantVote([viewer, host], "r1", "local:host")).toEqual(host);
  });

  it("returns null when the participant did not vote in that round", () => {
    expect(findParticipantVote([viewer, host], "r2", "local:host")).toBeNull();
    expect(findParticipantVote([viewer], "r1", "local:host")).toBeNull();
  });
});
