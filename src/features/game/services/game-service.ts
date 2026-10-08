import { defaultDeck } from "../../questions/fixtures/default-deck";
import type { VoteInput } from "../../voting/domain/vote";
import { LOCAL_HOST_PARTICIPANT_ID, simulatedParticipantId } from "../../voting/participant-ids";
import { pickSimulatedVotes } from "../../voting/simulated-votes";
import { castVote, type VoteFailure, type VoteResult } from "../domain/cast-vote";
import {
  applyGameCommand,
  getAvailableCommands,
  type GameCommand,
  type GameState,
  type RevealOrder,
  type TransitionResult,
} from "../domain/game-state";
import { toGameSnapshot, type GameSnapshot } from "../game-snapshot";
import { toHostRoundView, type HostRoundView } from "../host-view";
import { readGameState, writeGameState } from "./game-store";
import { readHostDisplayName } from "./host-display-name";

// Application layer: wires the in-memory store to the pure domain functions
// and supplies the side effects (randomness, ids, clock) and settings the
// domain must not own.
//
// Every write below is read → apply → write without an `await` in between.
// Node runs it to completion, so two votes arriving at once cannot overwrite
// each other. Keep it synchronous when vote sources multiply (Twitch).

/** Spec §4: not hard-coded in the domain; five rounds is the initial default. */
const DEFAULT_TOTAL_ROUNDS = 5;

/** Preselected on the host's start form and used when no order is given (Decision 044). */
export const DEFAULT_REVEAL_ORDER: RevealOrder = "AUDIENCE_FIRST";

/** DEV: random votes are drawn from this many simulated viewers. */
const SIMULATED_VIEWER_POOL_SIZE = 30;

export type SimulatedVotesResult = { ok: true; votesCast: number } | { ok: false; failure: VoteFailure };

function now(): string {
  return new Date().toISOString();
}

export function getGameSnapshot(): GameSnapshot {
  return toGameSnapshot(readGameState(), { hostDisplayName: readHostDisplayName() });
}

/** Host-only: never expose this through the public API route. */
export function getHostRoundView(): HostRoundView | null {
  return toHostRoundView(readGameState());
}

export function getAvailableHostCommands(): GameCommand[] {
  return getAvailableCommands(readGameState());
}

/** Per-game choices of the host. Only START_GAME reads them; the session keeps them until it ends. */
export type GameCommandOptions = {
  revealOrder?: RevealOrder;
};

export function runGameCommand(command: GameCommand, options: GameCommandOptions = {}): TransitionResult {
  const result = applyGameCommand(readGameState(), command, {
    deck: defaultDeck,
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    hostParticipantId: LOCAL_HOST_PARTICIPANT_ID,
    revealOrder: options.revealOrder ?? DEFAULT_REVEAL_ORDER,
    randomNumber: Math.random,
    createId: () => crypto.randomUUID(),
  });
  if (result.ok) writeGameState(result.state);
  return result;
}

function runVote(input: VoteInput): VoteResult {
  const result = castVote(readGameState(), input, now());
  if (result.ok) writeGameState(result.state);
  return result;
}

/** The host votes as the session's host participant; the id never comes from the client. */
export function castHostVote(optionId: string): VoteResult {
  const state = readGameState();
  // Outside a running game there is no session and therefore no host id yet.
  const participantId = state.status === "IDLE" ? LOCAL_HOST_PARTICIPANT_ID : state.session.hostParticipantId;
  return runVote({ participantId, optionId, source: "HOST" });
}

/** DEV: one vote from a named simulated viewer. Voting again with the same key replaces the vote. */
export function castSimulatedVote(viewerKey: string, optionId: string): VoteResult {
  return runVote({ participantId: simulatedParticipantId(viewerKey), optionId, source: "SIMULATED" });
}

/** DEV: a batch of random votes from the simulated viewer pool, written in one step. */
export function simulateRandomVotes(count: number): SimulatedVotesResult {
  const state = readGameState();
  // Same rule as castVote, checked up front so an empty batch is never reported as success.
  if (state.status !== "VOTING") return { ok: false, failure: { reason: "VOTING_NOT_OPEN", status: state.status } };

  const choices = pickSimulatedVotes({
    count,
    poolSize: SIMULATED_VIEWER_POOL_SIZE,
    optionIds: state.currentRound.question.options.map((option) => option.id),
    randomNumber: Math.random,
  });

  const castAt = now();
  let nextState: GameState = state;
  for (const choice of choices) {
    const input: VoteInput = {
      participantId: simulatedParticipantId(choice.viewerKey),
      optionId: choice.optionId,
      source: "SIMULATED",
    };
    const result = castVote(nextState, input, castAt);
    if (!result.ok) return { ok: false, failure: result.failure };
    nextState = result.state;
  }

  writeGameState(nextState);
  return { ok: true, votesCast: choices.length };
}
