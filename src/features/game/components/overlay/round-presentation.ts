import type { QuestionOption } from "../../../questions/domain/question";
import {
  getRevealedHostPick,
  getRevealedResult,
  type HostPickSnapshot,
  type RoundPhaseSnapshot,
  type RoundResultSnapshot,
} from "../../game-snapshot";

// How the overlay presents a round phase, derived from the public snapshot
// (Decision 045). Kept apart from the components so the choreography rules
// are testable; the components only turn this into Motion targets and delays.
//
// Every time below is in seconds from the moment the overlay receives the
// phase. A beat that an earlier phase already uncovered gets time 0: elements
// that are already on screen stay as they are, and elements that mount late
// (overlay reload, a phase skipped between two polls) appear right away.

export const REVEAL_TIMING = {
  /** Suspense before the bars start to fill. */
  distributionAt: 1.6,
  /** How long one bar takes to fill and count up. */
  fillDuration: 1.2,
  /** Bars fill one after the other in option order, never by rank. */
  fillStagger: 0.15,
  /** The host's sash lands; the lead banner has finished shaking by then. */
  hostPickAt: 1.4,
  /** The spotlight comes on this long before the sash lands. */
  spotlightLead: 0.4,
  /** Time the sash needs to land and wobble before the next beat. */
  hostPickSettle: 1.2,
  /** A lead line that no card beat follows stays alone this long. */
  leadHold: 1.4,
  /** Pause between the last bar landing and the crowning. */
  crownPause: 0.3,
  /** The banner payoff follows its beat by this much. */
  payoffDelay: 0.3,
  /** In HOST_FIRST RESULT the stepped-back cards return so their bars are readable. */
  focusReturnAt: 0.3,
} as const;

/** Colors map to the answer slot palette in SCSS. */
export type BannerTone = "teal" | "orange" | "gold" | "pink" | "muted";

/** PULSE and DRUMROLL loop while the line is up; SHAKE plays once, hard. */
export type BannerEffect = "NONE" | "PULSE" | "DRUMROLL" | "SHAKE";

export type BannerLine = {
  text: string;
  tone: BannerTone;
  effect: BannerEffect;
};

export type BannerPresentation = {
  /** Shown when the phase starts. */
  lead: BannerLine;
  /** Replaces the lead once the phase's last beat has landed. */
  payoff: (BannerLine & { at: number }) | null;
};

/** NORMAL: full color. LOCKED: voting closed. BACK: the card steps back for others. */
export type CardFocus = "NORMAL" | "LOCKED" | "BACK";

export type FocusStep = { at: number; focus: CardFocus };

export type AnswerCardPresentation = {
  option: QuestionOption;
  /** The option's audience numbers once uncovered; `revealAt` is when its bar starts to fill. */
  result: { voteCount: number; percentage: number; totalVotes: number; revealAt: number } | null;
  /** Only on the host's uncovered pick. */
  hostPick: { displayName: string; spotlightAt: number; sashAt: number } | null;
  /** When this card is crowned; null unless it is a winner and this phase crowns. */
  crownAt: number | null;
  /** How the card's focus changes during the phase, in time order, starting at 0. */
  focusSteps: FocusStep[];
};

export type RoundPresentation = {
  /** null in INTRO. */
  banner: BannerPresentation | null;
  /** null in INTRO: answers appear when voting opens (ARCHITECTURE §22). */
  cards: AnswerCardPresentation[] | null;
};

/** When each part of the outcome appears in this phase; null while it stays hidden. */
type RevealBeats = {
  distributionAt: number | null;
  /** null also when the host did not vote. */
  hostPickAt: number | null;
  /** Only RESULT crowns, and only if there are winners. */
  crownAt: number | null;
};

const NO_BEATS: RevealBeats = { distributionAt: null, hostPickAt: null, crownAt: null };

/** When the last bar has finished filling. */
function fillEndsAt(optionCount: number): number {
  const { distributionAt, fillDuration, fillStagger } = REVEAL_TIMING;
  return distributionAt + fillDuration + fillStagger * (optionCount - 1);
}

function hasWinners(result: RoundResultSnapshot): boolean {
  return result.winningOptionIds.length > 0;
}

// The winner crowning is always the last beat of RESULT, in both reveal
// orders, and never part of REVEAL (Decision 045).
function getRevealBeats(snapshot: RoundPhaseSnapshot): RevealBeats {
  switch (snapshot.status) {
    case "INTRO":
    case "VOTING":
    case "LOCKED":
      return NO_BEATS;

    case "REVEAL":
      return snapshot.revealOrder === "AUDIENCE_FIRST"
        ? { ...NO_BEATS, distributionAt: REVEAL_TIMING.distributionAt }
        : { ...NO_BEATS, hostPickAt: snapshot.host.optionId === null ? null : REVEAL_TIMING.hostPickAt };

    case "RESULT": {
      const hostVoted = snapshot.host.optionId !== null;
      const canCrown = hasWinners(snapshot.result);

      if (snapshot.revealOrder === "AUDIENCE_FIRST") {
        // The distribution is already on screen; the host's pick is new.
        const crownAt = hostVoted ? REVEAL_TIMING.hostPickAt + REVEAL_TIMING.hostPickSettle : REVEAL_TIMING.leadHold;
        return {
          distributionAt: 0,
          hostPickAt: hostVoted ? REVEAL_TIMING.hostPickAt : null,
          crownAt: canCrown ? crownAt : null,
        };
      }

      // HOST_FIRST: the host's pick is already on screen; the distribution is new.
      const optionCount = snapshot.round.question.options.length;
      return {
        distributionAt: REVEAL_TIMING.distributionAt,
        hostPickAt: hostVoted ? 0 : null,
        crownAt: canCrown ? fillEndsAt(optionCount) + REVEAL_TIMING.crownPause : null,
      };
    }
  }
}

const NO_VOTES_LINE: BannerLine = { text: "No votes this round", tone: "muted", effect: "NONE" };

function suspenseLine(): BannerLine {
  return { text: "And chat says…", tone: "orange", effect: "DRUMROLL" };
}

function hostLeadLine(host: HostPickSnapshot): BannerLine {
  return host.optionId === null
    ? { text: `${host.displayName} sat this one out`, tone: "muted", effect: "NONE" }
    : { text: `${host.displayName} picked…`, tone: "gold", effect: "SHAKE" };
}

/** The round's last word in RESULT. */
function verdictLine(hostPickedWinner: boolean | null, host: HostPickSnapshot): BannerLine {
  if (hostPickedWinner === null) return { text: "Chat has spoken!", tone: "pink", effect: "NONE" };
  return hostPickedWinner
    ? { text: `Chat agrees with ${host.displayName}!`, tone: "gold", effect: "SHAKE" }
    : { text: `Chat disagrees with ${host.displayName}!`, tone: "pink", effect: "SHAKE" };
}

function getBanner(snapshot: RoundPhaseSnapshot, beats: RevealBeats): BannerPresentation | null {
  switch (snapshot.status) {
    case "INTRO":
      return null;
    case "VOTING":
      return { lead: { text: "Voting open", tone: "teal", effect: "PULSE" }, payoff: null };
    case "LOCKED":
      // Who closed voting is part of the snapshot; the timer's deadline itself never reaches this module.
      return snapshot.votingClosedBy === "TIMER"
        ? { lead: { text: "Time's up!", tone: "orange", effect: "SHAKE" }, payoff: null }
        : { lead: { text: "Voting closed", tone: "muted", effect: "NONE" }, payoff: null };

    case "REVEAL": {
      if (snapshot.revealOrder === "AUDIENCE_FIRST") {
        // The numbers follow the suspense line; the payoff waits until every bar has landed.
        const at = fillEndsAt(snapshot.round.question.options.length);
        const payoff: BannerLine =
          snapshot.result.totalVotes === 0
            ? NO_VOTES_LINE
            : { text: "The votes are in!", tone: "orange", effect: "NONE" };
        return { lead: suspenseLine(), payoff: { ...payoff, at } };
      }

      const lead = hostLeadLine(snapshot.host);
      return beats.hostPickAt === null
        ? { lead, payoff: { text: "It's all up to chat!", tone: "orange", effect: "NONE", at: REVEAL_TIMING.leadHold } }
        : {
            lead,
            payoff: {
              text: "Will chat agree?",
              tone: "gold",
              effect: "NONE",
              at: beats.hostPickAt + REVEAL_TIMING.hostPickSettle,
            },
          };
    }

    case "RESULT": {
      const lead = snapshot.revealOrder === "AUDIENCE_FIRST" ? hostLeadLine(snapshot.host) : suspenseLine();
      if (beats.crownAt !== null) {
        const verdict = verdictLine(snapshot.hostPickedWinner, snapshot.host);
        return { lead, payoff: { ...verdict, at: beats.crownAt + REVEAL_TIMING.payoffDelay } };
      }
      // Nobody voted, so nothing can be crowned.
      const at =
        snapshot.revealOrder === "AUDIENCE_FIRST"
          ? REVEAL_TIMING.leadHold
          : fillEndsAt(snapshot.round.question.options.length);
      return { lead, payoff: { ...NO_VOTES_LINE, at } };
    }
  }
}

/** Keeps only the steps that change the focus. */
function withoutRepeats(steps: FocusStep[]): FocusStep[] {
  return steps.filter((step, index) => index === 0 || step.focus !== steps[index - 1].focus);
}

function getFocusSteps(
  snapshot: RoundPhaseSnapshot,
  beats: RevealBeats,
  { isHostPick, isWinner }: { isHostPick: boolean; isWinner: boolean },
): FocusStep[] {
  if (snapshot.status === "VOTING") return [{ at: 0, focus: "NORMAL" }];
  if (snapshot.status === "LOCKED") return [{ at: 0, focus: "LOCKED" }];

  const { hostPickAt, crownAt } = beats;
  // The host's pick was uncovered in the previous phase (HOST_FIRST RESULT):
  // the other cards start stepped back and return for the distribution.
  const startsBack = hostPickAt === 0 && !isHostPick;
  const steps: FocusStep[] = [{ at: 0, focus: startsBack ? "BACK" : "NORMAL" }];

  if (startsBack) steps.push({ at: REVEAL_TIMING.focusReturnAt, focus: "NORMAL" });

  // Spotlight moment: everything but the host's pick steps back.
  if (hostPickAt !== null && hostPickAt > 0 && !isHostPick) {
    steps.push({ at: hostPickAt - REVEAL_TIMING.spotlightLead, focus: "BACK" });
  }

  // Final state: only winners and the host's pick stay lit.
  if (crownAt !== null) steps.push({ at: crownAt, focus: isWinner || isHostPick ? "NORMAL" : "BACK" });

  return withoutRepeats(steps);
}

export function getRoundPresentation(snapshot: RoundPhaseSnapshot): RoundPresentation {
  const beats = getRevealBeats(snapshot);
  const banner = getBanner(snapshot, beats);
  if (snapshot.status === "INTRO") return { banner, cards: null };

  // What the snapshot uncovers decides what may be shown at all (Decision 044);
  // the beats only decide when.
  const result = getRevealedResult(snapshot);
  const host = getRevealedHostPick(snapshot);

  const cards = snapshot.round.question.options.map((option, index): AnswerCardPresentation => {
    const optionResult = result?.options.find((entry) => entry.optionId === option.id);
    const isHostPick = host !== null && host.optionId === option.id;
    const isWinner = result !== null && result.winningOptionIds.includes(option.id);
    const { distributionAt, hostPickAt, crownAt } = beats;

    return {
      option,
      result:
        result && optionResult && distributionAt !== null
          ? {
              voteCount: optionResult.voteCount,
              percentage: optionResult.percentage,
              totalVotes: result.totalVotes,
              // Uncovered earlier: no stagger, everything is already in place.
              revealAt: distributionAt === 0 ? 0 : distributionAt + index * REVEAL_TIMING.fillStagger,
            }
          : null,
      hostPick:
        host && isHostPick && hostPickAt !== null
          ? {
              displayName: host.displayName,
              spotlightAt: Math.max(0, hostPickAt - REVEAL_TIMING.spotlightLead),
              sashAt: hostPickAt,
            }
          : null,
      crownAt: isWinner ? crownAt : null,
      focusSteps: getFocusSteps(snapshot, beats, { isHostPick, isWinner }),
    };
  });

  return { banner, cards };
}
