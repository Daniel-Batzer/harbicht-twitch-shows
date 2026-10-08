"use client";

import type { VotingTimerSnapshot } from "../../game-snapshot";
import { useVotingCountdown } from "../../hooks/use-voting-countdown";
import styles from "./HostVotingCountdown.module.scss";

type HostVotingCountdownProps = {
  timer: VotingTimerSnapshot;
  /** The server allows STOP_VOTING_TIMER (only before the countdown ends). */
  canStopTimer: boolean;
  isPending: boolean;
};

/**
 * The host's view of the voting timer, rendered inside the command form so
 * "Stop timer" submits like every other command (Decision 047). Display only:
 * it never locks voting itself. Voting closes at the server's deadline. The
 * server stores LOCKED on its next access, and this panel shows it on the next refresh.
 */
export function HostVotingCountdown({ timer, canStopTimer, isPending }: HostVotingCountdownProps) {
  const display = useVotingCountdown(timer);

  return (
    <div
      className={styles.countdown}
      data-urgent={display?.isUrgent ?? false}
      data-expired={display?.isExpired ?? false}
    >
      <span className={styles.value}>
        {display ? (display.isExpired ? "Time!" : `${display.secondsLeft}s`) : "…"}
      </span>
      <span className={styles.bar} aria-hidden>
        <span className={styles.fill} style={{ scale: `${display?.remainingShare ?? 1} 1` }} />
      </span>
      <span className={styles.note}>
        {display?.isExpired
          ? "Late chat votes still count for a moment, then voting locks."
          : `${timer.durationSeconds}s timer. Voting locks when it runs out.`}
      </span>
      {/* Hidden once the countdown shows zero: from then on the deadline is committed. The domain enforces it too. */}
      {canStopTimer && display && !display.isExpired && (
        <button
          className={styles.stopButton}
          type="submit"
          name="command"
          value="STOP_VOTING_TIMER"
          disabled={isPending}
        >
          Stop timer
        </button>
      )}
    </div>
  );
}
