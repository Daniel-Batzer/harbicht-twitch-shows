import { castChatVote, DEFAULT_SHARED_CHAT_VOTING_MODE, getSharedChatVotingMode } from "../game/services/game-service";
import { twitchParticipantId } from "../voting/participant-ids";
import { toChatVote } from "./chat-vote-adapter";
import { chatMessageEventSchema } from "./eventsub-messages";

// One chat message from the EventSub subscription, end to end: validate the
// event, adapt it to a ChatVote, cast it through the game service. Runs
// synchronously, so the read → apply → write in the game service is never
// interleaved with another vote. No chat replies are sent.

export type ChatMessageOutcome =
  | { kind: "INVALID_EVENT" }
  | { kind: "IGNORED" }
  | { kind: "ACCEPTED" }
  | { kind: "REJECTED"; reason: string };

/** `event` is the notification's unvalidated event; nothing is read from it before validation. */
export function handleChatMessage(event: unknown, broadcasterUserId: string): ChatMessageOutcome {
  const parsed = chatMessageEventSchema.safeParse(event);
  if (!parsed.success) {
    console.warn("[twitch] ignored a chat message event with an unexpected shape");
    return { kind: "INVALID_EVENT" };
  }

  const adapted = toChatVote(parsed.data, {
    broadcasterUserId,
    sharedChatVotingMode: getSharedChatVotingMode() ?? DEFAULT_SHARED_CHAT_VOTING_MODE,
  });

  switch (adapted.kind) {
    case "IGNORED":
      return { kind: "IGNORED" };
    case "REJECTED":
      console.debug("[twitch] rejected chat vote", {
        chatterUserId: parsed.data.chatter_user_id,
        reason: adapted.reason,
      });
      return { kind: "REJECTED", reason: adapted.reason };
    case "VOTE": {
      const result = castChatVote(adapted.chatVote, twitchParticipantId(broadcasterUserId));
      if (result.ok) return { kind: "ACCEPTED" };
      console.debug("[twitch] rejected chat vote", {
        chatterUserId: parsed.data.chatter_user_id,
        reason: result.failure.reason,
      });
      return { kind: "REJECTED", reason: result.failure.reason };
    }
  }
}
