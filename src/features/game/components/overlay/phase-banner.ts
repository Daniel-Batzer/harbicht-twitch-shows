import type { RoundPhaseSnapshot } from "../../game-snapshot";

// What the phase banner says, derived from the public snapshot (Decision 044).
// Kept apart from the component so the wording rules are testable.

export type PhaseBannerContent = {
  text: string;
  /** True when this phase uncovers the host's choice: the banner shakes once, hard. */
  shake: boolean;
};

export function getPhaseBanner(snapshot: RoundPhaseSnapshot): PhaseBannerContent | null {
  switch (snapshot.status) {
    case "INTRO":
      return null;
    case "VOTING":
      return { text: "Voting open", shake: false };
    case "LOCKED":
      return { text: "Voting closed", shake: false };

    case "REVEAL": {
      if (snapshot.revealOrder === "AUDIENCE_FIRST") return { text: "And chat says…", shake: false };
      const { displayName, optionId } = snapshot.host;
      return optionId === null
        ? { text: `${displayName} sat this one out`, shake: false }
        : { text: `${displayName} picked…`, shake: true };
    }

    case "RESULT": {
      const { displayName } = snapshot.host;
      if (snapshot.hostPickedWinner === null) return { text: "Chat has spoken", shake: false };
      // With AUDIENCE_FIRST the host's choice is new in RESULT, so this is its big moment.
      const shake = snapshot.revealOrder === "AUDIENCE_FIRST";
      return snapshot.hostPickedWinner
        ? { text: `Chat agrees with ${displayName}!`, shake }
        : { text: `Chat disagrees with ${displayName}!`, shake };
    }
  }
}
