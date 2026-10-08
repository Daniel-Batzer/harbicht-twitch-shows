import type { Metadata } from "next";
import { connection } from "next/server";
import { HostPanel } from "@/features/game/components/host/HostPanel";
import {
  DEFAULT_REVEAL_ORDER,
  getAvailableHostCommands,
  getGameSnapshot,
  getHostRoundView,
} from "@/features/game/services/game-service";
import { castHostVoteAction, castSimulatedVoteAction, runHostCommandAction, simulateRandomVotesAction } from "./actions";

export const metadata: Metadata = {
  title: "Host · Harbicht Twitch Shows",
};

export default async function HostPage() {
  // The game state is an in-memory value; without this, Next.js would
  // prerender the page once at build time and serve a stale snapshot.
  await connection();
  const snapshot = getGameSnapshot();
  const hostRound = getHostRoundView();
  const availableCommands = getAvailableHostCommands();

  return (
    <HostPanel
      snapshot={snapshot}
      hostRound={hostRound}
      availableCommands={availableCommands}
      defaultRevealOrder={DEFAULT_REVEAL_ORDER}
      onCommand={runHostCommandAction}
      onHostVote={castHostVoteAction}
      onSimulatedVote={castSimulatedVoteAction}
      onRandomVotes={simulateRandomVotesAction}
    />
  );
}
