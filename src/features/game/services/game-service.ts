import { defaultDeck } from "../../questions/fixtures/default-deck";
import { getConnectedBroadcasterParticipantId } from "../../twitch/twitch-connection-store";
import type { ParticipantId, VoteInput } from "../../voting/domain/vote";
import { LOCAL_HOST_PARTICIPANT_ID, simulatedParticipantId } from "../../voting/participant-ids";
import { pickSimulatedVotes } from "../../voting/simulated-votes";
import { toChatVoteInput, type ChatVote, type ChatVoteInputFailure } from "../chat-vote-input";
import { castVote, type VoteFailure, type VoteReceipt, type VoteResult } from "../domain/cast-vote";
import {
  applyGameCommand,
  getAvailableCommands,
  type GameCommand,
  type GameState,
  type RevealOrder,
  type SharedChatVotingMode,
  type TransitionResult,
} from "../domain/game-state";
import { settleVotingDeadline } from "../domain/voting-timer";
import { toGameSnapshot, type GameSnapshot } from "../game-snapshot";
import { toHostRoundView, type HostRoundView } from "../host-view";
import { readGameState, writeGameState } from "./game-store";
import { readHostDisplayName } from "./host-display-name";

// Application layer: wires the in-memory store to the pure domain functions
// and supplies the side effects (randomness, ids, clock) and settings the
// domain must not own.
//
// Every write below is read → settle → apply → write without an `await` in
// between. Node runs it to completion, so two votes arriving at once cannot
// overwrite each other. Chat votes from the Twitch connection rely on this
// too, so keep it synchronous.
//
// The server clock is the only authoritative time (Decision 047). It is read
// here, once per operation, and handed to the domain. Every access to the
// game first settles the voting deadline. closesAtMs is the logical deadline;
// the stored VOTING → LOCKED transition is materialized on the next access
// after it, not at that instant. Because settlement runs before every vote,
// a vote received at or after closesAtMs is always rejected.

/** Spec §4: not hard-coded in the domain; five rounds is the initial default. */
const DEFAULT_TOTAL_ROUNDS = 5;

/** Preselected on the host's start form and used when no order is given (Decision 044). */
export const DEFAULT_REVEAL_ORDER: RevealOrder = "AUDIENCE_FIRST";

/** Preselected on the host's start form and used when no mode is given (Decision 046). */
export const DEFAULT_SHARED_CHAT_VOTING_MODE: SharedChatVotingMode = "OWN_CHANNEL_ONLY";

/** Preselected on the host's start form: no timer, the host locks by hand (Decisions 016, 047). */
export const DEFAULT_VOTING_DURATION_SECONDS: number | null = null;

/**
 * How long after the countdown ends late votes still count (Decision 047).
 * Viewers see the overlay with stream delay, and chat messages take a moment
 * to arrive. Only the timer has a grace period; a manual lock is immediate.
 */
const VOTE_GRACE_PERIOD_MS = 3000;

/**
 * DEV: the simulated-viewer controls only exist in `next dev`, so a real
 * stream never mixes simulated votes with chat votes.
 */
export const isVoteSimulationEnabled = process.env.NODE_ENV === "development";

/** DEV: random votes are drawn from this many simulated viewers. */
const SIMULATED_VIEWER_POOL_SIZE = 30;

export type SimulatedVotesResult = { ok: true; votesCast: number } | { ok: false; failure: VoteFailure };

export type ChatVoteFailure = VoteFailure | ChatVoteInputFailure;
export type ChatVoteResult = VoteResult | { ok: false; failure: ChatVoteFailure };

/** One reading of the server clock for a vote: the deadline check and the stored timestamp agree. */
function receiveVoteNow(): VoteReceipt {
  const receivedAtMs = Date.now();
  return { receivedAtMs, castAt: new Date(receivedAtMs).toISOString() };
}

/**
 * The current game as of `nowMs`. If the voting timer's deadline (closesAtMs)
 * has passed, the round is moved to LOCKED and stored. This is where the
 * logical deadline is materialized: on the first access at or after it.
 */
function readCurrentGameState(nowMs: number): GameState {
  const stored = readGameState();
  const settled = settleVotingDeadline(stored, nowMs);
  if (settled !== stored) writeGameState(settled);
  return settled;
}

export function getGameSnapshot(): GameSnapshot {
  return toGameSnapshot(readCurrentGameState(Date.now()), { hostDisplayName: readHostDisplayName() });
}

/** Host-only: never expose this through the public API route. */
export function getHostRoundView(): HostRoundView | null {
  return toHostRoundView(readCurrentGameState(Date.now()));
}

export function getAvailableHostCommands(): GameCommand[] {
  const nowMs = Date.now();
  return getAvailableCommands(readCurrentGameState(nowMs), nowMs);
}

/** Per-game choices of the host. Only START_GAME reads them; the session keeps them until it ends. */
export type GameCommandOptions = {
  revealOrder?: RevealOrder;
  sharedChatVotingMode?: SharedChatVotingMode;
  /** null: no timer. Omitted: the default. */
  votingDurationSeconds?: number | null;
};

export function runGameCommand(command: GameCommand, options: GameCommandOptions = {}): TransitionResult {
  const nowMs = Date.now();
  const result = applyGameCommand(readCurrentGameState(nowMs), command, {
    deck: defaultDeck,
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    // With Twitch connected the host is the broadcaster's Twitch identity (Decision 046).
    hostParticipantId: getConnectedBroadcasterParticipantId() ?? LOCAL_HOST_PARTICIPANT_ID,
    revealOrder: options.revealOrder ?? DEFAULT_REVEAL_ORDER,
    sharedChatVotingMode: options.sharedChatVotingMode ?? DEFAULT_SHARED_CHAT_VOTING_MODE,
    votingDurationSeconds:
      options.votingDurationSeconds === undefined ? DEFAULT_VOTING_DURATION_SECONDS : options.votingDurationSeconds,
    voteGracePeriodMs: VOTE_GRACE_PERIOD_MS,
    nowMs,
    randomNumber: Math.random,
    createId: () => crypto.randomUUID(),
  });
  if (result.ok) writeGameState(result.state);
  return result;
}

/** `state` must be the settled state as of `receipt.receivedAtMs`. */
function runVote(state: GameState, input: VoteInput, receipt: VoteReceipt): VoteResult {
  const result = castVote(state, input, receipt);
  if (result.ok) writeGameState(result.state);
  return result;
}

/** The host votes as the session's host participant; the id never comes from the client. */
export function castHostVote(optionId: string): VoteResult {
  const receipt = receiveVoteNow();
  const state = readCurrentGameState(receipt.receivedAtMs);
  // Outside a running game there is no session and therefore no host id yet.
  const participantId = state.status === "IDLE" ? LOCAL_HOST_PARTICIPANT_ID : state.session.hostParticipantId;
  return runVote(state, { participantId, optionId, source: "HOST" }, receipt);
}

/** The running session's Shared Chat setting, or null when no game is running. */
export function getSharedChatVotingMode(): SharedChatVotingMode | null {
  const state = readCurrentGameState(Date.now());
  return state.status === "IDLE" ? null : state.session.sharedChatVotingMode;
}

/**
 * A vote from chat, already translated by the chat adapter. The broadcaster's
 * participant id is passed separately so their chat votes count as the host's
 * vote (see toChatVoteInput).
 */
export function castChatVote(chatVote: ChatVote, broadcasterParticipantId: ParticipantId): ChatVoteResult {
  // Received when our server processes the message; Twitch's own timestamps are not used (Decision 047).
  const receipt = receiveVoteNow();
  const state = readCurrentGameState(receipt.receivedAtMs);
  const resolved = toChatVoteInput(state, chatVote, broadcasterParticipantId);
  if (!resolved.ok) return { ok: false, failure: resolved.failure };
  return runVote(state, resolved.input, receipt);
}

/** DEV: one vote from a named simulated viewer. Voting again with the same key replaces the vote. */
export function castSimulatedVote(viewerKey: string, optionId: string): VoteResult {
  const receipt = receiveVoteNow();
  const state = readCurrentGameState(receipt.receivedAtMs);
  return runVote(state, { participantId: simulatedParticipantId(viewerKey), optionId, source: "SIMULATED" }, receipt);
}

/** DEV: a batch of random votes from the simulated viewer pool, written in one step. */
export function simulateRandomVotes(count: number): SimulatedVotesResult {
  const receipt = receiveVoteNow();
  const state = readCurrentGameState(receipt.receivedAtMs);
  // Same rule as castVote, checked up front so an empty batch is never reported as success.
  if (state.status !== "VOTING") return { ok: false, failure: { reason: "VOTING_NOT_OPEN", status: state.status } };

  const choices = pickSimulatedVotes({
    count,
    poolSize: SIMULATED_VIEWER_POOL_SIZE,
    optionIds: state.currentRound.question.options.map((option) => option.id),
    randomNumber: Math.random,
  });

  let nextState: GameState = state;
  for (const choice of choices) {
    const input: VoteInput = {
      participantId: simulatedParticipantId(choice.viewerKey),
      optionId: choice.optionId,
      source: "SIMULATED",
    };
    const result = castVote(nextState, input, receipt);
    if (!result.ok) return { ok: false, failure: result.failure };
    nextState = result.state;
  }

  writeGameState(nextState);
  return { ok: true, votesCast: choices.length };
}
