import { defaultDeck } from "../../questions/fixtures/default-deck";
import { endGame, startGame, type TransitionResult } from "../domain/game-state";
import { toGameSnapshot, type GameSnapshot } from "../game-snapshot";
import { readGameState, writeGameState } from "./game-store";

// Application layer: wires the in-memory store to the pure domain functions
// and supplies the side effects (randomness, ids) the domain must not own.

export function getGameSnapshot(): GameSnapshot {
  return toGameSnapshot(readGameState());
}

export function startNewGame(): TransitionResult {
  const result = startGame(readGameState(), defaultDeck, {
    randomNumber: Math.random,
    createId: () => crypto.randomUUID(),
  });
  if (result.ok) writeGameState(result.state);
  return result;
}

export function endCurrentGame(): TransitionResult {
  const result = endGame(readGameState());
  if (result.ok) writeGameState(result.state);
  return result;
}
