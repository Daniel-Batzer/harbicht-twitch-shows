import { describe, expect, it } from "vitest";
import type { Question } from "../questions/domain/question";
import type { Vote } from "../voting/domain/vote";
import type { CurrentRound, GameSession, RevealOrder, RoundPhase } from "./domain/game-state";
import { toGameSnapshot } from "./game-snapshot";

const question: Question = {
  id: "q1",
  prompt: "Prompt?",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ],
};

const currentRound: CurrentRound = { id: "r2", number: 2, question };
const presentation = { hostDisplayName: "Louis" };

function makeVote(participantId: string, optionId: string, roundId = "r2"): Vote {
  const source = participantId === "local:host" ? "HOST" : "SIMULATED";
  return { participantId, optionId, source, roundId, castAt: "2026-10-07T12:00:00.000Z" };
}

// Round r2: host → b, viewer-1 → a, viewer-2 → b. Winner: b (the host's pick).
const votes: Vote[] = [
  makeVote("local:sim-viewer-1", "c", "r1"), // earlier round, must not count
  makeVote("local:host", "b"),
  makeVote("local:sim-viewer-1", "a"),
  makeVote("local:sim-viewer-2", "b"),
];

function makeSession(revealOrder: RevealOrder, sessionVotes: Vote[] = votes): GameSession {
  return {
    id: "s1",
    deckId: "deck",
    totalRounds: 5,
    playedQuestionIds: ["q0", "q1"],
    hostParticipantId: "local:host",
    votes: sessionVotes,
    revealOrder,
    sharedChatVotingMode: "OWN_CHANNEL_ONLY",
  };
}

const roundSnapshot = {
  id: "r2",
  number: 2,
  totalRounds: 5,
  question: { id: "q1", prompt: "Prompt?", context: null, options: question.options },
};

const expectedResult = {
  totalVotes: 3,
  options: [
    { optionId: "a", voteCount: 1, percentage: 33 },
    { optionId: "b", voteCount: 2, percentage: 67 },
    { optionId: "c", voteCount: 0, percentage: 0 },
  ],
  winningOptionIds: ["b"],
};

function snapshotIn(status: RoundPhase, session: GameSession) {
  return toGameSnapshot({ status, session, currentRound }, presentation);
}

const REVEAL_ORDERS: RevealOrder[] = ["AUDIENCE_FIRST", "HOST_FIRST"];

describe("toGameSnapshot", () => {
  it("maps IDLE", () => {
    expect(toGameSnapshot({ status: "IDLE" }, presentation)).toEqual({ status: "IDLE" });
  });

  describe.each(REVEAL_ORDERS)("before the reveal (%s)", (revealOrder) => {
    it.each(["INTRO", "VOTING", "LOCKED"] as const)("maps %s to the round view only, without any vote data", (status) => {
      const snapshot = snapshotIn(status, makeSession(revealOrder));

      expect(snapshot).toEqual({ status, round: roundSnapshot });
      // Results stay hidden while voting is open or just closed (Decision 015).
      expect(JSON.stringify(snapshot)).not.toMatch(/vote|result|host|louis/i);
    });
  });

  describe("REVEAL", () => {
    it("uncovers only the audience result with AUDIENCE_FIRST", () => {
      const snapshot = snapshotIn("REVEAL", makeSession("AUDIENCE_FIRST"));

      expect(snapshot).toEqual({
        status: "REVEAL",
        revealOrder: "AUDIENCE_FIRST",
        round: roundSnapshot,
        result: expectedResult,
      });
      expect(JSON.stringify(snapshot)).not.toMatch(/host|louis/i);
    });

    it("uncovers only the host's choice with HOST_FIRST", () => {
      const snapshot = snapshotIn("REVEAL", makeSession("HOST_FIRST"));

      expect(snapshot).toEqual({
        status: "REVEAL",
        revealOrder: "HOST_FIRST",
        round: roundSnapshot,
        host: { displayName: "Louis", optionId: "b" },
      });
      expect(JSON.stringify(snapshot)).not.toMatch(/voteCount|totalVotes|winning/);
    });

    it("reports a host without a vote with HOST_FIRST", () => {
      const withoutHost = votes.filter((vote) => vote.participantId !== "local:host");

      const snapshot = snapshotIn("REVEAL", makeSession("HOST_FIRST", withoutHost));

      expect(snapshot.status === "REVEAL" && "host" in snapshot && snapshot.host).toEqual({
        displayName: "Louis",
        optionId: null,
      });
    });
  });

  describe.each(REVEAL_ORDERS)("RESULT (%s)", (revealOrder) => {
    it("carries the audience result and the host's choice", () => {
      expect(snapshotIn("RESULT", makeSession(revealOrder))).toEqual({
        status: "RESULT",
        revealOrder,
        round: roundSnapshot,
        result: expectedResult,
        host: { displayName: "Louis", optionId: "b" },
        hostPickedWinner: true,
      });
    });
  });

  describe("hostPickedWinner", () => {
    function hostPickedWinner(sessionVotes: Vote[]) {
      const snapshot = snapshotIn("RESULT", makeSession("AUDIENCE_FIRST", sessionVotes));
      if (snapshot.status !== "RESULT") throw new Error("expected RESULT");
      return snapshot.hostPickedWinner;
    }

    it("is false when the host's choice lost", () => {
      expect(
        hostPickedWinner([makeVote("local:host", "c"), makeVote("p1", "a"), makeVote("p2", "a")]),
      ).toBe(false);
    });

    it("is true when the host's choice is part of a tie", () => {
      expect(hostPickedWinner([makeVote("local:host", "c"), makeVote("p1", "a")])).toBe(true);
    });

    it("is null when the host did not vote", () => {
      expect(hostPickedWinner([makeVote("p1", "a")])).toBeNull();
    });
  });

  it("reports zero percent and no winner when nobody voted", () => {
    const snapshot = snapshotIn("REVEAL", makeSession("AUDIENCE_FIRST", []));

    expect(snapshot.status === "REVEAL" && "result" in snapshot && snapshot.result).toEqual({
      totalVotes: 0,
      options: [
        { optionId: "a", voteCount: 0, percentage: 0 },
        { optionId: "b", voteCount: 0, percentage: 0 },
        { optionId: "c", voteCount: 0, percentage: 0 },
      ],
      winningOptionIds: [],
    });
  });

  it("keeps an optional question context", () => {
    const snapshot = toGameSnapshot(
      {
        status: "INTRO",
        session: makeSession("AUDIENCE_FIRST"),
        currentRound: { ...currentRound, question: { ...question, context: "Whenever..." } },
      },
      presentation,
    );

    expect(snapshot.status === "INTRO" && snapshot.round.question.context).toBe("Whenever...");
  });

  it("maps FINISHED to the number of rounds played", () => {
    expect(toGameSnapshot({ status: "FINISHED", session: makeSession("AUDIENCE_FIRST") }, presentation)).toEqual({
      status: "FINISHED",
      roundsPlayed: 2,
      totalRounds: 5,
    });
  });
});
