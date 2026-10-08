// CSRF protection for the OAuth redirect: the start route stores a random
// `state` in this cookie, and the callback only accepts Twitch's redirect if
// it carries the same value.

export const OAUTH_STATE_COOKIE = "twitch_oauth_state";

export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  // Lax is sent on the top-level redirect back from id.twitch.tv.
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  // Only the callback needs it.
  path: "/api/twitch/auth",
  maxAge: 10 * 60,
} as const;
