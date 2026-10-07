import { describe, expect, it } from "vitest";
import { pickSimulatedVotes } from "./simulated-votes";

/** Returns the given numbers in order, then repeats them. */
function sequence(...numbers: number[]): () => number {
  let index = 0;
  return () => numbers[index++ % numbers.length];
}

describe("pickSimulatedVotes", () => {
  it("picks viewers from the pool and options from the list, deterministically", () => {
    const votes = pickSimulatedVotes({
      count: 3,
      poolSize: 4,
      optionIds: ["a", "b", "c"],
      // viewer, option, viewer, option, ...
      randomNumber: sequence(0, 0, 0.5, 0.5, 0.999, 0.999),
    });

    expect(votes).toEqual([
      { viewerKey: "viewer-1", optionId: "a" },
      { viewerKey: "viewer-3", optionId: "b" },
      { viewerKey: "viewer-4", optionId: "c" },
    ]);
  });

  it("never leaves the pool or the option list", () => {
    const votes = pickSimulatedVotes({ count: 50, poolSize: 5, optionIds: ["a", "b"], randomNumber: Math.random });

    for (const vote of votes) {
      expect(["viewer-1", "viewer-2", "viewer-3", "viewer-4", "viewer-5"]).toContain(vote.viewerKey);
      expect(["a", "b"]).toContain(vote.optionId);
    }
  });

  it("returns nothing when there are no options", () => {
    expect(pickSimulatedVotes({ count: 3, poolSize: 5, optionIds: [], randomNumber: Math.random })).toEqual([]);
  });
});
