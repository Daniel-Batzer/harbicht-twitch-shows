import { describe, expect, it } from "vitest";
import type { Deck, Question } from "../../questions/domain/question";
import type { VoteInput } from "../../voting/domain/vote";
import { castVote, type VoteResult } from "./cast-vote";
import {
  applyGameCommand,
  initialGameState,
  type GameCommand,
  type GameCommandContext,
  type GameState,
  type RoundInProgressState,
  type TransitionResult,
} from "./game-state";

function makeQuestion(id: string): Question {
  return {
    id,
    prompt: `Prompt ${id}?`,
    options: [
      { id: `${id}-a`, label: "A" },
      { id: `${id}-b`, label: "B" },
      { id: `${id}-c`, label: "C" },
    ],
  };
}

const deck: Deck = { id: "test-deck", name: "Test deck", questions: [makeQuestion("q1"), makeQuestion("q2")] };
const HOST = "local:host";
const CAST_AT = "2026-10-07T12:00:00.000Z";

function makeContext(): GameCommandContext {
  let nextId = 0;
  return {
    deck,
    totalRounds: 2,
    hostParticipantId: HOST,
    revealOrder: "AUDIENCE_FIRST",
    // Always picks the first unplayed question: round 1 asks q1, round 2 asks q2.
    randomNumber: () => 0,
    createId: () => `id-${++nextId}`,
  };
}

function expectTransition(result: TransitionResult): GameState {
  if (!result.ok) throw new Error(`expected transition to succeed, got ${result.failure.reason}`);
  return result.state;
}

function expectVote(result: VoteResult): GameState {
  if (!result.ok) throw new Error(`expected vote to succeed, got ${result.failure.reason}`);
  return result.state;
}

function run(state: GameState, commands: GameCommand[], context = makeContext()): GameState {
  return commands.reduce((current, command) => expectTransition(applyGameCommand(current, command, context)), state);
}

function viewerVote(viewer: string, optionId: string): VoteInput {
  return { participantId: `local:sim-${viewer}`, optionId, source: "SIMULATED" };
}

function votesOf(state: GameState) {
  if (state.status === "IDLE") throw new Error("expected a running game");
  return state.session.votes;
}

function expectVotingState(state: GameState): RoundInProgressState {
  if (state.status !== "VOTING") throw new Error(`expected VOTING, got ${state.status}`);
  return state;
}

const votingState = expectVotingState(run(initialGameState, ["START_GAME", "OPEN_VOTING"]));

describe("castVote", () => {
  const statesWithClosedVoting = {
    IDLE: initialGameState,
    INTRO: run(initialGameState, ["START_GAME"]),
    LOCKED: run(votingState, ["LOCK_VOTING"]),
    REVEAL: run(votingState, ["LOCK_VOTING", "REVEAL_RESULT"]),
    RESULT: run(votingState, ["LOCK_VOTING", "REVEAL_RESULT", "SHOW_RESULT"]),
    FINISHED: run(votingState, ["LOCK_VOTING", "REVEAL_RESULT", "SHOW_RESULT", "FINISH_GAME"]),
  } satisfies Record<string, GameState>;

  it.each(Object.entries(statesWithClosedVoting))("rejects a vote in %s without changing the state", (_, state) => {
    const stateBefore = structuredClone(state);

    const result = castVote(state, viewerVote("viewer-1", "q1-a"), CAST_AT);

    expect(result).toEqual({ ok: false, failure: { reason: "VOTING_NOT_OPEN", status: state.status } });
    expect(state).toEqual(stateBefore);
  });

  it("records a valid vote for the current round", () => {
    const state = expectVote(castVote(votingState, viewerVote("viewer-1", "q1-b"), CAST_AT));

    expect(votesOf(state)).toEqual([
      { participantId: "local:sim-viewer-1", optionId: "q1-b", source: "SIMULATED", roundId: "id-2", castAt: CAST_AT },
    ]);
  });

  it("changes neither the status nor the round", () => {
    const state = expectVote(castVote(votingState, viewerVote("viewer-1", "q1-b"), CAST_AT));

    expect(state).toEqual({ ...votingState, session: { ...votingState.session, votes: votesOf(state) } });
  });

  it("rejects an option that is not part of the current question and keeps the previous vote", () => {
    const withVote = expectVote(castVote(votingState, viewerVote("viewer-1", "q1-a"), CAST_AT));
    const stateBefore = structuredClone(withVote);

    const result = castVote(withVote, viewerVote("viewer-1", "q2-a"), CAST_AT);

    expect(result).toEqual({ ok: false, failure: { reason: "INVALID_OPTION", optionId: "q2-a" } });
    expect(withVote).toEqual(stateBefore);
  });

  it("replaces a participant's earlier vote so only the latest one counts", () => {
    const first = castVote(votingState, viewerVote("viewer-1", "q1-a"), CAST_AT);
    const second = castVote(expectVote(first), viewerVote("viewer-1", "q1-c"), "2026-10-07T12:00:09.000Z");

    expect(second.ok && second.replacedVote?.optionId).toBe("q1-a");
    expect(votesOf(expectVote(second))).toEqual([
      expect.objectContaining({ participantId: "local:sim-viewer-1", optionId: "q1-c" }),
    ]);
  });

  it("stores the host vote as a normal vote that belongs to the host", () => {
    const state = expectVote(castVote(votingState, { participantId: HOST, optionId: "q1-a", source: "HOST" }, CAST_AT));

    expect(votesOf(state)).toEqual([expect.objectContaining({ participantId: HOST, source: "HOST", optionId: "q1-a" })]);
  });

  describe("votes across rounds", () => {
    const roundOneVotes = [viewerVote("viewer-1", "q1-a"), viewerVote("viewer-2", "q1-b")].reduce<GameState>(
      (state, input) => expectVote(castVote(state, input, CAST_AT)),
      votingState,
    );
    const roundOneVoteList = votesOf(roundOneVotes);

    it("keeps earlier rounds' votes when the next round starts, and the new round starts without votes", () => {
      const nextRound = run(roundOneVotes, ["LOCK_VOTING", "REVEAL_RESULT", "SHOW_RESULT", "START_NEXT_ROUND"]);
      if (nextRound.status !== "INTRO") throw new Error("expected INTRO");

      expect(nextRound.session.votes).toEqual(roundOneVoteList);
      expect(nextRound.session.votes.some((vote) => vote.roundId === nextRound.currentRound.id)).toBe(false);
    });

    it("lets the same participant vote again in the next round", () => {
      const nextVoting = run(roundOneVotes, [
        "LOCK_VOTING",
        "REVEAL_RESULT",
        "SHOW_RESULT",
        "START_NEXT_ROUND",
        "OPEN_VOTING",
      ]);

      const state = expectVote(castVote(nextVoting, viewerVote("viewer-1", "q2-c"), CAST_AT));

      expect(votesOf(state)).toHaveLength(3);
    });

    it("keeps all votes in FINISHED for later similarity", () => {
      const finished = run(roundOneVotes, ["LOCK_VOTING", "REVEAL_RESULT", "SHOW_RESULT", "FINISH_GAME"]);

      expect(votesOf(finished)).toEqual(roundOneVoteList);
    });

    it("discards votes when the game ends", () => {
      expect(run(roundOneVotes, ["END_GAME"])).toEqual(initialGameState);
    });
  });
});
