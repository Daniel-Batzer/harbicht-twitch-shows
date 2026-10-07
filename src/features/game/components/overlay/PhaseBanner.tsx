import type { RoundPhase } from "../../domain/game-state";
import styles from "./PhaseBanner.module.scss";

type PhaseBannerProps = {
  phase: RoundPhase;
};

// REVEAL and RESULT are placeholders until votes exist (Phase 3) and the
// reveal sequence is built (Phase 4).
const bannerTexts: Record<RoundPhase, string | null> = {
  INTRO: null,
  VOTING: "Voting open",
  LOCKED: "Voting closed",
  REVEAL: "And the answer is…",
  RESULT: "Result",
};

export function PhaseBanner({ phase }: PhaseBannerProps) {
  const text = bannerTexts[phase];
  if (!text) return null;

  // Keyed by phase so the entrance replays on every phase change.
  return (
    <p key={phase} className={styles.banner} data-phase={phase}>
      {text}
    </p>
  );
}
