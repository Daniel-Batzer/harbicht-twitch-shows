import { describe, expect, it } from "vitest";
import type { HostPickSnapshot, RoundPhaseSnapshot, RoundResultSnapshot, RoundSnapshot } from "../../game-snapshot";
import { getPhaseBanner } from "./phase-banner";

const round: RoundSnapshot = {
  id: "r1",
  number: 1,
  totalRounds: 5,
  question: { id: "q1", prompt: "Prompt?", context: null, options: [{ id: "a", label: "A" }] },
};
const result: RoundResultSnapshot = {
  totalVotes: 1,
  options: [{ optionId: "a", voteCount: 1, percentage: 100 }],
  winningOptionIds: ["a"],
};
const hostPicked: HostPickSnapshot = { displayName: "Louis", optionId: "a" };
const hostSkipped: HostPickSnapshot = { displayName: "Louis", optionId: null };

function banner(snapshot: RoundPhaseSnapshot) {
  return getPhaseBanner(snapshot);
}

describe("getPhaseBanner", () => {
  it("shows no banner in INTRO", () => {
    expect(banner({ status: "INTRO", round })).toBeNull();
  });

  it("names the voting phases", () => {
    expect(banner({ status: "VOTING", round })).toEqual({ text: "Voting open", shake: false });
    expect(banner({ status: "LOCKED", round })).toEqual({ text: "Voting closed", shake: false });
  });

  describe("REVEAL", () => {
    it("announces the audience result with AUDIENCE_FIRST", () => {
      expect(banner({ status: "REVEAL", revealOrder: "AUDIENCE_FIRST", round, result })).toEqual({
        text: "And chat says…",
        shake: false,
      });
    });

    it("shakes for the host's pick with HOST_FIRST", () => {
      expect(banner({ status: "REVEAL", revealOrder: "HOST_FIRST", round, host: hostPicked })).toEqual({
        text: "Louis picked…",
        shake: true,
      });
    });

    it("says when the host did not vote with HOST_FIRST", () => {
      expect(banner({ status: "REVEAL", revealOrder: "HOST_FIRST", round, host: hostSkipped })).toEqual({
        text: "Louis sat this one out",
        shake: false,
      });
    });
  });

  describe("RESULT", () => {
    it.each([
      { revealOrder: "AUDIENCE_FIRST", hostPickedWinner: true, text: "Chat agrees with Louis!", shake: true },
      { revealOrder: "AUDIENCE_FIRST", hostPickedWinner: false, text: "Chat disagrees with Louis!", shake: true },
      { revealOrder: "HOST_FIRST", hostPickedWinner: true, text: "Chat agrees with Louis!", shake: false },
      { revealOrder: "HOST_FIRST", hostPickedWinner: false, text: "Chat disagrees with Louis!", shake: false },
    ] as const)("$revealOrder, host won: $hostPickedWinner → $text", ({ revealOrder, hostPickedWinner, text, shake }) => {
      expect(banner({ status: "RESULT", revealOrder, round, result, host: hostPicked, hostPickedWinner })).toEqual({
        text,
        shake,
      });
    });

    it("falls back to a neutral line when the host did not vote", () => {
      expect(
        banner({
          status: "RESULT",
          revealOrder: "AUDIENCE_FIRST",
          round,
          result,
          host: hostSkipped,
          hostPickedWinner: null,
        }),
      ).toEqual({ text: "Chat has spoken", shake: false });
    });
  });
});
