import { describe, expect, it } from "vitest";
import type { Question } from "../questions/domain/question";
import { toChatVoteInput, type ChatVote } from "./chat-vote-input";
import { castVote, type VoteReceipt } from "./domain/cast-vote";
import { lockVoting, type GameSession, type GameState, type RoundPhase } from "./domain/game-state";
import { createVotingTimer, settleVotingDeadline, type VotingTimer } from "./domain/voting-timer";

const question: Question = {
  id: "q1",
  prompt: "Prompt?",
  options: [
    { id: "q1-a", label: "A" },
    { id: "q1-b", label: "B" },
    { id: "q1-c", label: "C" },
  ],
};

const BROADCASTER = "twitch:1000";

function makeSession(hostParticipantId: string): GameSession {
  return {
    id: "s1",
    deckId: "deck",
    totalRounds: 5,
    playedQuestionIds: ["q1"],
    hostParticipantId,
    votes: [],
    revealOrder: "AUDIENCE_FIRST",
    sharedChatVotingMode: "OWN_CHANNEL_ONLY",
    votingDurationSeconds: null,
    voteGracePeriodMs: 3000,
  };
}

function roundState(
  status: RoundPhase,
  hostParticipantId = BROADCASTER,
  votingTimer: VotingTimer | null = null,
): GameState {
  return {
    status,
    session: makeSession(hostParticipantId),
    currentRound: { id: "r1", number: 1, question, votingTimer, votingClosedBy: null },
  };
}

function chatVote(participantId: string, optionNumber: number): ChatVote {
  return { participantId, optionNumber };
}

describe("toChatVoteInput", () => {
  it("maps the option number to the option at that position and tags the vote as CHAT", () => {
    expect(toChatVoteInput(roundState("VOTING"), chatVote("twitch:42", 2), BROADCASTER)).toEqual({
      ok: true,
      input: { participantId: "twitch:42", optionId: "q1-b", source: "CHAT" },
    });
  });

  it.each([0, 4, 99])("rejects option number %s for a three-option question", (optionNumber) => {
    expect(toChatVoteInput(roundState("VOTING"), chatVote("twitch:42", optionNumber), BROADCASTER)).toEqual({
      ok: false,
      failure: { reason: "OPTION_NUMBER_OUT_OF_RANGE", optionNumber },
    });
  });

  it.each([{ status: "IDLE" } as const, { status: "FINISHED", session: makeSession(BROADCASTER) } as const])(
    "rejects votes in $status, where there is no question to resolve against",
    (state) => {
      expect(toChatVoteInput(state, chatVote("twitch:42", 1), BROADCASTER)).toEqual({
        ok: false,
        failure: { reason: "VOTING_NOT_OPEN", status: state.status },
      });
    },
  );

  it("leaves the other round phases to castVote, which decides whether voting is open", () => {
    const result = toChatVoteInput(roundState("LOCKED"), chatVote("twitch:42", 1), BROADCASTER);

    expect(result.ok).toBe(true);
  });

  it("records the broadcaster's chat vote under the session's host id", () => {
    expect(toChatVoteInput(roundState("VOTING", BROADCASTER), chatVote(BROADCASTER, 3), BROADCASTER)).toEqual({
      ok: true,
      input: { participantId: BROADCASTER, optionId: "q1-c", source: "CHAT" },
    });
  });

  it("maps the broadcaster to local:host when the session started before chat was connected", () => {
    expect(toChatVoteInput(roundState("VOTING", "local:host"), chatVote(BROADCASTER, 1), BROADCASTER)).toEqual({
      ok: true,
      input: { participantId: "local:host", optionId: "q1-a", source: "CHAT" },
    });
  });
});

describe("chat votes through castVote", () => {
  const CAST_AT = "2026-10-08T12:00:00.000Z";
  const RECEIPT: VoteReceipt = { receivedAtMs: Date.parse(CAST_AT), castAt: CAST_AT };

  /** What the application does for one chat message: resolve, then let the domain decide. */
  function castChat(state: GameState, vote: ChatVote, receipt = RECEIPT): GameState {
    const resolved = toChatVoteInput(state, vote, BROADCASTER);
    if (!resolved.ok) return state;
    const result = castVote(state, resolved.input, receipt);
    return result.ok ? result.state : state;
  }

  function votesOf(state: GameState) {
    if (state.status === "IDLE") throw new Error("expected a running game");
    return state.session.votes;
  }

  it("keeps one host vote when the host votes on the dashboard and then in chat", () => {
    const afterDashboard = castVote(
      roundState("VOTING", "local:host"),
      { participantId: "local:host", optionId: "q1-a", source: "HOST" },
      RECEIPT,
    );
    if (!afterDashboard.ok) throw new Error("expected the dashboard vote to succeed");

    const afterChat = castChat(afterDashboard.state, chatVote(BROADCASTER, 2));

    expect(votesOf(afterChat)).toEqual([
      { participantId: "local:host", optionId: "q1-b", source: "CHAT", roundId: "r1", castAt: CAST_AT },
    ]);
  });

  it("keeps the earlier valid vote when a later chat vote is invalid", () => {
    const afterValid = castChat(roundState("VOTING"), chatVote("twitch:42", 1));
    const afterInvalid = castChat(afterValid, chatVote("twitch:42", 7));

    expect(votesOf(afterInvalid)).toEqual([expect.objectContaining({ participantId: "twitch:42", optionId: "q1-a" })]);
  });

  it("replaces a viewer's earlier chat vote with their later valid one", () => {
    const afterFirst = castChat(roundState("VOTING"), chatVote("twitch:42", 1));
    const afterSecond = castChat(afterFirst, chatVote("twitch:42", 3));

    expect(votesOf(afterSecond)).toEqual([expect.objectContaining({ participantId: "twitch:42", optionId: "q1-c" })]);
  });

  it("rejects chat votes that arrive after voting was locked", () => {
    const afterVote = castChat(roundState("VOTING"), chatVote("twitch:42", 1));
    const locked = lockVoting(afterVote);
    if (!locked.ok) throw new Error("expected lock to succeed");

    const resolved = toChatVoteInput(locked.state, chatVote("twitch:42", 2), BROADCASTER);
    if (!resolved.ok) throw new Error("expected the option number to resolve");

    expect(castVote(locked.state, resolved.input, RECEIPT)).toEqual({
      ok: false,
      failure: { reason: "VOTING_NOT_OPEN", status: "LOCKED" },
    });
  });

  describe("around the voting timer's deadline", () => {
    // The service settles the deadline with the receive time, then lets castVote decide (Decision 047).
    const timer = createVotingTimer(30, 3000, Date.parse(CAST_AT));
    const timedVoting = roundState("VOTING", BROADCASTER, timer);

    function castChatReceivedAt(state: GameState, vote: ChatVote, receivedAtMs: number): GameState {
      const receipt: VoteReceipt = { receivedAtMs, castAt: new Date(receivedAtMs).toISOString() };
      return castChat(settleVotingDeadline(state, receivedAtMs), vote, receipt);
    }

    it("counts a chat vote that arrives during the grace period", () => {
      const state = castChatReceivedAt(timedVoting, chatVote("twitch:42", 2), timer.endsAtMs + 2000);

      expect(votesOf(state)).toEqual([expect.objectContaining({ participantId: "twitch:42", optionId: "q1-b" })]);
    });

    it("rejects a chat vote that arrives at the lock and keeps the viewer's earlier vote", () => {
      const afterVote = castChatReceivedAt(timedVoting, chatVote("twitch:42", 1), timer.startedAtMs);

      const afterLate = castChatReceivedAt(afterVote, chatVote("twitch:42", 3), timer.closesAtMs);

      expect(afterLate.status).toBe("LOCKED");
      expect(votesOf(afterLate)).toEqual([expect.objectContaining({ participantId: "twitch:42", optionId: "q1-a" })]);
    });
  });
});
