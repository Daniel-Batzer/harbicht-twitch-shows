import type { QuestionOption } from "../../questions/domain/question";
import type { Vote } from "./vote";

// Aggregated results are always derived from the individual votes and never
// stored (Decision 014). The host vote counts like any other vote (Decision 013).

export type OptionTally = {
  optionId: string;
  voteCount: number;
};

export type RoundTally = {
  totalVotes: number;
  /** One entry per option, in question order, including options without votes. */
  options: OptionTally[];
  /** Every option with the highest count (several on a tie); empty when nobody voted. */
  winningOptionIds: string[];
};

/**
 * Counts the effective votes of one round. Expects only that round's votes;
 * one vote per participant is guaranteed when votes are recorded.
 */
export function tallyVotes(options: readonly QuestionOption[], roundVotes: readonly Vote[]): RoundTally {
  const optionTallies = options.map((option) => ({
    optionId: option.id,
    voteCount: roundVotes.filter((vote) => vote.optionId === option.id).length,
  }));

  const totalVotes = optionTallies.reduce((sum, tally) => sum + tally.voteCount, 0);
  const highestCount = Math.max(0, ...optionTallies.map((tally) => tally.voteCount));
  const winningOptionIds =
    highestCount === 0
      ? []
      : optionTallies.filter((tally) => tally.voteCount === highestCount).map((tally) => tally.optionId);

  return { totalVotes, options: optionTallies, winningOptionIds };
}
