import { recordVote, type Vote, type VoteInput } from "../../voting/domain/vote";
import type { GameState, GameStatus } from "./game-state";
import { isReceivedInTime } from "./voting-timer";

// Voting inside the game flow (Decisions 012, 013, 043). A vote is not a game
// command: it never changes the status or the round, only the session's votes.

export type VoteFailure =
  | { reason: "VOTING_NOT_OPEN"; status: GameStatus }
  | { reason: "VOTING_DEADLINE_PASSED" }
  | { reason: "INVALID_OPTION"; optionId: string };

export type VoteResult =
  | { ok: true; state: GameState; replacedVote: Vote | null }
  | { ok: false; failure: VoteFailure };

/**
 * When the server received a vote, from one reading of the server clock
 * (Decision 047). `receivedAtMs` decides whether the vote is in time;
 * `castAt` is the same instant as stored on the vote.
 */
export type VoteReceipt = {
  receivedAtMs: number;
  castAt: string;
};

/**
 * Records a vote for the current round. Votes are only accepted while voting
 * is open, before the voting timer's deadline (if any), and only for an option
 * of the current question. A rejected vote leaves the state unchanged, so the
 * participant's previous valid vote stays.
 * The receipt comes from the caller; the domain never reads the clock.
 */
export function castVote(state: GameState, input: VoteInput, receipt: VoteReceipt): VoteResult {
  if (state.status !== "VOTING") return { ok: false, failure: { reason: "VOTING_NOT_OPEN", status: state.status } };

  const { session, currentRound } = state;
  // Also enforced when the caller has not settled the deadline yet (settleVotingDeadline).
  const timer = currentRound.votingTimer;
  if (timer && !isReceivedInTime(timer, receipt.receivedAtMs)) {
    return { ok: false, failure: { reason: "VOTING_DEADLINE_PASSED" } };
  }

  const isOptionOfQuestion = currentRound.question.options.some((option) => option.id === input.optionId);
  if (!isOptionOfQuestion) return { ok: false, failure: { reason: "INVALID_OPTION", optionId: input.optionId } };

  const vote: Vote = { ...input, roundId: currentRound.id, castAt: receipt.castAt };
  const { votes, replacedVote } = recordVote(session.votes, vote);

  return { ok: true, state: { ...state, session: { ...session, votes } }, replacedVote };
}
