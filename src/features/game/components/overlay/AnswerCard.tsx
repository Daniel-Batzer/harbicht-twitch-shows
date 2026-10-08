import type { CSSProperties } from "react";
import { motion, type Transition, type Variants } from "motion/react";
import { ResultMeter } from "./ResultMeter";
import type { AnswerCardPresentation, CardFocus, FocusStep } from "./round-presentation";
import styles from "./AnswerCards.module.scss";

type AnswerCardProps = {
  card: AnswerCardPresentation;
  index: number;
};

/** Entrance when voting opens; the list staggers it (AnswerCards). */
export const answerCardEntrance: Variants = {
  hidden: { opacity: 0, y: 120, scale: 0.7 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 16 } },
};

const FOCUS_FILTERS: Record<CardFocus, string> = {
  NORMAL: "saturate(1) brightness(1)",
  LOCKED: "saturate(0.55) brightness(0.8)",
  BACK: "saturate(0.4) brightness(0.6)",
};

/** How long one focus change takes. */
const FOCUS_CHANGE_DURATION = 0.4;

const SLAM: Transition = { type: "spring", stiffness: 500, damping: 22 };
const CROWN: Transition = { type: "spring", stiffness: 320, damping: 16 };

/**
 * Turns the card's focus steps into one filter keyframe animation for the
 * phase: each step fades from the previous focus to its own, starting at its
 * time. The first keyframe is `null`, which means "wherever the card is now".
 */
function toFocusAnimation(steps: FocusStep[]) {
  const values: (string | null)[] = [null];
  const times: number[] = [0];

  steps.forEach((step, index) => {
    const lastTime = times[times.length - 1];
    // Hold the previous focus until this step starts (a step never starts before the last fade ended).
    if (index > 0 && step.at > lastTime) {
      values.push(FOCUS_FILTERS[steps[index - 1].focus]);
      times.push(step.at);
    }
    values.push(FOCUS_FILTERS[step.focus]);
    times.push(Math.max(step.at, lastTime) + FOCUS_CHANGE_DURATION);
  });

  const duration = times[times.length - 1];
  const transition: Transition = { duration, times: times.map((time) => time / duration), ease: "easeInOut" };
  return { values, transition };
}

// Everything that moves here gets its timing from the card presentation
// (round-presentation.ts); this component only maps it onto Motion.
export function AnswerCard({ card, index }: AnswerCardProps) {
  const { option, result, hostPick, crownAt } = card;
  const focus = toFocusAnimation(card.focusSteps);

  return (
    <motion.li className={styles.slot} variants={answerCardEntrance}>
      <motion.div
        className={styles.card}
        data-slot={(index % 3) + 1}
        style={{ "--slot-index": index } as CSSProperties}
        initial={{ filter: FOCUS_FILTERS.NORMAL, scale: 1, y: 0 }}
        animate={{
          filter: focus.values,
          // Winners grow a little when they are crowned.
          scale: crownAt !== null ? 1.05 : 1,
          // The sash lands with a thud.
          y: hostPick ? [0, 18, 0] : 0,
        }}
        transition={{
          filter: focus.transition,
          scale: { ...CROWN, delay: crownAt ?? 0 },
          y: { duration: 0.35, ease: "easeOut", delay: (hostPick?.sashAt ?? 0) + 0.1 },
        }}
      >
        {hostPick && (
          <motion.span
            className={styles.spotlight}
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: hostPick.spotlightAt }}
            aria-hidden
          />
        )}

        {crownAt !== null && (
          <motion.span
            className={styles.crownRing}
            initial={{ opacity: 0, scale: 1.25 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ default: { ...CROWN, delay: crownAt }, opacity: { duration: 0.15, delay: crownAt } }}
            aria-hidden
          />
        )}

        <span className={styles.badge}>{index + 1}</span>

        {hostPick && (
          <motion.span
            className={styles.hostSash}
            initial={{ opacity: 0, scale: 2.6, rotate: 14 }}
            animate={{ opacity: 1, scale: 1, rotate: 14 }}
            transition={{ default: { ...SLAM, delay: hostPick.sashAt }, opacity: { duration: 0.1, delay: hostPick.sashAt } }}
          >
            <motion.span
              className={styles.hostSashText}
              animate={{ rotate: [0, -4, 4, -3, 3, 0] }}
              transition={{ duration: 0.5, delay: hostPick.sashAt + 0.3 }}
            >
              {hostPick.displayName}&apos;s pick
            </motion.span>
          </motion.span>
        )}

        <span className={styles.label}>{option.label}</span>

        {result && (
          <ResultMeter
            voteCount={result.voteCount}
            percentage={result.percentage}
            totalVotes={result.totalVotes}
            revealAt={result.revealAt}
          />
        )}

        {crownAt !== null && (
          <motion.span
            className={styles.winnerTag}
            initial={{ opacity: 0, y: 30, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ default: { ...CROWN, delay: crownAt + 0.1 }, opacity: { duration: 0.1, delay: crownAt + 0.1 } }}
          >
            ★ Winner
          </motion.span>
        )}
      </motion.div>
    </motion.li>
  );
}
