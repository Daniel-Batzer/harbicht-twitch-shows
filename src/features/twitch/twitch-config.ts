import { z } from "zod";

// Twitch app credentials from the environment. Configuration is a boundary
// (Decision 029). Values are never logged or rendered, only whether they are set.

const twitchConfigSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
  /** Must match the OAuth Redirect URL registered in the Twitch developer console exactly. */
  redirectUri: z.url({ protocol: /^https?$/ }),
});

export type TwitchConfig = z.infer<typeof twitchConfigSchema>;

/** Null when any variable is missing or invalid; the host panel then shows "not configured". */
export function readTwitchConfig(): TwitchConfig | null {
  const parsed = twitchConfigSchema.safeParse({
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI,
  });
  return parsed.success ? parsed.data : null;
}
