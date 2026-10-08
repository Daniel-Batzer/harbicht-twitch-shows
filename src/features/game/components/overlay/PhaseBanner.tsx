import { AnimatePresence, motion, type Transition } from "motion/react";
import type { BannerLine, BannerPresentation } from "./round-presentation";
import styles from "./PhaseBanner.module.scss";

type PhaseBannerProps = {
  /** Changes with every phase, so each phase gets a fresh entrance. */
  phaseKey: string;
  banner: BannerPresentation | null;
};

const POP: Transition = { type: "spring", stiffness: 420, damping: 18 };

// One hard shake after the line has landed; it is over before the spotlight comes on.
const SHAKE_KEYFRAMES = { x: [0, -12, 12, -12, 12, -8, 8, 0], rotate: [0, -3, 3, -3, 3, -2, 2, 0] };
const SHAKE_TRANSITION: Transition = { duration: 0.6, ease: "easeInOut" };
const SHAKE_DELAY = 0.35;

type BannerTextProps = {
  line: BannerLine;
  /** Seconds after the phase starts. */
  at: number;
  /** The lead pops up from small; the payoff slams down from large. */
  entrance: "pop" | "slam";
};

function BannerText({ line, at, entrance }: BannerTextProps) {
  const shakes = line.effect === "SHAKE";

  return (
    <motion.p
      className={styles.line}
      initial={{ opacity: 0, scale: entrance === "pop" ? 0.6 : 1.6 }}
      animate={shakes ? { opacity: 1, scale: 1, ...SHAKE_KEYFRAMES } : { opacity: 1, scale: 1 }}
      transition={{
        default: { ...POP, delay: at },
        opacity: { duration: 0.12, delay: at },
        x: { ...SHAKE_TRANSITION, delay: at + SHAKE_DELAY },
        rotate: { ...SHAKE_TRANSITION, delay: at + SHAKE_DELAY },
      }}
    >
      {/* Looping effects (pulse, drumroll) live in SCSS on this inner element, apart from Motion's transforms. */}
      <span className={styles.pill} data-tone={line.tone} data-effect={line.effect}>
        {line.text}
      </span>
    </motion.p>
  );
}

// The banner names the phase or the reveal moment; numbers and the host's
// pick themselves are shown on the answer cards. What it says and when the
// payoff replaces the lead comes from getRoundPresentation.
export function PhaseBanner({ phaseKey, banner }: PhaseBannerProps) {
  return (
    <AnimatePresence mode="wait">
      {banner && (
        <motion.div
          key={phaseKey}
          className={styles.banner}
          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
        >
          {/* The lead makes room once the payoff arrives. */}
          <motion.div
            className={styles.slot}
            initial={{ opacity: 1, scale: 1 }}
            animate={banner.payoff ? { opacity: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
            transition={{ delay: banner.payoff?.at ?? 0, duration: 0.2 }}
          >
            <BannerText line={banner.lead} at={0} entrance="pop" />
          </motion.div>

          {banner.payoff && (
            <div className={styles.slot}>
              <BannerText line={banner.payoff} at={banner.payoff.at} entrance="slam" />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
