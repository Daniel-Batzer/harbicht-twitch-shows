import type { RoundPhaseSnapshot } from "../../game-snapshot";
import { getPhaseBanner } from "./phase-banner";
import styles from "./PhaseBanner.module.scss";

type PhaseBannerProps = {
  snapshot: RoundPhaseSnapshot;
};

// The banner names the phase or the reveal moment; numbers and the host's
// pick themselves are shown on the answer cards.
export function PhaseBanner({ snapshot }: PhaseBannerProps) {
  const banner = getPhaseBanner(snapshot);
  if (!banner) return null;

  // Keyed by phase so the entrance replays on every phase change.
  return (
    <p key={snapshot.status} className={styles.banner} data-phase={snapshot.status} data-shake={banner.shake}>
      {banner.text}
    </p>
  );
}
