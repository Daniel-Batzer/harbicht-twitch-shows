"use server";

import { refresh } from "next/cache";
import type { HostActionFeedback } from "@/features/game/components/host/HostPanel";
import { endCurrentGame, startNewGame } from "@/features/game/services/game-service";

export async function startGameAction(): Promise<HostActionFeedback> {
  const result = startNewGame();
  refresh();
  return result.ok ? null : { failureReason: result.reason };
}

export async function endGameAction(): Promise<HostActionFeedback> {
  const result = endCurrentGame();
  refresh();
  return result.ok ? null : { failureReason: result.reason };
}
