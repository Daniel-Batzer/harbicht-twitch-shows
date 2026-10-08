// Individual votes and the replacement rule (Decisions 012, 014, 043).
// Framework-free: no Next.js, React, Twitch or persistence types.

/**
 * Stable identity of whoever votes. Opaque to the domain: it is only compared,
 * never parsed. The application layer builds it (`local:host`, later
 * `twitch:<userId>`), so chat and web votes of one Twitch user share it.
 */
export type ParticipantId = string;

/**
 * The channel a vote arrived through. Whether a vote belongs to the host is
 * decided by the participant id, not by the source: the host voting in Twitch
 * chat casts a "CHAT" vote with the host's participant id.
 * Phase 12 adds "WEB".
 */
export type VoteSource = "HOST" | "SIMULATED" | "CHAT";

/** What a vote source hands to the domain; the domain decides whether it is valid. */
export type VoteInput = {
  participantId: ParticipantId;
  optionId: string;
  source: VoteSource;
};

export type Vote = VoteInput & {
  roundId: string;
  /** ISO timestamp supplied by the caller; the domain never reads the clock. */
  castAt: string;
};

export type RecordVoteResult = {
  votes: Vote[];
  /** The participant's previous vote in the same round, if this vote replaced one. */
  replacedVote: Vote | null;
};

function isSameBallot(vote: Vote, roundId: string, participantId: ParticipantId): boolean {
  return vote.roundId === roundId && vote.participantId === participantId;
}

/**
 * Adds a vote, keeping one effective vote per participant per round: an
 * existing vote of the same participant in the same round is replaced, even if
 * it chose the same option. "Latest" means the order in which votes are
 * recorded. Returns a new array; the given one is not mutated.
 */
export function recordVote(votes: readonly Vote[], vote: Vote): RecordVoteResult {
  const replacedVote = findParticipantVote(votes, vote.roundId, vote.participantId);
  const otherVotes = votes.filter((existing) => !isSameBallot(existing, vote.roundId, vote.participantId));
  return { votes: [...otherVotes, vote], replacedVote };
}

export function getRoundVotes(votes: readonly Vote[], roundId: string): Vote[] {
  return votes.filter((vote) => vote.roundId === roundId);
}

export function findParticipantVote(
  votes: readonly Vote[],
  roundId: string,
  participantId: ParticipantId,
): Vote | null {
  return votes.find((vote) => isSameBallot(vote, roundId, participantId)) ?? null;
}
