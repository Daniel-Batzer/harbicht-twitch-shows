import { z } from "zod";
import type { TwitchConfig } from "./twitch-config";

// HTTP calls to Twitch: OAuth (Authorization Code Grant, refresh, validate)
// and creating the EventSub subscription. Responses are validated with Zod.
// Tokens are never logged; failures only report a category.
// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
// https://dev.twitch.tv/docs/authentication/validate-tokens/
// https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription

const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const EVENTSUB_SUBSCRIPTIONS_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";

/** The only scope this app asks for: read chat as the broadcaster. No write scopes. */
export const CHAT_READ_SCOPE = "user:read:chat";

/**
 * UNAUTHORIZED: the token is invalid or expired (refresh, then retry).
 * REJECTED: Twitch refused the request; retrying the same request will not help.
 * UNAVAILABLE: network error, server error or an unexpected response; retrying may help.
 */
export type TwitchRequestFailure = "UNAUTHORIZED" | "REJECTED" | "UNAVAILABLE";

export type TwitchResult<T> = { ok: true; value: T } | { ok: false; failure: TwitchRequestFailure };

export type TwitchTokens = {
  accessToken: string;
  refreshToken: string;
  /** As reported by Twitch. Metadata only: nothing is scheduled from it (we validate hourly and refresh on 401). */
  expiresInSeconds: number | null;
};

export type ValidatedToken = {
  clientId: string;
  userId: string;
  login: string;
  scopes: string[];
};

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().optional(),
});

const validateResponseSchema = z.object({
  client_id: z.string().min(1),
  // Null for app access tokens; this app only ever holds user tokens.
  login: z.string().min(1),
  user_id: z.string().regex(/^\d+$/),
  scopes: z.array(z.string()).nullable(),
});

function failureFromStatus(status: number): TwitchRequestFailure {
  if (status === 401) return "UNAUTHORIZED";
  if (status >= 400 && status < 500) return "REJECTED";
  return "UNAVAILABLE";
}

/** fetch that turns network errors into UNAVAILABLE instead of throwing. */
type TwitchResponse = { ok: true; response: Response } | { ok: false };

async function requestTwitch(url: string, init: RequestInit): Promise<TwitchResponse> {
  try {
    return { ok: true, response: await fetch(url, { ...init, cache: "no-store" }) };
  } catch (error) {
    console.warn("[twitch] request failed", { url, error: error instanceof Error ? error.message : String(error) });
    return { ok: false };
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(config: TwitchConfig, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", CHAT_READ_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestTokens(parameters: Record<string, string>): Promise<TwitchResult<TwitchTokens>> {
  const result = await requestTwitch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
  });
  if (!result.ok) return { ok: false, failure: "UNAVAILABLE" };
  if (!result.response.ok) return { ok: false, failure: failureFromStatus(result.response.status) };

  const parsed = tokenResponseSchema.safeParse(await readJson(result.response));
  if (!parsed.success) return { ok: false, failure: "UNAVAILABLE" };
  return {
    ok: true,
    value: {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresInSeconds: parsed.data.expires_in ?? null,
    },
  };
}

export function exchangeAuthorizationCode(config: TwitchConfig, code: string): Promise<TwitchResult<TwitchTokens>> {
  return requestTokens({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
}

/** Twitch may return a new refresh token; callers must keep the returned one. */
export function refreshAccessToken(config: TwitchConfig, refreshToken: string): Promise<TwitchResult<TwitchTokens>> {
  return requestTokens({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Required by Twitch when the OAuth session starts and hourly afterwards. */
export async function validateAccessToken(accessToken: string): Promise<TwitchResult<ValidatedToken>> {
  const result = await requestTwitch(VALIDATE_URL, { headers: { Authorization: `OAuth ${accessToken}` } });
  if (!result.ok) return { ok: false, failure: "UNAVAILABLE" };
  if (!result.response.ok) return { ok: false, failure: failureFromStatus(result.response.status) };

  const parsed = validateResponseSchema.safeParse(await readJson(result.response));
  if (!parsed.success) return { ok: false, failure: "UNAVAILABLE" };
  return {
    ok: true,
    value: {
      clientId: parsed.data.client_id,
      userId: parsed.data.user_id,
      login: parsed.data.login,
      scopes: parsed.data.scopes ?? [],
    },
  };
}

type ChatSubscriptionRequest = {
  clientId: string;
  accessToken: string;
  /** From the WebSocket's session_welcome. */
  sessionId: string;
  broadcasterUserId: string;
};

/**
 * Subscribes the WebSocket session to the broadcaster's chat. The broadcaster
 * reads their own chat (`user_id` = `broadcaster_user_id`), so no bot account
 * and no `user:bot`/`channel:bot` scopes are needed.
 */
export async function subscribeToChatMessages(request: ChatSubscriptionRequest): Promise<TwitchResult<null>> {
  const result = await requestTwitch(EVENTSUB_SUBSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.accessToken}`,
      "Client-Id": request.clientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: { broadcaster_user_id: request.broadcasterUserId, user_id: request.broadcasterUserId },
      transport: { method: "websocket", session_id: request.sessionId },
    }),
  });
  if (!result.ok) return { ok: false, failure: "UNAVAILABLE" };
  if (result.response.status !== 202) {
    console.warn("[twitch] creating the chat subscription failed", { status: result.response.status });
    return { ok: false, failure: failureFromStatus(result.response.status) };
  }
  return { ok: true, value: null };
}
