import { handleChatMessage } from "./chat-message-handler";
import {
  EVENTSUB_WEBSOCKET_URL,
  openEventSubClient,
  type EventSubClient,
  type EventSubNotification,
} from "./eventsub-client";
import { CHAT_MESSAGE_SUBSCRIPTION_TYPE } from "./eventsub-messages";
import { refreshAccessToken, subscribeToChatMessages, validateAccessToken, type TwitchTokens } from "./twitch-api";
import { readTwitchConfig } from "./twitch-config";
import {
  getTwitchRuntime,
  type TokenRefreshOutcome,
  type TwitchBroadcaster,
  type TwitchConnectionError,
  type TwitchConnectionPhase,
  type TwitchRuntime,
} from "./twitch-connection-store";

// Lifecycle of the Twitch chat connection (Decision 046), from a validated
// OAuth token to chat votes:
//
//   startTwitchConnection → open EventSub socket → welcome → subscribe → CONNECTED
//   lost connection → RECONNECTING (backoff) → new socket → welcome → subscribe
//   revocation / unrecoverable token → DISCONNECTED (host connects again)
//
// The connection runs inside the Next.js server process: no worker yet
// (Decision 030). Everything is in memory and lost on restart.

/** Twitch requires validating tokens hourly while the OAuth session is in use. */
const TOKEN_VALIDATION_INTERVAL_MS = 60 * 60 * 1000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export type TwitchStatusView = {
  state: "NOT_CONFIGURED" | TwitchConnectionPhase;
  broadcasterLogin: string | null;
  lastError: TwitchConnectionError | null;
  reconnectAttempt: number;
  secondsSinceLastChatMessage: number | null;
  chatVotes: { accepted: number; rejected: number };
};

/** For the host panel. Contains no tokens or credentials. */
export function getTwitchStatusView(): TwitchStatusView {
  const runtime = getTwitchRuntime();
  const isConfigured = readTwitchConfig() !== null;
  return {
    state: !isConfigured && runtime.phase === "DISCONNECTED" ? "NOT_CONFIGURED" : runtime.phase,
    broadcasterLogin: runtime.credentials?.broadcaster.login ?? null,
    lastError: runtime.lastError,
    reconnectAttempt: runtime.reconnectAttempt,
    secondsSinceLastChatMessage:
      runtime.lastChatMessageAt === null ? null : Math.floor((Date.now() - runtime.lastChatMessageAt) / 1000),
    chatVotes: { ...runtime.chatVotes },
  };
}

/** Stops sockets and timers and invalidates all async work in flight. */
function stopRuntime(runtime: TwitchRuntime): number {
  runtime.generation += 1;
  runtime.eventSub?.close();
  runtime.eventSub = null;
  if (runtime.validateTimer) clearInterval(runtime.validateTimer);
  if (runtime.reconnectTimer) clearTimeout(runtime.reconnectTimer);
  runtime.validateTimer = null;
  runtime.reconnectTimer = null;
  runtime.refreshInFlight = null;
  return runtime.generation;
}

/**
 * Called by the OAuth callback with a freshly validated token. Replaces any
 * existing connection, so there is never more than one.
 */
export function startTwitchConnection(tokens: TwitchTokens, broadcaster: TwitchBroadcaster): void {
  const runtime = getTwitchRuntime();
  const generation = stopRuntime(runtime);

  runtime.credentials = { ...tokens, broadcaster };
  runtime.phase = "CONNECTING";
  runtime.lastError = null;
  runtime.reconnectAttempt = 0;
  runtime.lastChatMessageAt = null;
  runtime.chatVotes = { accepted: 0, rejected: 0 };
  runtime.validateTimer = setInterval(() => void validateToken(generation), TOKEN_VALIDATION_INTERVAL_MS);

  openSession(generation);
}

/** The host disconnects: close everything and forget the tokens. */
export function disconnectTwitch(): void {
  const runtime = getTwitchRuntime();
  stopRuntime(runtime);
  runtime.credentials = null;
  runtime.phase = "DISCONNECTED";
  runtime.lastError = null;
  runtime.reconnectAttempt = 0;
}

/** Ends the connection with an error the host has to act on (connect again). */
function failTwitchConnection(error: TwitchConnectionError): void {
  const runtime = getTwitchRuntime();
  stopRuntime(runtime);
  runtime.credentials = null;
  runtime.phase = "DISCONNECTED";
  runtime.lastError = error;
  runtime.reconnectAttempt = 0;
  console.warn("[twitch] chat disconnected", { error });
}

/**
 * A connect attempt (OAuth callback) failed. A connection that is already
 * running is kept: a stale or forged callback must not disconnect chat.
 */
export function reportFailedConnectAttempt(error: TwitchConnectionError): void {
  const runtime = getTwitchRuntime();
  if (runtime.credentials) {
    console.warn("[twitch] ignored a failed connect attempt; the current connection keeps running", { error });
    return;
  }
  runtime.phase = "DISCONNECTED";
  runtime.lastError = error;
}

function isCurrentGeneration(generation: number): boolean {
  return getTwitchRuntime().generation === generation;
}

function failIfCurrent(generation: number, error: TwitchConnectionError): void {
  if (isCurrentGeneration(generation)) failTwitchConnection(error);
}

function openSession(generation: number): void {
  const runtime = getTwitchRuntime();
  const broadcasterUserId = runtime.credentials?.broadcaster.userId;
  if (!broadcasterUserId) return;

  // Callbacks fire asynchronously, after `client` has been assigned.
  const client: EventSubClient = openEventSubClient({
    url: EVENTSUB_WEBSOCKET_URL,
    recentMessageIds: runtime.recentMessageIds,
    callbacks: {
      onSessionStarted: (sessionId) => void subscribe(generation, client, sessionId),
      onNotification: (notification) => {
        if (isCurrentSession(generation, client)) handleNotification(notification, broadcasterUserId);
      },
      onRevoked: ({ status }) => {
        console.warn("[twitch] Twitch revoked the chat subscription", { status });
        if (isCurrentSession(generation, client)) failTwitchConnection("REVOKED");
      },
      onConnectionLost: (reason) => {
        if (isCurrentSession(generation, client)) scheduleReconnect(generation, reason);
      },
    },
  });
  runtime.eventSub = client;
}

function isCurrentSession(generation: number, client: EventSubClient): boolean {
  const runtime = getTwitchRuntime();
  return runtime.generation === generation && runtime.eventSub === client;
}

function handleNotification(notification: EventSubNotification, broadcasterUserId: string): void {
  if (notification.subscriptionType !== CHAT_MESSAGE_SUBSCRIPTION_TYPE) {
    console.debug("[twitch] ignored a notification", { subscriptionType: notification.subscriptionType });
    return;
  }

  const outcome = handleChatMessage(notification.event, broadcasterUserId);
  if (outcome.kind === "INVALID_EVENT") return;

  const runtime = getTwitchRuntime();
  runtime.lastChatMessageAt = Date.now();
  if (outcome.kind === "ACCEPTED") runtime.chatVotes.accepted += 1;
  if (outcome.kind === "REJECTED") runtime.chatVotes.rejected += 1;
}

/** Twitch allows 10 seconds between the welcome message and the subscription. */
async function subscribe(generation: number, client: EventSubClient, sessionId: string): Promise<void> {
  const runtime = getTwitchRuntime();
  const config = readTwitchConfig();
  if (!config) return failIfCurrent(generation, "SUBSCRIPTION_FAILED");

  const requestSubscription = () => {
    const credentials = getTwitchRuntime().credentials;
    if (!credentials) return Promise.resolve({ ok: false, failure: "UNAUTHORIZED" } as const);
    return subscribeToChatMessages({
      clientId: config.clientId,
      accessToken: credentials.accessToken,
      sessionId,
      broadcasterUserId: credentials.broadcaster.userId,
    });
  };

  let result = await requestSubscription();
  if (!isCurrentSession(generation, client)) return;

  if (!result.ok && result.failure === "UNAUTHORIZED") {
    const refresh = await refreshTokens(generation);
    if (!isCurrentSession(generation, client)) return;
    if (refresh === "INVALID") return failTwitchConnection("TOKEN_INVALID");
    if (refresh === "UNAVAILABLE") return scheduleReconnect(generation, "token refresh unavailable");

    result = await requestSubscription();
    if (!isCurrentSession(generation, client)) return;
  }

  if (!result.ok) {
    if (result.failure === "UNAVAILABLE") return scheduleReconnect(generation, "subscription request failed");
    return failTwitchConnection(result.failure === "UNAUTHORIZED" ? "TOKEN_INVALID" : "SUBSCRIPTION_FAILED");
  }

  runtime.phase = "CONNECTED";
  runtime.lastError = null;
  runtime.reconnectAttempt = 0;
  console.info("[twitch] chat connected", { login: runtime.credentials?.broadcaster.login });
}

/** A new session needs new subscriptions, so reconnecting starts from scratch with backoff. */
function scheduleReconnect(generation: number, reason: string): void {
  const runtime = getTwitchRuntime();
  if (runtime.generation !== generation) return;

  runtime.eventSub?.close();
  runtime.eventSub = null;
  runtime.reconnectAttempt += 1;
  runtime.phase = "RECONNECTING";
  runtime.lastError = "CONNECTION_LOST";

  const delayMs = RECONNECT_DELAYS_MS[Math.min(runtime.reconnectAttempt, RECONNECT_DELAYS_MS.length) - 1];
  console.warn("[twitch] chat connection lost, reconnecting", { reason, attempt: runtime.reconnectAttempt, delayMs });

  runtime.reconnectTimer = setTimeout(() => {
    if (!isCurrentGeneration(generation)) return;
    getTwitchRuntime().reconnectTimer = null;
    openSession(generation);
  }, delayMs);
}

/** Refreshes the access token; concurrent callers share one request. Twitch may rotate the refresh token. */
function refreshTokens(generation: number): Promise<TokenRefreshOutcome> {
  const runtime = getTwitchRuntime();
  if (runtime.refreshInFlight) return runtime.refreshInFlight;

  const refresh = (async (): Promise<TokenRefreshOutcome> => {
    const config = readTwitchConfig();
    const credentials = runtime.credentials;
    if (!config || !credentials) return "INVALID";

    const result = await refreshAccessToken(config, credentials.refreshToken);
    if (!isCurrentGeneration(generation) || !runtime.credentials) return "UNAVAILABLE";
    if (!result.ok) {
      console.warn("[twitch] token refresh failed", { failure: result.failure });
      return result.failure === "UNAVAILABLE" ? "UNAVAILABLE" : "INVALID";
    }

    runtime.credentials = { ...runtime.credentials, ...result.value };
    return "REFRESHED";
  })();

  runtime.refreshInFlight = refresh;
  void refresh.finally(() => {
    if (runtime.refreshInFlight === refresh) runtime.refreshInFlight = null;
  });
  return refresh;
}

/** Hourly validation (a Twitch requirement). On 401 the token is refreshed; if that fails, the host must reconnect. */
async function validateToken(generation: number): Promise<void> {
  const credentials = getTwitchRuntime().credentials;
  if (!credentials || !isCurrentGeneration(generation)) return;

  const result = await validateAccessToken(credentials.accessToken);
  if (!isCurrentGeneration(generation) || result.ok) return;
  if (result.failure === "UNAVAILABLE") {
    console.warn("[twitch] hourly token validation unavailable; retrying next hour");
    return;
  }

  const refresh = await refreshTokens(generation);
  if (refresh === "INVALID") failIfCurrent(generation, "TOKEN_INVALID");
}
