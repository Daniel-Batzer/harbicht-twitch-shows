import { findOptionIdByNumber } from "../questions/domain/question";
import type { ParticipantId, VoteInput } from "../voting/domain/vote";
import type { GameState, GameStatus } from "./domain/game-state";

// Application layer: turns a chat vote into the domain's VoteInput
// (Decision 046). It is platform-neutral: the chat adapter (Twitch today)
// has already turned the chatter into an opaque participant id and the
// command into an option number. Whether the vote counts is still decided
// by castVote.

/** A vote command from chat, already stripped of everything platform-specific. */
export type ChatVote = {
  participantId: ParticipantId;
  /** 1-based, as shown on the answer cards. Not yet checked against the question. */
  optionNumber: number;
};

export type ChatVoteInputFailure =
  | { reason: "VOTING_NOT_OPEN"; status: GameStatus }
  | { reason: "OPTION_NUMBER_OUT_OF_RANGE"; optionNumber: number };

export type ChatVoteInputResult = { ok: true; input: VoteInput } | { ok: false; failure: ChatVoteInputFailure };

/**
 * Resolves the option number against the current question and the chatter
 * against the session's host. The broadcaster's chat votes are recorded under
 * `session.hostParticipantId`, so a dashboard vote and a chat vote of the host
 * replace each other, even if the session started before chat was connected
 * (and the host id is still `local:host`).
 */
export function toChatVoteInput(
  state: GameState,
  chatVote: ChatVote,
  broadcasterParticipantId: ParticipantId,
): ChatVoteInputResult {
  // Without a round there is no question to resolve the number against.
  if (state.status === "IDLE" || state.status === "FINISHED") {
    return { ok: false, failure: { reason: "VOTING_NOT_OPEN", status: state.status } };
  }

  const optionId = findOptionIdByNumber(state.currentRound.question, chatVote.optionNumber);
  if (!optionId) {
    return { ok: false, failure: { reason: "OPTION_NUMBER_OUT_OF_RANGE", optionNumber: chatVote.optionNumber } };
  }

  const isBroadcaster = chatVote.participantId === broadcasterParticipantId;
  const participantId = isBroadcaster ? state.session.hostParticipantId : chatVote.participantId;
  return { ok: true, input: { participantId, optionId, source: "CHAT" } };
}
