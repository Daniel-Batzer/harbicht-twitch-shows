import type { GameState } from "./game-state";

// The optional voting timer (Decisions 016, 047). It is data, not a running
// timeout: the round stores absolute deadlines in server time, and whoever
// reads the state next settles it against the current time. closesAtMs is the
// logical deadline. The stored VOTING → LOCKED transition is materialized on
// the next access at or after it, not at that instant. The domain never reads
// the clock; every function here takes the time as an argument.
//
//   startedAtMs ── durationSeconds ──▶ endsAtMs ── grace ──▶ closesAtMs
//                                      countdown shows 0      voting closed (logically)
//
// Between endsAtMs and closesAtMs the round is still VOTING. The grace period
// catches votes that viewers sent while their (delayed) stream still showed
// time left. It is not a state of its own and is never shown.

export type VotingTimer = {
  durationSeconds: number;
  /** Server time (epoch ms) when voting opened. */
  startedAtMs: number;
  /** The countdown shows zero here. From here on the timer can no longer be stopped. */
  endsAtMs: number;
  /** endsAtMs plus the grace period: the logical deadline. Votes received before this instant count. */
  closesAtMs: number;
};

/** Who closed voting: the host with LOCK_VOTING, or the timer at its deadline. */
export type VotingClosedBy = "HOST" | "TIMER";

export function isValidVotingDuration(durationSeconds: number | null): boolean {
  return durationSeconds === null || (Number.isInteger(durationSeconds) && durationSeconds > 0);
}

export function createVotingTimer(durationSeconds: number, gracePeriodMs: number, nowMs: number): VotingTimer {
  const endsAtMs = nowMs + durationSeconds * 1000;
  return { durationSeconds, startedAtMs: nowMs, endsAtMs, closesAtMs: endsAtMs + gracePeriodMs };
}

/** The lock boundary is exclusive: a vote received exactly at closesAtMs is too late. */
export function isReceivedInTime(timer: VotingTimer, receivedAtMs: number): boolean {
  return receivedAtMs < timer.closesAtMs;
}

/** Once the countdown has reached zero, the deadline is committed and the host can no longer stop the timer. */
export function hasCountdownEnded(timer: VotingTimer, nowMs: number): boolean {
  return nowMs >= timer.endsAtMs;
}

/**
 * Applies the one transition the timer owns: VOTING → LOCKED once closesAtMs
 * has passed. Returns the given state object unchanged in every other case,
 * so callers can tell by reference whether anything happened.
 */
export function settleVotingDeadline(state: GameState, nowMs: number): GameState {
  if (state.status !== "VOTING") return state;

  const timer = state.currentRound.votingTimer;
  if (!timer || isReceivedInTime(timer, nowMs)) return state;

  return { ...state, status: "LOCKED", currentRound: { ...state.currentRound, votingClosedBy: "TIMER" } };
}
