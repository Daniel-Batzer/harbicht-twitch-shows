"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { HostActionFeedback } from "@/features/game/components/host/HostPanel";
import type { HostVoteFeedback } from "@/features/game/components/host/vote-feedback";
import { GAME_COMMANDS, REVEAL_ORDERS } from "@/features/game/domain/game-state";
import {
  castHostVote,
  castSimulatedVote,
  runGameCommand,
  simulateRandomVotes,
  type GameCommandOptions,
} from "@/features/game/services/game-service";

// A Server Action is a public endpoint, so form input is validated at this
// boundary (Decision 029). Zod checks only the shape; whether an option belongs
// to the current question is a game rule and decided by the domain.
const hostCommandSchema = z.enum(GAME_COMMANDS);
const revealOrderSchema = z.enum(REVEAL_ORDERS);
const optionIdSchema = z.string().min(1).max(100);
const simulatedVoteSchema = z.object({
  viewerKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,32}$/i),
  optionId: optionIdSchema,
});
const randomVotesSchema = z.coerce.number().int().min(1).max(100);

export async function runHostCommandAction(
  _previousFeedback: HostActionFeedback,
  formData: FormData,
): Promise<HostActionFeedback> {
  const parsedCommand = hostCommandSchema.safeParse(formData.get("command"));
  if (!parsedCommand.success) return { failure: { reason: "UNKNOWN_COMMAND" } };

  const command = parsedCommand.data;
  let options: GameCommandOptions = {};
  // The reveal order is chosen per game, so only the start form sends it.
  if (command === "START_GAME") {
    const parsedRevealOrder = revealOrderSchema.safeParse(formData.get("revealOrder"));
    if (!parsedRevealOrder.success) return { failure: { reason: "INVALID_REVEAL_ORDER" } };
    options = { revealOrder: parsedRevealOrder.data };
  }

  const result = runGameCommand(command, options);
  // Refresh on failure too: a rejected command usually means this panel was stale.
  refresh();
  return result.ok ? null : { failure: result.failure };
}

/** The host's own vote. Only the option comes from the form; the host identity is decided on the server. */
export async function castHostVoteAction(
  _previousFeedback: HostVoteFeedback,
  formData: FormData,
): Promise<HostVoteFeedback> {
  const parsedOptionId = optionIdSchema.safeParse(formData.get("optionId"));
  if (!parsedOptionId.success) return { failure: { reason: "INVALID_VOTE_INPUT" } };

  const result = castHostVote(parsedOptionId.data);
  refresh();
  return result.ok ? null : { failure: result.failure };
}

/** DEV: a vote from a named simulated viewer. */
export async function castSimulatedVoteAction(
  _previousFeedback: HostVoteFeedback,
  formData: FormData,
): Promise<HostVoteFeedback> {
  const parsed = simulatedVoteSchema.safeParse({
    viewerKey: formData.get("viewerKey"),
    optionId: formData.get("optionId"),
  });
  if (!parsed.success) return { failure: { reason: "INVALID_VOTE_INPUT" } };

  const result = castSimulatedVote(parsed.data.viewerKey, parsed.data.optionId);
  refresh();
  return result.ok ? null : { failure: result.failure };
}

/** DEV: a batch of random votes from the simulated viewer pool. */
export async function simulateRandomVotesAction(
  _previousFeedback: HostVoteFeedback,
  formData: FormData,
): Promise<HostVoteFeedback> {
  const parsedCount = randomVotesSchema.safeParse(formData.get("count"));
  if (!parsedCount.success) return { failure: { reason: "INVALID_VOTE_INPUT" } };

  const result = simulateRandomVotes(parsedCount.data);
  refresh();
  return result.ok ? null : { failure: result.failure };
}
