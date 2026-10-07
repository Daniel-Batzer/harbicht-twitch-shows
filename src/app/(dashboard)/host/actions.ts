"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { HostActionFeedback } from "@/features/game/components/host/HostPanel";
import { GAME_COMMANDS } from "@/features/game/domain/game-state";
import { runGameCommand } from "@/features/game/services/game-service";

// A Server Action is a public endpoint, so the command coming from the form is
// validated at this boundary (Decision 029). The domain only ever receives a
// valid GameCommand.
const hostCommandSchema = z.enum(GAME_COMMANDS);

export async function runHostCommandAction(
  _previousFeedback: HostActionFeedback,
  formData: FormData,
): Promise<HostActionFeedback> {
  const parsedCommand = hostCommandSchema.safeParse(formData.get("command"));
  if (!parsedCommand.success) return { failure: { reason: "UNKNOWN_COMMAND" } };

  const result = runGameCommand(parsedCommand.data);
  // Refresh on failure too: a rejected command usually means this panel was stale.
  refresh();
  return result.ok ? null : { failure: result.failure };
}
