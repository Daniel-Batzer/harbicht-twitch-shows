import { recordVote, type Vote, type VoteInput } from "../../voting/domain/vote";
import type { GameState, GameStatus } from "./game-state";

// Voting inside the game flow (Decisions 012, 013, 043). A vote is not a game
// command: it never changes the status or the round, only the session's votes.

export type VoteFailure =
  | { reason: "VOTING_NOT_OPEN"; status: GameStatus }
  | { reason: "INVALID_OPTION"; optionId: string };

export type VoteResult =
  | { ok: true; state: GameState; replacedVote: Vote | null }
  | { ok: false; failure: VoteFailure };

/**
 * Records a vote for the current round. Votes are only accepted while voting
 * is open, and only for an option of the current question. A rejected vote
 * leaves the state unchanged, so the participant's previous valid vote stays.
 * `castAt` comes from the caller; the domain never reads the clock.
 */
export function castVote(state: GameState, input: VoteInput, castAt: string): VoteResult {
  if (state.status !== "VOTING") return { ok: false, failure: { reason: "VOTING_NOT_OPEN", status: state.status } };

  const { session, currentRound } = state;
  const isOptionOfQuestion = currentRound.question.options.some((option) => option.id === input.optionId);
  if (!isOptionOfQuestion) return { ok: false, failure: { reason: "INVALID_OPTION", optionId: input.optionId } };

  const vote: Vote = { ...input, roundId: currentRound.id, castAt };
  const { votes, replacedVote } = recordVote(session.votes, vote);

  return { ok: true, state: { ...state, session: { ...session, votes } }, replacedVote };
}
