import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/features/twitch/oauth-state-cookie";
import { CHAT_READ_SCOPE, exchangeAuthorizationCode, validateAccessToken } from "@/features/twitch/twitch-api";
import { readTwitchConfig } from "@/features/twitch/twitch-config";
import { reportFailedConnectAttempt, startTwitchConnection } from "@/features/twitch/twitch-connection";
import type { TwitchConnectionError } from "@/features/twitch/twitch-connection-store";

// Twitch redirects here after the consent page. Query parameters are external
// input (Decision 029). Every outcome leads back to /host, which shows the
// connection status or the error; tokens never appear in a URL or a log.

const callbackQuerySchema = z.object({
  state: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/host", request.url));
  // The state is single-use.
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...OAUTH_STATE_COOKIE_OPTIONS, maxAge: 0 });

  const error = await connect(request);
  if (error) reportFailedConnectAttempt(error);
  return response;
}

/** Returns the error to show on /host, or null once the connection has started. */
async function connect(request: NextRequest): Promise<TwitchConnectionError | null> {
  const config = readTwitchConfig();
  if (!config) return "AUTH_FAILED";

  const query = callbackQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return "AUTH_FAILED";

  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || query.data.state !== expectedState) return "STATE_MISMATCH";
  if (query.data.error) return "AUTH_DENIED";
  if (!query.data.code) return "AUTH_FAILED";

  const tokens = await exchangeAuthorizationCode(config, query.data.code);
  if (!tokens.ok) return "AUTH_FAILED";

  // Twitch requires validating a token when the OAuth session starts.
  const validated = await validateAccessToken(tokens.value.accessToken);
  if (!validated.ok || validated.value.clientId !== config.clientId) return "AUTH_FAILED";
  if (!validated.value.scopes.includes(CHAT_READ_SCOPE)) return "MISSING_SCOPE";

  startTwitchConnection(tokens.value, { userId: validated.value.userId, login: validated.value.login });
  return null;
}
