import { initialGameState, type GameState } from "../domain/game-state";

// TEMPORARY (Decision 041): the current game lives in server memory until a
// realtime/persistence decision replaces it. It is stored on globalThis because
// in `next dev` the route handler and the page/server action can be bundled as
// separate module instances, and HMR re-evaluates modules; a module-level
// variable could then hold two different "current games".
// This file is the only place that touches the global.

type GameStoreGlobal = typeof globalThis & {
  __harbichtGameState?: GameState;
};

const storeGlobal = globalThis as GameStoreGlobal;

export function readGameState(): GameState {
  return storeGlobal.__harbichtGameState ?? initialGameState;
}

export function writeGameState(state: GameState): void {
  storeGlobal.__harbichtGameState = state;
}
