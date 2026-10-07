import { z } from "zod";

// The host's name as shown on the overlay ("Louis picked…"). Configuration is
// a boundary (Decision 029), so the environment value is validated here.
// Phase 5 replaces this with the broadcaster's Twitch display name.

export const DEFAULT_HOST_DISPLAY_NAME = "Host";

const hostDisplayNameSchema = z.string().trim().min(1).max(32);

/** Reads HOST_DISPLAY_NAME on the server; falls back to "Host" when it is missing or invalid. */
export function readHostDisplayName(): string {
  const parsed = hostDisplayNameSchema.safeParse(process.env.HOST_DISPLAY_NAME);
  return parsed.success ? parsed.data : DEFAULT_HOST_DISPLAY_NAME;
}
