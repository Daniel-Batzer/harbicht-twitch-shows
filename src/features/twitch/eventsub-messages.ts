import { z } from "zod";
import type { RecentMessageIds } from "./recent-message-ids";

// EventSub WebSocket messages are external input, so every field is validated
// with Zod before anything reads it (Decision 029). Order matters:
//   JSON → generic envelope → message_id → de-duplicate → concrete payload.
// Schemas only list the fields we use; Zod drops the rest.
// https://dev.twitch.tv/docs/eventsub/handling-websocket-events/

export const CHAT_MESSAGE_SUBSCRIPTION_TYPE = "channel.chat.message";

const envelopeSchema = z.object({
  metadata: z.object({
    message_id: z.string().min(1),
    message_type: z.string().min(1),
    message_timestamp: z.string(),
  }),
  payload: z.unknown(),
});

const welcomePayloadSchema = z.object({
  session: z.object({
    id: z.string().min(1),
    keepalive_timeout_seconds: z.number().int().positive(),
  }),
});

const reconnectPayloadSchema = z.object({
  session: z.object({
    reconnect_url: z.url({ protocol: /^wss$/ }),
  }),
});

const notificationPayloadSchema = z.object({
  subscription: z.object({ type: z.string().min(1) }),
  event: z.unknown(),
});

const revocationPayloadSchema = z.object({
  subscription: z.object({ type: z.string().min(1), status: z.string().min(1) }),
});

const twitchUserIdSchema = z.string().regex(/^\d+$/);

/** The part of a `channel.chat.message` event the chat adapter needs. */
export const chatMessageEventSchema = z.object({
  broadcaster_user_id: twitchUserIdSchema,
  chatter_user_id: twitchUserIdSchema,
  message: z.object({ text: z.string() }),
  /** Set during a Shared Chat session: the channel the message was sent in. */
  source_broadcaster_user_id: twitchUserIdSchema.nullish(),
});

export type ChatMessageEvent = z.infer<typeof chatMessageEventSchema>;

export type EventSubFrame =
  | { kind: "INVALID_FRAME"; problem: "NOT_JSON" | "INVALID_ENVELOPE" }
  | { kind: "DUPLICATE"; messageId: string; messageType: string }
  | { kind: "INVALID_PAYLOAD"; messageId: string; messageType: string }
  | { kind: "WELCOME"; sessionId: string; keepaliveTimeoutSeconds: number }
  | { kind: "KEEPALIVE" }
  | { kind: "RECONNECT"; reconnectUrl: string }
  /** `event` is still unvalidated: its schema depends on the subscription type. */
  | { kind: "NOTIFICATION"; messageId: string; subscriptionType: string; event: unknown }
  | { kind: "REVOCATION"; subscriptionType: string; status: string }
  | { kind: "UNKNOWN_MESSAGE_TYPE"; messageType: string };

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/**
 * Reads one WebSocket text frame. A frame whose envelope is valid is
 * remembered as seen even if its payload turns out to be invalid, so a resend
 * of the same broken message is not processed twice. A frame with an invalid
 * envelope has no trustworthy id and is never remembered.
 */
export function readEventSubFrame(raw: string, recentMessageIds: RecentMessageIds): EventSubFrame {
  const json = parseJson(raw);
  if (!json.ok) return { kind: "INVALID_FRAME", problem: "NOT_JSON" };

  const envelope = envelopeSchema.safeParse(json.value);
  if (!envelope.success) return { kind: "INVALID_FRAME", problem: "INVALID_ENVELOPE" };

  const { message_id: messageId, message_type: messageType } = envelope.data.metadata;
  if (!recentMessageIds.remember(messageId)) return { kind: "DUPLICATE", messageId, messageType };

  const { payload } = envelope.data;
  const invalidPayload: EventSubFrame = { kind: "INVALID_PAYLOAD", messageId, messageType };

  switch (messageType) {
    case "session_welcome": {
      const parsed = welcomePayloadSchema.safeParse(payload);
      if (!parsed.success) return invalidPayload;
      return {
        kind: "WELCOME",
        sessionId: parsed.data.session.id,
        keepaliveTimeoutSeconds: parsed.data.session.keepalive_timeout_seconds,
      };
    }
    case "session_keepalive":
      return { kind: "KEEPALIVE" };
    case "session_reconnect": {
      const parsed = reconnectPayloadSchema.safeParse(payload);
      if (!parsed.success) return invalidPayload;
      return { kind: "RECONNECT", reconnectUrl: parsed.data.session.reconnect_url };
    }
    case "notification": {
      const parsed = notificationPayloadSchema.safeParse(payload);
      if (!parsed.success) return invalidPayload;
      const { subscription, event } = parsed.data;
      return { kind: "NOTIFICATION", messageId, subscriptionType: subscription.type, event };
    }
    case "revocation": {
      const parsed = revocationPayloadSchema.safeParse(payload);
      if (!parsed.success) return invalidPayload;
      const { subscription } = parsed.data;
      return { kind: "REVOCATION", subscriptionType: subscription.type, status: subscription.status };
    }
    default:
      return { kind: "UNKNOWN_MESSAGE_TYPE", messageType };
  }
}
