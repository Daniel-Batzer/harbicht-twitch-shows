import type { ChatVote } from "../game/chat-vote-input";
import type { SharedChatVotingMode } from "../game/domain/game-state";
import { twitchParticipantId } from "../voting/participant-ids";
import { parseChatVoteCommand } from "./chat-vote-command";
import type { ChatMessageEvent } from "./eventsub-messages";

// Twitch adapter (Decision 021, 046): turns a validated chat message event
// into a platform-neutral ChatVote. Everything Twitch-specific ends here:
// the channel the message came from, the command syntax, and the Twitch user
// id, which becomes an opaque participant id.

export type ChatVoteAdapterContext = {
  broadcasterUserId: string;
  sharedChatVotingMode: SharedChatVotingMode;
};

export type ChatVoteAdapterResult =
  | { kind: "VOTE"; chatVote: ChatVote }
  /** Looked like a vote but is not one; the viewer's earlier vote stays. */
  | { kind: "REJECTED"; reason: "INVALID_VOTE_COMMAND" }
  /** Not meant for the game at all; not counted anywhere. */
  | { kind: "IGNORED"; reason: "NOT_A_VOTE" | "OTHER_CHANNEL" | "SHARED_CHAT_EXCLUDED" };

/**
 * In a Shared Chat session the subscription also delivers messages sent in
 * partner channels; `source_broadcaster_user_id` names the channel a message
 * was sent in (null outside Shared Chat).
 */
function isFromOwnChannel(event: ChatMessageEvent, broadcasterUserId: string): boolean {
  const sourceChannelId = event.source_broadcaster_user_id ?? null;
  return sourceChannelId === null || sourceChannelId === broadcasterUserId;
}

export function toChatVote(event: ChatMessageEvent, context: ChatVoteAdapterContext): ChatVoteAdapterResult {
  // Defensive: the subscription is for our channel only.
  if (event.broadcaster_user_id !== context.broadcasterUserId) return { kind: "IGNORED", reason: "OTHER_CHANNEL" };

  if (context.sharedChatVotingMode === "OWN_CHANNEL_ONLY" && !isFromOwnChannel(event, context.broadcasterUserId)) {
    return { kind: "IGNORED", reason: "SHARED_CHAT_EXCLUDED" };
  }

  const command = parseChatVoteCommand(event.message.text);
  switch (command.kind) {
    case "NOT_A_VOTE":
      return { kind: "IGNORED", reason: "NOT_A_VOTE" };
    case "INVALID_VOTE":
      return { kind: "REJECTED", reason: "INVALID_VOTE_COMMAND" };
    case "VOTE":
      return {
        kind: "VOTE",
        chatVote: { participantId: twitchParticipantId(event.chatter_user_id), optionNumber: command.optionNumber },
      };
  }
}
