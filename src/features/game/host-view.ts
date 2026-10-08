import { findParticipantVote, getRoundVotes } from "../voting/domain/vote";
import type { GameState, RevealOrder, SharedChatVotingMode } from "./domain/game-state";

// HOST-ONLY view of the current round. Unlike the public GameSnapshot it may
// contain data that must stay hidden from the overlay while voting runs (the
// vote count and the host's own choice), so it is only rendered by the /host
// server component and never served by the public API route.
// Which parts the host UI shows in which phase is up to the UI.

export type HostRoundView = {
  /** Effective votes in the current round, the host's included. */
  voteCount: number;
  /** The host's current choice in this round, or null if they have not voted. */
  hostOptionId: string | null;
  /** The session's reveal order, so the host knows what REVEAL will uncover before it happens. */
  revealOrder: RevealOrder;
  /** Whether chat votes from Shared Chat partner channels count in this session. */
  sharedChatVotingMode: SharedChatVotingMode;
  /** The session's voting duration; null when the host locks by hand. */
  votingDurationSeconds: number | null;
};

/** Available in every round phase; null only when no round is in progress (IDLE, FINISHED). */
export function toHostRoundView(state: GameState): HostRoundView | null {
  if (state.status === "IDLE" || state.status === "FINISHED") return null;

  const { session, currentRound } = state;
  const hostVote = findParticipantVote(session.votes, currentRound.id, session.hostParticipantId);
  return {
    voteCount: getRoundVotes(session.votes, currentRound.id).length,
    hostOptionId: hostVote?.optionId ?? null,
    revealOrder: session.revealOrder,
    sharedChatVotingMode: session.sharedChatVotingMode,
    votingDurationSeconds: session.votingDurationSeconds,
  };
}
