import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/features/twitch/oauth-state-cookie";
import { buildAuthorizeUrl } from "@/features/twitch/twitch-api";
import { readTwitchConfig } from "@/features/twitch/twitch-config";

// "Connect Twitch" on /host: sends the host to Twitch's consent page
// (Authorization Code Grant, scope user:read:chat; Decision 046).
export async function GET(request: NextRequest) {
  const config = readTwitchConfig();
  // The host panel already says what is missing.
  if (!config) return NextResponse.redirect(new URL("/host", request.url));

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}
