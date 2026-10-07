import { defaultDeck } from "../../questions/fixtures/default-deck";
import { applyGameCommand, getAvailableCommands, type GameCommand, type TransitionResult } from "../domain/game-state";
import { toGameSnapshot, type GameSnapshot } from "../game-snapshot";
import { readGameState, writeGameState } from "./game-store";

// Application layer: wires the in-memory store to the pure domain functions
// and supplies the side effects (randomness, ids) and settings the domain must
// not own.

/** Spec §4: not hard-coded in the domain; five rounds is the initial default. */
const DEFAULT_TOTAL_ROUNDS = 5;

export function getGameSnapshot(): GameSnapshot {
  return toGameSnapshot(readGameState());
}

export function getAvailableHostCommands(): GameCommand[] {
  return getAvailableCommands(readGameState());
}

export function runGameCommand(command: GameCommand): TransitionResult {
  const result = applyGameCommand(readGameState(), command, {
    deck: defaultDeck,
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    randomNumber: Math.random,
    createId: () => crypto.randomUUID(),
  });
  if (result.ok) writeGameState(result.state);
  return result;
}
