import type { QuestionOption } from "../questions/domain/question";
import { tallyVotes } from "../voting/domain/tally-votes";
import { findParticipantVote, getRoundVotes } from "../voting/domain/vote";
import type { GameState, RevealOrder, RoundInProgressState } from "./domain/game-state";
import type { VotingClosedBy, VotingTimer } from "./domain/voting-timer";

// Plain JSON view of the game shared by /host and /overlay. This is the
// contract that survives a future transport change (Decision 041): only how
// the overlay receives it changes, not its shape.
//
// It is PUBLIC (served by GET /api/game/state), so it carries no vote data
// before REVEAL (Decision 015). REVEAL uncovers either the audience result or
// the host's choice, depending on the session's reveal order; RESULT carries
// both (Decision 044). Host-only data lives in host-view.ts.
// The voting timer is public while voting runs (Decision 047), except for its
// grace period: closesAtMs is never published.

export type QuestionSnapshot = {
  id: string;
  prompt: string;
  context: string | null;
  options: QuestionOption[];
};

export type RoundSnapshot = {
  id: string;
  number: number;
  totalRounds: number;
  question: QuestionSnapshot;
};

export type OptionResultSnapshot = {
  optionId: string;
  voteCount: number;
  /** Rounded to a whole number; the sum may be 99 or 101. */
  percentage: number;
};

export type RoundResultSnapshot = {
  totalVotes: number;
  /** In question order. */
  options: OptionResultSnapshot[];
  /** Several on a tie, empty when nobody voted. */
  winningOptionIds: string[];
};

export type HostPickSnapshot = {
  displayName: string;
  /** null when the host did not vote this round. */
  optionId: string | null;
};

/** The countdown the overlay and the host render. Times are server epoch ms. */
export type VotingTimerSnapshot = Pick<VotingTimer, "durationSeconds" | "startedAtMs" | "endsAtMs">;

export type GameSnapshot =
  | { status: "IDLE" }
  | { status: "INTRO"; round: RoundSnapshot }
  | { status: "VOTING"; round: RoundSnapshot; votingTimer: VotingTimerSnapshot | null }
  | { status: "LOCKED"; round: RoundSnapshot; votingClosedBy: VotingClosedBy }
  | { status: "REVEAL"; revealOrder: "AUDIENCE_FIRST"; round: RoundSnapshot; result: RoundResultSnapshot }
  | { status: "REVEAL"; revealOrder: "HOST_FIRST"; round: RoundSnapshot; host: HostPickSnapshot }
  | {
      status: "RESULT";
      revealOrder: RevealOrder;
      round: RoundSnapshot;
      result: RoundResultSnapshot;
      host: HostPickSnapshot;
      /** Whether the host's choice is among the winners (also on a tie); null when the host did not vote. */
      hostPickedWinner: boolean | null;
    }
  | { status: "FINISHED"; roundsPlayed: number; totalRounds: number };

/** Presentation data that is not part of the game state. */
export type SnapshotPresentation = {
  hostDisplayName: string;
};

function toRoundSnapshot({ currentRound, session }: RoundInProgressState): RoundSnapshot {
  return {
    id: currentRound.id,
    number: currentRound.number,
    totalRounds: session.totalRounds,
    question: {
      id: currentRound.question.id,
      prompt: currentRound.question.prompt,
      context: currentRound.question.context ?? null,
      options: currentRound.question.options,
    },
  };
}

function toRoundResultSnapshot({ currentRound, session }: RoundInProgressState): RoundResultSnapshot {
  const tally = tallyVotes(currentRound.question.options, getRoundVotes(session.votes, currentRound.id));
  return {
    totalVotes: tally.totalVotes,
    options: tally.options.map((option) => ({
      optionId: option.optionId,
      voteCount: option.voteCount,
      percentage: tally.totalVotes === 0 ? 0 : Math.round((option.voteCount / tally.totalVotes) * 100),
    })),
    winningOptionIds: tally.winningOptionIds,
  };
}

function toHostPickSnapshot(
  { currentRound, session }: RoundInProgressState,
  presentation: SnapshotPresentation,
): HostPickSnapshot {
  const hostVote = findParticipantVote(session.votes, currentRound.id, session.hostParticipantId);
  return { displayName: presentation.hostDisplayName, optionId: hostVote?.optionId ?? null };
}

export function toGameSnapshot(state: GameState, presentation: SnapshotPresentation): GameSnapshot {
  switch (state.status) {
    case "IDLE":
      return { status: "IDLE" };

    case "FINISHED":
      return {
        status: "FINISHED",
        // Finishing is only possible from RESULT, so every played question was a completed round.
        roundsPlayed: state.session.playedQuestionIds.length,
        totalRounds: state.session.totalRounds,
      };

    // Voting is open or just closed: no totals, no host choice.
    case "INTRO":
      return { status: "INTRO", round: toRoundSnapshot(state) };

    case "VOTING": {
      const timer = state.currentRound.votingTimer;
      return {
        status: "VOTING",
        round: toRoundSnapshot(state),
        votingTimer: timer
          ? { durationSeconds: timer.durationSeconds, startedAtMs: timer.startedAtMs, endsAtMs: timer.endsAtMs }
          : null,
      };
    }

    case "LOCKED":
      return {
        status: "LOCKED",
        round: toRoundSnapshot(state),
        // Every way into LOCKED sets it; HOST is the safe reading of a missing value.
        votingClosedBy: state.currentRound.votingClosedBy ?? "HOST",
      };

    // The first half of the outcome, depending on the reveal order.
    case "REVEAL": {
      const round = toRoundSnapshot(state);
      if (state.session.revealOrder === "AUDIENCE_FIRST") {
        return { status: "REVEAL", revealOrder: "AUDIENCE_FIRST", round, result: toRoundResultSnapshot(state) };
      }
      return { status: "REVEAL", revealOrder: "HOST_FIRST", round, host: toHostPickSnapshot(state, presentation) };
    }

    case "RESULT": {
      const result = toRoundResultSnapshot(state);
      const host = toHostPickSnapshot(state, presentation);
      return {
        status: "RESULT",
        revealOrder: state.session.revealOrder,
        round: toRoundSnapshot(state),
        result,
        host,
        hostPickedWinner: host.optionId === null ? null : result.winningOptionIds.includes(host.optionId),
      };
    }
  }
}

/** The snapshot of a round in progress (INTRO to RESULT). */
export type RoundPhaseSnapshot = Extract<GameSnapshot, { round: RoundSnapshot }>;

/** The audience result, if this snapshot has uncovered it yet. */
export function getRevealedResult(snapshot: GameSnapshot): RoundResultSnapshot | null {
  return "result" in snapshot ? snapshot.result : null;
}

/** The host's choice, if this snapshot has uncovered it yet. */
export function getRevealedHostPick(snapshot: GameSnapshot): HostPickSnapshot | null {
  return "host" in snapshot ? snapshot.host : null;
}
