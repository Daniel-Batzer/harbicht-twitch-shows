import { describe, expect, it } from "vitest";
import { COUNTDOWN_PRESENTATION, getCountdownDisplay } from "./voting-countdown";

const STARTED_AT_MS = 1_000_000;
const timer = { durationSeconds: 30, endsAtMs: STARTED_AT_MS + 30_000 };

describe("getCountdownDisplay", () => {
  it("shows the full duration when voting has just opened", () => {
    expect(getCountdownDisplay(timer, STARTED_AT_MS)).toEqual({
      secondsLeft: 30,
      remainingShare: 1,
      isUrgent: false,
      isExpired: false,
    });
  });

  it("rounds the seconds up, so the last second shows 1 until the very end", () => {
    expect(getCountdownDisplay(timer, timer.endsAtMs - 29_001).secondsLeft).toBe(30);
    expect(getCountdownDisplay(timer, timer.endsAtMs - 1).secondsLeft).toBe(1);
  });

  it("drains the remaining share linearly", () => {
    expect(getCountdownDisplay(timer, STARTED_AT_MS + 15_000).remainingShare).toBe(0.5);
  });

  it("turns urgent for the last seconds only", () => {
    const urgentFromMs = COUNTDOWN_PRESENTATION.urgentFromSeconds * 1000;

    expect(getCountdownDisplay(timer, timer.endsAtMs - urgentFromMs - 1).isUrgent).toBe(false);
    expect(getCountdownDisplay(timer, timer.endsAtMs - urgentFromMs).isUrgent).toBe(true);
  });

  it.each([0, 1, 5000])("shows an expired, non-urgent zero %s ms after the end", (afterEndMs) => {
    expect(getCountdownDisplay(timer, timer.endsAtMs + afterEndMs)).toEqual({
      secondsLeft: 0,
      remainingShare: 0,
      isUrgent: false,
      isExpired: true,
    });
  });

  it("clamps a viewer clock that runs behind the server", () => {
    expect(getCountdownDisplay(timer, STARTED_AT_MS - 2000)).toMatchObject({ secondsLeft: 32, remainingShare: 1 });
  });
});
