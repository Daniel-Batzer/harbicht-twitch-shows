import type { ParticipantId } from "./domain/vote";

// Builds participant ids for the application layer (Decision 043). Ids are
// namespaced so identities from different origins can never collide. The
// domain treats them as opaque and never imports this file.

/** The host while Twitch is not connected. */
export const LOCAL_HOST_PARTICIPANT_ID: ParticipantId = "local:host";

/** A simulated viewer from the host's dev controls, e.g. `local:sim-viewer-7`. */
export function simulatedParticipantId(viewerKey: string): ParticipantId {
  return `local:sim-${viewerKey}`;
}

/**
 * A Twitch user, keyed by their stable Twitch user id, never by login or
 * display name (Decision 011). The broadcaster gets their id this way too, so
 * it becomes the host's id while Twitch is connected (Decision 046).
 */
export function twitchParticipantId(twitchUserId: string): ParticipantId {
  return `twitch:${twitchUserId}`;
}
