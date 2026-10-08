import type { VoteFailure } from "../../domain/cast-vote";

/**
 * Failures the host can see after a vote form: domain vote failures, plus
 * requests that never reached the domain (invalid shape, simulation disabled).
 */
export type HostVoteFailure = VoteFailure | { reason: "INVALID_VOTE_INPUT" } | { reason: "SIMULATION_DISABLED" };
export type HostVoteFeedback = { failure: HostVoteFailure } | null;
export type HostVoteAction = (previousFeedback: HostVoteFeedback, formData: FormData) => Promise<HostVoteFeedback>;

export function describeVoteFailure(failure: HostVoteFailure): string {
  switch (failure.reason) {
    case "VOTING_NOT_OPEN":
      return `Votes are only accepted while voting is open. The game is ${failure.status}.`;
    case "VOTING_DEADLINE_PASSED":
      return "Time is up. Votes no longer count this round.";
    case "INVALID_OPTION":
      return "That answer is not part of the current question. The panel now shows the current round.";
    case "INVALID_VOTE_INPUT":
      return "The vote form was invalid.";
    case "SIMULATION_DISABLED":
      return "Simulated votes are only available in development.";
  }
}
