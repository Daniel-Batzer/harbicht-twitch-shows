// Test fixtures shaped like Twitch's documented EventSub WebSocket messages
// (example payloads from dev.twitch.tv/docs/eventsub). Ids are made up.

export const FIXTURE_BROADCASTER_USER_ID = "1971641";
export const FIXTURE_CHATTER_USER_ID = "4145994";
export const FIXTURE_PARTNER_CHANNEL_USER_ID = "5550001";

type ChatEventOverrides = {
  text?: string;
  chatterUserId?: string;
  sourceBroadcasterUserId?: string | null;
};

/** The `event` of a `channel.chat.message` notification, as Twitch documents it. */
export function makeChatMessageEvent({
  text = "Hi chat",
  chatterUserId = FIXTURE_CHATTER_USER_ID,
  sourceBroadcasterUserId = null,
}: ChatEventOverrides = {}) {
  return {
    broadcaster_user_id: FIXTURE_BROADCASTER_USER_ID,
    broadcaster_user_login: "streamer",
    broadcaster_user_name: "streamer",
    chatter_user_id: chatterUserId,
    chatter_user_login: "viewer32",
    chatter_user_name: "viewer32",
    message_id: "cc106a89-1814-919d-454c-f4f2f970aae7",
    message: {
      text,
      fragments: [{ type: "text", text, cheermote: null, emote: null, mention: null }],
    },
    color: "#00FF7F",
    badges: [{ set_id: "subscriber", id: "12", info: "16" }],
    message_type: "text",
    cheer: null,
    reply: null,
    channel_points_custom_reward_id: null,
    source_broadcaster_user_id: sourceBroadcasterUserId,
    source_broadcaster_user_login: sourceBroadcasterUserId === null ? null : "partner",
    source_broadcaster_user_name: sourceBroadcasterUserId === null ? null : "Partner",
    source_message_id: sourceBroadcasterUserId === null ? null : "aa106a89-1814-919d-454c-f4f2f970aae7",
    source_badges: null,
  };
}

function metadata(messageId: string, messageType: string, extra: Record<string, string> = {}) {
  return { message_id: messageId, message_type: messageType, message_timestamp: "2026-10-08T12:00:00.000Z", ...extra };
}

/** A full WebSocket frame carrying a chat message notification. */
export function makeChatNotificationFrame(messageId: string, event: unknown = makeChatMessageEvent()): string {
  return JSON.stringify({
    metadata: metadata(messageId, "notification", {
      subscription_type: "channel.chat.message",
      subscription_version: "1",
    }),
    payload: {
      subscription: {
        id: "0b7f3361-672b-4d39-b307-dd5b576c9b27",
        status: "enabled",
        type: "channel.chat.message",
        version: "1",
        condition: { broadcaster_user_id: FIXTURE_BROADCASTER_USER_ID, user_id: FIXTURE_BROADCASTER_USER_ID },
        transport: { method: "websocket", session_id: "AgoQHR3s6Mb4T8GFB1l3DlPfiRIGY2VsbC1h" },
        created_at: "2023-11-06T18:11:47.492253549Z",
        cost: 0,
      },
      event,
    },
  });
}

export function makeWelcomeFrame(messageId: string): string {
  return JSON.stringify({
    metadata: metadata(messageId, "session_welcome"),
    payload: {
      session: {
        id: "AQoQILE98gtqShGmLD7AM6yJThAB",
        status: "connected",
        connected_at: "2026-10-08T12:00:00.000Z",
        keepalive_timeout_seconds: 30,
        reconnect_url: null,
        recovery_url: null,
      },
    },
  });
}

export function makeKeepaliveFrame(messageId: string): string {
  return JSON.stringify({ metadata: metadata(messageId, "session_keepalive"), payload: {} });
}

export function makeReconnectFrame(messageId: string, reconnectUrl = "wss://eventsub.wss.twitch.tv/ws?id=abc"): string {
  return JSON.stringify({
    metadata: metadata(messageId, "session_reconnect"),
    payload: {
      session: {
        id: "AQoQILE98gtqShGmLD7AM6yJThAB",
        status: "reconnecting",
        keepalive_timeout_seconds: null,
        reconnect_url: reconnectUrl,
        connected_at: "2026-10-08T12:00:00.000Z",
      },
    },
  });
}

export function makeRevocationFrame(messageId: string, status = "authorization_revoked"): string {
  return JSON.stringify({
    metadata: metadata(messageId, "revocation", {
      subscription_type: "channel.chat.message",
      subscription_version: "1",
    }),
    payload: {
      subscription: {
        id: "0b7f3361-672b-4d39-b307-dd5b576c9b27",
        status,
        type: "channel.chat.message",
        version: "1",
        cost: 0,
        condition: { broadcaster_user_id: FIXTURE_BROADCASTER_USER_ID, user_id: FIXTURE_BROADCASTER_USER_ID },
        transport: { method: "websocket", session_id: "AgoQHR3s6Mb4T8GFB1l3DlPfiRIGY2VsbC1h" },
        created_at: "2023-11-06T18:11:47.492253549Z",
      },
    },
  });
}
