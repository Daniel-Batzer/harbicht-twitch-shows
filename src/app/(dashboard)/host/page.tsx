import type { Metadata } from "next";
import { connection } from "next/server";
import { HostAutoRefresh } from "@/features/game/components/host/HostAutoRefresh";
import { HostPanel } from "@/features/game/components/host/HostPanel";
import {
  DEFAULT_REVEAL_ORDER,
  DEFAULT_SHARED_CHAT_VOTING_MODE,
  DEFAULT_VOTING_DURATION_SECONDS,
  getAvailableHostCommands,
  getGameSnapshot,
  getHostRoundView,
  isVoteSimulationEnabled,
} from "@/features/game/services/game-service";
import { getTwitchStatusView } from "@/features/twitch/twitch-connection";
import {
  castHostVoteAction,
  castSimulatedVoteAction,
  disconnectTwitchAction,
  runHostCommandAction,
  simulateRandomVotesAction,
} from "./actions";

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
  const twitchStatus = getTwitchStatusView();

  return (
    <>
      {/* Chat votes arrive without a host action, so the page refreshes itself. */}
      <HostAutoRefresh />
      <HostPanel
        snapshot={snapshot}
        hostRound={hostRound}
        availableCommands={availableCommands}
        defaultRevealOrder={DEFAULT_REVEAL_ORDER}
        defaultSharedChatVotingMode={DEFAULT_SHARED_CHAT_VOTING_MODE}
        defaultVotingDurationSeconds={DEFAULT_VOTING_DURATION_SECONDS}
        twitchStatus={twitchStatus}
        isVoteSimulationEnabled={isVoteSimulationEnabled}
        onCommand={runHostCommandAction}
        onHostVote={castHostVoteAction}
        onSimulatedVote={castSimulatedVoteAction}
        onRandomVotes={simulateRandomVotesAction}
        onTwitchDisconnect={disconnectTwitchAction}
      />
    </>
  );
}
