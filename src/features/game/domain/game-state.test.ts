import { describe, expect, it } from "vitest";
import type { Deck } from "../../questions/domain/question";
import { endGame, initialGameState, startGame, type GameState, type StartGameDependencies } from "./game-state";

const deck: Deck = {
  id: "test-deck",
  name: "Test deck",
  questions: [
    {
      id: "q1",
      prompt: "First?",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    },
    {
      id: "q2",
      context: "Whenever something happens...",
      prompt: "Second?",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    },
  ],
};

function makeDependencies(randomNumber = 0): StartGameDependencies {
  let nextId = 0;
  return {
    randomNumber: () => randomNumber,
    createId: () => `id-${++nextId}`,
  };
}

describe("startGame", () => {
  it("moves from IDLE to INTRO with a selected question and injected ids", () => {
    const result = startGame(initialGameState, deck, makeDependencies(0.9));

    expect(result).toEqual({
      ok: true,
      state: {
        status: "INTRO",
        sessionId: "id-1",
        deckId: "test-deck",
        currentRound: { id: "id-2", number: 1, question: deck.questions[1] },
      },
    });
  });

  it("rejects starting while a game is running and leaves the state unchanged", () => {
    const started = startGame(initialGameState, deck, makeDependencies());
    if (!started.ok) throw new Error("expected game to start");
    const runningState: GameState = started.state;
    const snapshotBefore = structuredClone(runningState);

    const result = startGame(runningState, deck, makeDependencies());

    expect(result).toEqual({ ok: false, reason: "GAME_ALREADY_RUNNING" });
    expect(runningState).toEqual(snapshotBefore);
  });

  it("rejects an empty deck", () => {
    const emptyDeck: Deck = { ...deck, questions: [] };

    expect(startGame(initialGameState, emptyDeck, makeDependencies())).toEqual({
      ok: false,
      reason: "DECK_EMPTY",
    });
  });
});

describe("endGame", () => {
  it("moves from INTRO back to IDLE", () => {
    const started = startGame(initialGameState, deck, makeDependencies());
    if (!started.ok) throw new Error("expected game to start");

    expect(endGame(started.state)).toEqual({ ok: true, state: { status: "IDLE" } });
  });

  it("rejects ending when no game is running", () => {
    expect(endGame(initialGameState)).toEqual({ ok: false, reason: "NO_GAME_RUNNING" });
  });
});
