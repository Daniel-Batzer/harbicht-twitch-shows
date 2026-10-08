import { describe, expect, it } from "vitest";
import type { Question } from "../../questions/domain/question";
import type { CurrentRound, GameSession, GameState, RoundInProgressState, RoundPhase } from "./game-state";
import {
  createVotingTimer,
  hasCountdownEnded,
  isReceivedInTime,
  isValidVotingDuration,
  settleVotingDeadline,
  type VotingTimer,
} from "./voting-timer";

const OPENED_AT_MS = 1_000_000;
const DURATION_SECONDS = 30;
const GRACE_MS = 3000;
const ENDS_AT_MS = OPENED_AT_MS + DURATION_SECONDS * 1000;
const CLOSES_AT_MS = ENDS_AT_MS + GRACE_MS;

const timer: VotingTimer = createVotingTimer(DURATION_SECONDS, GRACE_MS, OPENED_AT_MS);

const question: Question = {
  id: "q1",
  prompt: "Prompt?",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
};

const session: GameSession = {
  id: "s1",
  deckId: "deck",
  totalRounds: 5,
  playedQuestionIds: ["q1"],
  hostParticipantId: "local:host",
  votes: [],
  revealOrder: "AUDIENCE_FIRST",
  sharedChatVotingMode: "OWN_CHANNEL_ONLY",
  votingDurationSeconds: DURATION_SECONDS,
  voteGracePeriodMs: GRACE_MS,
};

function roundState(status: RoundPhase, votingTimer: VotingTimer | null = timer): RoundInProgressState {
  const currentRound: CurrentRound = { id: "r1", number: 1, question, votingTimer, votingClosedBy: null };
  return { status, session, currentRound };
}

describe("createVotingTimer", () => {
  it("places the countdown's end and the lock after the opening time", () => {
    expect(timer).toEqual({
      durationSeconds: DURATION_SECONDS,
      startedAtMs: OPENED_AT_MS,
      endsAtMs: ENDS_AT_MS,
      closesAtMs: CLOSES_AT_MS,
    });
  });

  it("closes exactly when the countdown ends without a grace period", () => {
    const withoutGrace = createVotingTimer(10, 0, OPENED_AT_MS);

    expect(withoutGrace.closesAtMs).toBe(withoutGrace.endsAtMs);
  });
});

describe("isValidVotingDuration", () => {
  it.each([null, 1, 30, 600])("accepts %s", (durationSeconds) => {
    expect(isValidVotingDuration(durationSeconds)).toBe(true);
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (durationSeconds) => {
    expect(isValidVotingDuration(durationSeconds)).toBe(false);
  });
});

describe("isReceivedInTime", () => {
  it.each([
    { at: "opening", receivedAtMs: OPENED_AT_MS, inTime: true },
    { at: "the countdown's end", receivedAtMs: ENDS_AT_MS, inTime: true },
    { at: "the grace period", receivedAtMs: ENDS_AT_MS + 1500, inTime: true },
    { at: "1 ms before the lock", receivedAtMs: CLOSES_AT_MS - 1, inTime: true },
    { at: "the lock", receivedAtMs: CLOSES_AT_MS, inTime: false },
    { at: "after the lock", receivedAtMs: CLOSES_AT_MS + 1, inTime: false },
  ])("a vote received at $at is in time: $inTime", ({ receivedAtMs, inTime }) => {
    expect(isReceivedInTime(timer, receivedAtMs)).toBe(inTime);
  });
});

describe("hasCountdownEnded", () => {
  it("is false before the countdown's end and true from it on", () => {
    expect(hasCountdownEnded(timer, ENDS_AT_MS - 1)).toBe(false);
    expect(hasCountdownEnded(timer, ENDS_AT_MS)).toBe(true);
    expect(hasCountdownEnded(timer, ENDS_AT_MS + 1500)).toBe(true);
  });
});

describe("settleVotingDeadline", () => {
  it.each([OPENED_AT_MS, ENDS_AT_MS, CLOSES_AT_MS - 1])("returns the same state object at %s", (nowMs) => {
    const state = roundState("VOTING");

    expect(settleVotingDeadline(state, nowMs)).toBe(state);
  });

  it("locks voting at the deadline and records that the timer closed it", () => {
    const state = roundState("VOTING");

    const settled = settleVotingDeadline(state, CLOSES_AT_MS);

    expect(settled).toEqual({
      ...state,
      status: "LOCKED",
      currentRound: { ...state.currentRound, votingClosedBy: "TIMER" },
    });
  });

  it("locks at the same instant however late it runs, and only once", () => {
    const settled = settleVotingDeadline(roundState("VOTING"), CLOSES_AT_MS + 60_000);

    expect(settled.status).toBe("LOCKED");
    expect(settleVotingDeadline(settled, CLOSES_AT_MS + 120_000)).toBe(settled);
  });

  it("never locks a round without a timer", () => {
    const state = roundState("VOTING", null);

    expect(settleVotingDeadline(state, CLOSES_AT_MS + 60_000)).toBe(state);
  });

  it.each(["INTRO", "LOCKED", "REVEAL", "RESULT"] as const)("leaves %s untouched", (status) => {
    const state = roundState(status);

    expect(settleVotingDeadline(state, CLOSES_AT_MS + 60_000)).toBe(state);
  });

  it("leaves IDLE untouched", () => {
    const state: GameState = { status: "IDLE" };

    expect(settleVotingDeadline(state, CLOSES_AT_MS)).toBe(state);
  });
});
