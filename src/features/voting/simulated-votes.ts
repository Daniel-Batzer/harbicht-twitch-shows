// DEV ONLY: random votes from simulated viewers, so voting can be exercised
// before Twitch exists (Roadmap Phase 3). Removed or gated once real chat
// votes arrive (Phase 5).

export type SimulatedVoteChoice = {
  viewerKey: string;
  optionId: string;
};

type PickSimulatedVotesInput = {
  count: number;
  /** Viewers are drawn from a fixed pool, so repeated batches replace earlier votes. */
  poolSize: number;
  optionIds: readonly string[];
  /** Injected so tests stay deterministic; returns a number in [0, 1). */
  randomNumber: () => number;
};

function pickIndex(length: number, randomNumber: number): number {
  return Math.min(Math.floor(randomNumber * length), length - 1);
}

/** The same viewer may be picked twice in one batch; the later pick then replaces the earlier one. */
export function pickSimulatedVotes({
  count,
  poolSize,
  optionIds,
  randomNumber,
}: PickSimulatedVotesInput): SimulatedVoteChoice[] {
  if (optionIds.length === 0 || poolSize < 1) return [];

  return Array.from({ length: count }, () => ({
    viewerKey: `viewer-${pickIndex(poolSize, randomNumber()) + 1}`,
    optionId: optionIds[pickIndex(optionIds.length, randomNumber())],
  }));
}
