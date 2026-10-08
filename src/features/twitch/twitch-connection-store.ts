import type { ParticipantId } from "../voting/domain/vote";
import { twitchParticipantId } from "../voting/participant-ids";
import type { EventSubClient } from "./eventsub-client";
import { createRecentMessageIds, type RecentMessageIds } from "./recent-message-ids";

// TEMPORARY (Decisions 041, 046): the Twitch connection lives in server
// memory, next to the game state. OAuth tokens are kept here only, never in
// files, and are gone after a server restart (the host connects again).
// Stored on globalThis for the same reason as the game store: in `next dev`
// route handlers and server actions can be separate module instances, and HMR
// re-evaluates modules, which must never create a second connection.
// This file is the only place that touches the global; twitch-connection.ts
// owns the lifecycle and is the only writer.

export type TwitchConnectionPhase = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";

export type TwitchConnectionError =
  /** The host declined on Twitch's consent page. */
  | "AUTH_DENIED"
  /** The OAuth callback's state did not match (stale tab, or not started from this app). */
  | "STATE_MISMATCH"
  /** Code exchange or validation failed. */
  | "AUTH_FAILED"
  | "MISSING_SCOPE"
  /** The token was rejected and could not be refreshed: connect again. */
  | "TOKEN_INVALID"
  | "SUBSCRIPTION_FAILED"
  /** Twitch revoked the subscription, e.g. because the app was disconnected on Twitch. */
  | "REVOKED"
  | "CONNECTION_LOST";

export type TwitchBroadcaster = { userId: string; login: string };

/** INVALID: Twitch rejected the refresh token, connect again. UNAVAILABLE: try again later. */
export type TokenRefreshOutcome = "REFRESHED" | "INVALID" | "UNAVAILABLE";

export type TwitchCredentials = {
  accessToken: string;
  refreshToken: string;
  /** Metadata only (see TwitchTokens). */
  expiresInSeconds: number | null;
  broadcaster: TwitchBroadcaster;
};

/** EventSub message ids remembered for de-duplication (Decision 046). */
const RECENT_MESSAGE_ID_CAPACITY = 1000;

export type TwitchRuntime = {
  phase: TwitchConnectionPhase;
  /** Present from a successful OAuth callback until disconnect or a fatal error. */
  credentials: TwitchCredentials | null;
  lastError: TwitchConnectionError | null;
  reconnectAttempt: number;
  /** Epoch milliseconds of the last chat message from the subscription. */
  lastChatMessageAt: number | null;
  /** Chat vote attempts since connecting: accepted, or rejected (malformed, out of range, voting closed). */
  chatVotes: { accepted: number; rejected: number };
  recentMessageIds: RecentMessageIds;
  /**
   * Bumped on every connect, disconnect and fatal error. Async work (a
   * subscription request, a refresh, a reconnect timer) remembers the
   * generation it started in and drops its result if it has changed.
   */
  generation: number;
  /** The current EventSub session; callbacks and responses from any other client are stale. */
  eventSub: EventSubClient | null;
  validateTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  /** Shared, so the hourly validation and a 401 during subscribe never refresh twice at once. */
  refreshInFlight: Promise<TokenRefreshOutcome> | null;
};

type TwitchStoreGlobal = typeof globalThis & {
  __harbichtTwitch?: TwitchRuntime;
};

const storeGlobal = globalThis as TwitchStoreGlobal;

function createTwitchRuntime(): TwitchRuntime {
  return {
    phase: "DISCONNECTED",
    credentials: null,
    lastError: null,
    reconnectAttempt: 0,
    lastChatMessageAt: null,
    chatVotes: { accepted: 0, rejected: 0 },
    recentMessageIds: createRecentMessageIds(RECENT_MESSAGE_ID_CAPACITY),
    generation: 0,
    eventSub: null,
    validateTimer: null,
    reconnectTimer: null,
    refreshInFlight: null,
  };
}

export function getTwitchRuntime(): TwitchRuntime {
  storeGlobal.__harbichtTwitch ??= createTwitchRuntime();
  return storeGlobal.__harbichtTwitch;
}

/**
 * The broadcaster's participant id while Twitch credentials are held
 * (connecting, connected or reconnecting), otherwise null. A new game uses it
 * as the host's id (Decision 046).
 */
export function getConnectedBroadcasterParticipantId(): ParticipantId | null {
  const { credentials } = getTwitchRuntime();
  return credentials ? twitchParticipantId(credentials.broadcaster.userId) : null;
}
