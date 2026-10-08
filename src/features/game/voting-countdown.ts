import type { VotingTimerSnapshot } from "./game-snapshot";

// How a voting countdown looks at a given moment, for the overlay and the host
// panel (Decision 047). PRESENTATION ONLY: this reads the timer's end from the
// snapshot and the viewer's own clock. Reaching zero here changes nothing in
// the game. Voting closes logically at the server's deadline (closesAtMs); the
// server materializes LOCKED on its next access, and it reaches the overlay
// with the next snapshot.
// Separate from REVEAL_TIMING (Decision 045): neither reads the other.

export const COUNTDOWN_PRESENTATION = {
  /** The countdown turns urgent (color, pulse) for the last this many seconds. */
  urgentFromSeconds: 10,
  /** How often the displayed time is recomputed. */
  tickIntervalMs: 200,
} as const;

export type CountdownDisplay = {
  /** Whole seconds left, rounded up: shows 1 until the very end, then 0. */
  secondsLeft: number;
  /** Share of the duration still left, from 1 (just opened) to 0 (ended). */
  remainingShare: number;
  isUrgent: boolean;
  /** The countdown shows zero. Votes may still be accepted until the server locks. */
  isExpired: boolean;
};

export function getCountdownDisplay(
  timer: Pick<VotingTimerSnapshot, "durationSeconds" | "endsAtMs">,
  nowMs: number,
): CountdownDisplay {
  const remainingMs = timer.endsAtMs - nowMs;
  const isExpired = remainingMs <= 0;
  const secondsLeft = isExpired ? 0 : Math.ceil(remainingMs / 1000);
  const remainingShare = Math.min(1, Math.max(0, remainingMs / (timer.durationSeconds * 1000)));

  return {
    secondsLeft,
    remainingShare,
    isUrgent: !isExpired && secondsLeft <= COUNTDOWN_PRESENTATION.urgentFromSeconds,
    isExpired,
  };
}
