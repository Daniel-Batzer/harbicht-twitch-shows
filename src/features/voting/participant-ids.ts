import type { ParticipantId } from "./domain/vote";

// Builds participant ids for the application layer (Decision 043). Ids are
// namespaced so identities from different origins can never collide. The
// domain treats them as opaque and never imports this file.
// Phase 5 adds `twitchParticipantId(twitchUserId)` → `twitch:<userId>`, which
// then also becomes the host's id (the broadcaster's Twitch user id).

/** The host before Twitch exists. */
export const LOCAL_HOST_PARTICIPANT_ID: ParticipantId = "local:host";

/** A simulated viewer from the host's dev controls, e.g. `local:sim-viewer-7`. */
export function simulatedParticipantId(viewerKey: string): ParticipantId {
  return `local:sim-${viewerKey}`;
}
