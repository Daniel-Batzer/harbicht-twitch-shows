"use client";

import { motion } from "motion/react";
import type { VotingTimerSnapshot } from "../../game-snapshot";
import { useVotingCountdown } from "../../hooks/use-voting-countdown";
import styles from "./VotingCountdown.module.scss";

type VotingCountdownProps = {
  timer: VotingTimerSnapshot;
};

// The overlay's voting countdown (Decision 047). It follows the timer's end
// from the snapshot, so a reload resumes at the right time. At zero it only
// shouts "Time!": the cards dim and the banner changes when the server's
// LOCKED snapshot arrives, after the grace period.
//
// Motion owns the badge's entrance/exit and the number pop. SCSS draws the
// ring (a stroke transition per tick) and the urgent glow on its own element.
export function VotingCountdown({ timer }: VotingCountdownProps) {
  const display = useVotingCountdown(timer);

  return (
    <motion.div
      className={styles.countdown}
      data-urgent={display?.isUrgent ?? false}
      data-expired={display?.isExpired ?? false}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{ type: "spring", stiffness: 360, damping: 20, delay: 0.3 }}
    >
      <span className={styles.glow} aria-hidden />
      <svg className={styles.ring} viewBox="0 0 200 200" aria-hidden>
        <circle className={styles.track} cx="100" cy="100" r="88" pathLength={1} />
        {display && (
          <circle
            className={styles.progress}
            cx="100"
            cy="100"
            r="88"
            pathLength={1}
            style={{ strokeDashoffset: 1 - display.remainingShare }}
          />
        )}
      </svg>
      <span className={styles.value}>
        {display &&
          (display.isExpired ? (
            <motion.span
              key="time"
              className={styles.timeUp}
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
            >
              Time!
            </motion.span>
          ) : (
            // Keyed by the second, so every new second pops in.
            <motion.span
              key={display.secondsLeft}
              initial={{ scale: display.isUrgent ? 1.5 : 1.25 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              {display.secondsLeft}
            </motion.span>
          ))}
      </span>
    </motion.div>
  );
}
