import { describe, expect, it } from "vitest";
import { chatMessageEventSchema, readEventSubFrame } from "./eventsub-messages";
import {
  makeChatMessageEvent,
  makeChatNotificationFrame,
  makeKeepaliveFrame,
  makeReconnectFrame,
  makeRevocationFrame,
  makeWelcomeFrame,
} from "./fixtures/chat-message-notification";
import { createRecentMessageIds } from "./recent-message-ids";

function newIds() {
  return createRecentMessageIds(100);
}

describe("readEventSubFrame", () => {
  it("reads the welcome message's session id and keepalive timeout", () => {
    expect(readEventSubFrame(makeWelcomeFrame("m1"), newIds())).toEqual({
      kind: "WELCOME",
      sessionId: "AQoQILE98gtqShGmLD7AM6yJThAB",
      keepaliveTimeoutSeconds: 30,
    });
  });

  it("reads keepalive, reconnect and revocation messages", () => {
    const ids = newIds();

    expect(readEventSubFrame(makeKeepaliveFrame("m1"), ids)).toEqual({ kind: "KEEPALIVE" });
    expect(readEventSubFrame(makeReconnectFrame("m2"), ids)).toEqual({
      kind: "RECONNECT",
      reconnectUrl: "wss://eventsub.wss.twitch.tv/ws?id=abc",
    });
    expect(readEventSubFrame(makeRevocationFrame("m3"), ids)).toEqual({
      kind: "REVOCATION",
      subscriptionType: "channel.chat.message",
      status: "authorization_revoked",
    });
  });

  it("passes a notification's event on unvalidated, together with its subscription type", () => {
    const event = makeChatMessageEvent({ text: "!vote 2" });

    expect(readEventSubFrame(makeChatNotificationFrame("m1", event), newIds())).toEqual({
      kind: "NOTIFICATION",
      messageId: "m1",
      subscriptionType: "channel.chat.message",
      event,
    });
  });

  it("reports a repeated message id as a duplicate", () => {
    const ids = newIds();
    readEventSubFrame(makeChatNotificationFrame("m1"), ids);

    expect(readEventSubFrame(makeChatNotificationFrame("m1"), ids)).toEqual({
      kind: "DUPLICATE",
      messageId: "m1",
      messageType: "notification",
    });
  });

  it("rejects frames that are not JSON or have no valid envelope, without remembering anything", () => {
    const ids = newIds();

    expect(readEventSubFrame("not json", ids)).toEqual({ kind: "INVALID_FRAME", problem: "NOT_JSON" });
    expect(readEventSubFrame(JSON.stringify({ metadata: { message_id: "m1" } }), ids)).toEqual({
      kind: "INVALID_FRAME",
      problem: "INVALID_ENVELOPE",
    });
    // The broken envelope's id was not trusted, so the real message with that id still counts.
    expect(readEventSubFrame(makeKeepaliveFrame("m1"), ids)).toEqual({ kind: "KEEPALIVE" });
  });

  it("remembers a message with a valid envelope even when its payload is invalid", () => {
    const ids = newIds();
    const brokenWelcome = JSON.stringify({
      metadata: { message_id: "m1", message_type: "session_welcome", message_timestamp: "2026-10-08T12:00:00Z" },
      payload: { session: {} },
    });

    expect(readEventSubFrame(brokenWelcome, ids)).toEqual({
      kind: "INVALID_PAYLOAD",
      messageId: "m1",
      messageType: "session_welcome",
    });
    expect(readEventSubFrame(brokenWelcome, ids)).toEqual(expect.objectContaining({ kind: "DUPLICATE" }));
  });

  it("only accepts secure WebSocket reconnect URLs", () => {
    expect(readEventSubFrame(makeReconnectFrame("m1", "https://example.com"), newIds())).toEqual(
      expect.objectContaining({ kind: "INVALID_PAYLOAD" }),
    );
  });

  it("reports unknown message types instead of failing", () => {
    const frame = JSON.stringify({
      metadata: { message_id: "m1", message_type: "something_new", message_timestamp: "2026-10-08T12:00:00Z" },
      payload: {},
    });

    expect(readEventSubFrame(frame, newIds())).toEqual({ kind: "UNKNOWN_MESSAGE_TYPE", messageType: "something_new" });
  });
});

describe("chatMessageEventSchema", () => {
  it("accepts Twitch's documented chat event and keeps only the fields the adapter needs", () => {
    expect(chatMessageEventSchema.parse(makeChatMessageEvent({ text: "!vote 1" }))).toEqual({
      broadcaster_user_id: "1971641",
      chatter_user_id: "4145994",
      message: { text: "!vote 1" },
      source_broadcaster_user_id: null,
    });
  });

  it("rejects events without a numeric chatter id", () => {
    expect(chatMessageEventSchema.safeParse(makeChatMessageEvent({ chatterUserId: "viewer32" })).success).toBe(false);
  });
});
