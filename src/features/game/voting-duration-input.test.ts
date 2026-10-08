import { describe, expect, it } from "vitest";
import { parseVotingDurationInput, VOTING_DURATION_PRESETS } from "./voting-duration-input";

describe("parseVotingDurationInput", () => {
  it("reads NONE as no timer and ignores the custom field", () => {
    expect(parseVotingDurationInput("NONE", "abc")).toEqual({ ok: true, votingDurationSeconds: null });
  });

  it.each(VOTING_DURATION_PRESETS)("reads the %s s preset", (seconds) => {
    expect(parseVotingDurationInput(String(seconds), null)).toEqual({ ok: true, votingDurationSeconds: seconds });
  });

  it.each([
    { customSeconds: "10", expected: 10 },
    { customSeconds: "600", expected: 600 },
    { customSeconds: " 45 ", expected: 45 },
  ])("accepts a custom duration of '$customSeconds'", ({ customSeconds, expected }) => {
    expect(parseVotingDurationInput("CUSTOM", customSeconds)).toEqual({ ok: true, votingDurationSeconds: expected });
  });

  it.each(["9", "601", "0", "-30", "45.5", "1e2", "abc", ""])("rejects a custom duration of '%s'", (customSeconds) => {
    expect(parseVotingDurationInput("CUSTOM", customSeconds)).toEqual({ ok: false });
  });

  it("rejects CUSTOM without the custom field", () => {
    expect(parseVotingDurationInput("CUSTOM", null)).toEqual({ ok: false });
  });

  it.each([null, "", "45", "none", "custom", 30])("rejects the choice %s instead of falling back", (choice) => {
    expect(parseVotingDurationInput(choice, "45")).toEqual({ ok: false });
  });
});
