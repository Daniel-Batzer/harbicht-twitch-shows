import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { REVEAL_TIMING } from "./round-presentation";
import styles from "./ResultMeter.module.scss";

type ResultMeterProps = {
  voteCount: number;
  /** Rounded per option; the sum may be 99 or 101 (Decision 043). */
  percentage: number;
  totalVotes: number;
  /** Seconds after the phase starts when the bar starts to fill; until then the meter shows "?". */
  revealAt: number;
};

const FILL_EASE = [0.22, 1, 0.36, 1] as const;

// The bar fills and the percentage counts up in sync. Both run on Motion
// values, so the count-up does not re-render React on every frame.
export function ResultMeter({ voteCount, percentage, totalVotes, revealAt }: ResultMeterProps) {
  const reduceMotion = useReducedMotion();
  const countedPercentage = useMotionValue(0);
  const shownPercentage = useTransform(countedPercentage, (value) => Math.round(value));

  useEffect(() => {
    // MotionConfig only covers motion components; this standalone animation
    // checks the reduced-motion preference itself and then jumps to the number.
    const controls = animate(countedPercentage, percentage, {
      delay: revealAt,
      duration: reduceMotion ? 0 : REVEAL_TIMING.fillDuration,
      ease: FILL_EASE,
    });
    return () => controls.stop();
  }, [countedPercentage, percentage, revealAt, reduceMotion]);

  const fade = { duration: 0.15, delay: revealAt };

  return (
    <span className={styles.meter}>
      <span className={styles.numbers}>
        <motion.span
          className={styles.mystery}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={fade}
          aria-hidden
        >
          ?
        </motion.span>
        <motion.span className={styles.percentage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
          <motion.span>{shownPercentage}</motion.span>%
        </motion.span>
      </span>

      <motion.span
        className={styles.votes}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        // The count follows once the bar has landed.
        transition={{ duration: 0.3, delay: revealAt + (totalVotes === 0 ? 0 : REVEAL_TIMING.fillDuration) }}
      >
        {totalVotes === 0 ? "No votes" : `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`}
      </motion.span>

      <span className={styles.track}>
        <motion.span
          className={styles.fill}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: percentage / 100 }}
          transition={{ delay: revealAt, duration: REVEAL_TIMING.fillDuration, ease: FILL_EASE }}
        />
      </span>
    </span>
  );
}
