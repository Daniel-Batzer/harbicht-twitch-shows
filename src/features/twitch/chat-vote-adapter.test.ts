import { describe, expect, it } from "vitest";
import type { SharedChatVotingMode } from "../game/domain/game-state";
import { toChatVote } from "./chat-vote-adapter";
import { chatMessageEventSchema } from "./eventsub-messages";
import {
  FIXTURE_BROADCASTER_USER_ID,
  FIXTURE_CHATTER_USER_ID,
  FIXTURE_PARTNER_CHANNEL_USER_ID,
  makeChatMessageEvent,
} from "./fixtures/chat-message-notification";

type EventOptions = Parameters<typeof makeChatMessageEvent>[0];

/** Validates the fixture first, exactly like the handler does with real events. */
function event(options: EventOptions) {
  return chatMessageEventSchema.parse(makeChatMessageEvent(options));
}

function context(sharedChatVotingMode: SharedChatVotingMode = "OWN_CHANNEL_ONLY") {
  return { broadcasterUserId: FIXTURE_BROADCASTER_USER_ID, sharedChatVotingMode };
}

describe("toChatVote", () => {
  it("turns a vote command into a ChatVote with an opaque twitch participant id and nothing else", () => {
    const result = toChatVote(event({ text: "!vote 2" }), context());

    expect(result).toEqual({
      kind: "VOTE",
      chatVote: { participantId: `twitch:${FIXTURE_CHATTER_USER_ID}`, optionNumber: 2 },
    });
  });

  it("rejects malformed vote commands", () => {
    expect(toChatVote(event({ text: "!vote two" }), context())).toEqual({
      kind: "REJECTED",
      reason: "INVALID_VOTE_COMMAND",
    });
  });

  it("ignores ordinary chat", () => {
    expect(toChatVote(event({ text: "Hi chat" }), context())).toEqual({ kind: "IGNORED", reason: "NOT_A_VOTE" });
  });

  it("ignores events for a different channel", () => {
    const result = toChatVote(event({ text: "!vote 1" }), { ...context(), broadcasterUserId: "999" });

    expect(result).toEqual({ kind: "IGNORED", reason: "OTHER_CHANNEL" });
  });

  describe("Shared Chat", () => {
    const sources = [
      { label: "outside Shared Chat", source: null, isOwn: true },
      { label: "sent in the own channel", source: FIXTURE_BROADCASTER_USER_ID, isOwn: true },
      { label: "sent in a partner channel", source: FIXTURE_PARTNER_CHANNEL_USER_ID, isOwn: false },
    ];

    it.each(sources)("OWN_CHANNEL_ONLY: a vote $label counts only from the own channel", ({ source, isOwn }) => {
      const chatEvent = event({ text: "!vote 1", sourceBroadcasterUserId: source });
      const result = toChatVote(chatEvent, context("OWN_CHANNEL_ONLY"));

      expect(result.kind).toBe(isOwn ? "VOTE" : "IGNORED");
      if (!isOwn) expect(result).toEqual({ kind: "IGNORED", reason: "SHARED_CHAT_EXCLUDED" });
    });

    it.each(sources)("INCLUDE_SHARED_CHAT: a vote $label always counts", ({ source }) => {
      const chatEvent = event({ text: "!vote 1", sourceBroadcasterUserId: source });
      const result = toChatVote(chatEvent, context("INCLUDE_SHARED_CHAT"));

      expect(result).toEqual({
        kind: "VOTE",
        chatVote: { participantId: `twitch:${FIXTURE_CHATTER_USER_ID}`, optionNumber: 1 },
      });
    });
  });
});
