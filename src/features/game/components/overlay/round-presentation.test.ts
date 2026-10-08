import { describe, expect, it } from "vitest";
import type { RevealOrder } from "../../domain/game-state";
import type { HostPickSnapshot, RoundPhaseSnapshot, RoundResultSnapshot, RoundSnapshot } from "../../game-snapshot";
import { getRoundPresentation, REVEAL_TIMING, type RoundPresentation } from "./round-presentation";

const round: RoundSnapshot = {
  id: "r1",
  number: 1,
  totalRounds: 5,
  question: {
    id: "q1",
    prompt: "Prompt?",
    context: null,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
  },
};

function resultWith(counts: [number, number, number]): RoundResultSnapshot {
  const totalVotes = counts[0] + counts[1] + counts[2];
  const highest = Math.max(...counts);
  const ids = ["a", "b", "c"];
  return {
    totalVotes,
    options: ids.map((optionId, index) => ({
      optionId,
      voteCount: counts[index],
      percentage: totalVotes === 0 ? 0 : Math.round((counts[index] / totalVotes) * 100),
    })),
    winningOptionIds: totalVotes === 0 ? [] : ids.filter((_, index) => counts[index] === highest),
  };
}

const aWins = resultWith([5, 2, 1]);
const tieAB = resultWith([3, 3, 1]);
const noVotes = resultWith([0, 0, 0]);

function hostPicked(optionId: string | null): HostPickSnapshot {
  return { displayName: "Louis", optionId };
}

function reveal(revealOrder: RevealOrder, result: RoundResultSnapshot, host: HostPickSnapshot): RoundPhaseSnapshot {
  return revealOrder === "AUDIENCE_FIRST"
    ? { status: "REVEAL", revealOrder, round, result }
    : { status: "REVEAL", revealOrder, round, host };
}

function resultPhase(revealOrder: RevealOrder, result: RoundResultSnapshot, host: HostPickSnapshot): RoundPhaseSnapshot {
  const hostPickedWinner = host.optionId === null ? null : result.winningOptionIds.includes(host.optionId);
  return { status: "RESULT", revealOrder, round, result, host, hostPickedWinner };
}

function cardsOf(presentation: RoundPresentation) {
  if (!presentation.cards) throw new Error("expected answer cards");
  return presentation.cards;
}

function card(presentation: RoundPresentation, optionId: string) {
  const found = cardsOf(presentation).find((entry) => entry.option.id === optionId);
  if (!found) throw new Error(`no card for ${optionId}`);
  return found;
}

/** The focus a card ends the phase with. */
function finalFocus(presentation: RoundPresentation, optionId: string) {
  return card(presentation, optionId).focusSteps.at(-1)?.focus;
}

const REVEAL_ORDERS: RevealOrder[] = ["AUDIENCE_FIRST", "HOST_FIRST"];

// Every outcome a round can have, for the invariants below.
const OUTCOMES = [
  { name: "host won", result: aWins, host: hostPicked("a") },
  { name: "host lost", result: aWins, host: hostPicked("c") },
  { name: "host in a tie", result: tieAB, host: hostPicked("b") },
  { name: "host did not vote", result: aWins, host: hostPicked(null) },
  { name: "nobody voted", result: noVotes, host: hostPicked(null) },
];

describe("getRoundPresentation", () => {
  describe("before the reveal", () => {
    it("shows the question without banner or cards in INTRO", () => {
      expect(getRoundPresentation({ status: "INTRO", round })).toEqual({ banner: null, cards: null });
    });

    it("shows open cards while voting runs", () => {
      const presentation = getRoundPresentation({ status: "VOTING", round });
      expect(presentation.banner).toEqual({
        lead: { text: "Voting open", tone: "teal", effect: "PULSE" },
        payoff: null,
      });
      for (const entry of cardsOf(presentation)) {
        expect(entry).toMatchObject({ result: null, hostPick: null, crownAt: null });
        expect(entry.focusSteps).toEqual([{ at: 0, focus: "NORMAL" }]);
      }
    });

    it("dims every card once voting is locked", () => {
      const presentation = getRoundPresentation({ status: "LOCKED", round });
      expect(presentation.banner?.lead.text).toBe("Voting closed");
      for (const entry of cardsOf(presentation)) {
        expect(entry.focusSteps).toEqual([{ at: 0, focus: "LOCKED" }]);
      }
    });
  });

  describe.each(REVEAL_ORDERS)("invariants (%s)", (revealOrder) => {
    describe.each(OUTCOMES)("$name", ({ result, host }) => {
      it("never crowns in REVEAL", () => {
        for (const entry of cardsOf(getRoundPresentation(reveal(revealOrder, result, host)))) {
          expect(entry.crownAt).toBeNull();
        }
      });

      it("crowns exactly the winners in RESULT, after everything new has landed", () => {
        const presentation = getRoundPresentation(resultPhase(revealOrder, result, host));
        for (const entry of cardsOf(presentation)) {
          const isWinner = result.winningOptionIds.includes(entry.option.id);
          if (!isWinner) {
            expect(entry.crownAt).toBeNull();
            continue;
          }
          expect(entry.crownAt).not.toBeNull();
          const crownAt = entry.crownAt ?? 0;
          for (const other of cardsOf(presentation)) {
            if (other.hostPick) expect(crownAt).toBeGreaterThan(other.hostPick.sashAt);
            if (other.result && other.result.revealAt > 0) {
              expect(crownAt).toBeGreaterThan(other.result.revealAt + REVEAL_TIMING.fillDuration);
            }
          }
          expect(presentation.banner?.payoff?.at).toBeGreaterThanOrEqual(crownAt);
        }
      });

      it("only shows what the snapshot uncovered", () => {
        const revealCards = cardsOf(getRoundPresentation(reveal(revealOrder, result, host)));
        for (const entry of revealCards) {
          if (revealOrder === "AUDIENCE_FIRST") expect(entry.hostPick).toBeNull();
          else expect(entry.result).toBeNull();
        }
      });

      it("starts every focus timeline at 0 and keeps it in time order", () => {
        for (const snapshot of [reveal(revealOrder, result, host), resultPhase(revealOrder, result, host)]) {
          for (const entry of cardsOf(getRoundPresentation(snapshot))) {
            expect(entry.focusSteps[0].at).toBe(0);
            const times = entry.focusSteps.map((step) => step.at);
            expect(times).toEqual([...times].sort((first, second) => first - second));
          }
        }
      });

      it("lets the payoff follow the lead", () => {
        for (const snapshot of [reveal(revealOrder, result, host), resultPhase(revealOrder, result, host)]) {
          expect(getRoundPresentation(snapshot).banner?.payoff?.at).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("AUDIENCE_FIRST", () => {
    const revealPhase = getRoundPresentation(reveal("AUDIENCE_FIRST", aWins, hostPicked("c")));
    const result = getRoundPresentation(resultPhase("AUDIENCE_FIRST", aWins, hostPicked("c")));

    it("builds suspense before the bars fill in option order", () => {
      expect(revealPhase.banner).toEqual({
        lead: { text: "And chat says…", tone: "orange", effect: "DRUMROLL" },
        payoff: {
          text: "The votes are in!",
          tone: "orange",
          effect: "NONE",
          at: REVEAL_TIMING.distributionAt + REVEAL_TIMING.fillDuration + 2 * REVEAL_TIMING.fillStagger,
        },
      });
      expect(cardsOf(revealPhase).map((entry) => entry.result?.revealAt)).toEqual([
        REVEAL_TIMING.distributionAt,
        REVEAL_TIMING.distributionAt + REVEAL_TIMING.fillStagger,
        REVEAL_TIMING.distributionAt + 2 * REVEAL_TIMING.fillStagger,
      ]);
    });

    it("keeps every card in focus during REVEAL", () => {
      for (const entry of cardsOf(revealPhase)) expect(entry.focusSteps).toEqual([{ at: 0, focus: "NORMAL" }]);
    });

    it("keeps the uncovered distribution in place in RESULT", () => {
      for (const entry of cardsOf(result)) expect(entry.result?.revealAt).toBe(0);
    });

    it("uncovers the host's pick in RESULT with a spotlight before the sash", () => {
      expect(result.banner?.lead).toEqual({ text: "Louis picked…", tone: "gold", effect: "SHAKE" });
      expect(card(result, "c").hostPick).toEqual({
        displayName: "Louis",
        spotlightAt: REVEAL_TIMING.hostPickAt - REVEAL_TIMING.spotlightLead,
        sashAt: REVEAL_TIMING.hostPickAt,
      });
    });

    it("steps back for the spotlight and lights the winner again when it is crowned", () => {
      const spotlightAt = REVEAL_TIMING.hostPickAt - REVEAL_TIMING.spotlightLead;
      const crownAt = card(result, "a").crownAt;
      expect(card(result, "a").focusSteps).toEqual([
        { at: 0, focus: "NORMAL" },
        { at: spotlightAt, focus: "BACK" },
        { at: crownAt, focus: "NORMAL" },
      ]);
      expect(card(result, "b").focusSteps).toEqual([
        { at: 0, focus: "NORMAL" },
        { at: spotlightAt, focus: "BACK" },
      ]);
      expect(card(result, "c").focusSteps).toEqual([{ at: 0, focus: "NORMAL" }]);
    });

    it("ends with the verdict", () => {
      expect(result.banner?.payoff).toMatchObject({ text: "Chat disagrees with Louis!", effect: "SHAKE" });
      const agreed = getRoundPresentation(resultPhase("AUDIENCE_FIRST", aWins, hostPicked("a")));
      expect(agreed.banner?.payoff).toMatchObject({ text: "Chat agrees with Louis!", tone: "gold", effect: "SHAKE" });
    });
  });

  describe("HOST_FIRST", () => {
    const revealPhase = getRoundPresentation(reveal("HOST_FIRST", aWins, hostPicked("c")));
    const result = getRoundPresentation(resultPhase("HOST_FIRST", aWins, hostPicked("c")));

    it("uncovers the host's pick in REVEAL and asks whether chat agrees", () => {
      expect(revealPhase.banner).toEqual({
        lead: { text: "Louis picked…", tone: "gold", effect: "SHAKE" },
        payoff: {
          text: "Will chat agree?",
          tone: "gold",
          effect: "NONE",
          at: REVEAL_TIMING.hostPickAt + REVEAL_TIMING.hostPickSettle,
        },
      });
      expect(card(revealPhase, "c").hostPick?.sashAt).toBe(REVEAL_TIMING.hostPickAt);
      expect(finalFocus(revealPhase, "a")).toBe("BACK");
      expect(finalFocus(revealPhase, "c")).toBe("NORMAL");
    });

    it("keeps the host's pick in place in RESULT", () => {
      expect(card(result, "c").hostPick).toMatchObject({ spotlightAt: 0, sashAt: 0 });
    });

    it("brings the stepped-back cards back for the distribution, then dims the losers at the crowning", () => {
      const crownAt = card(result, "a").crownAt;
      expect(card(result, "a").focusSteps).toEqual([
        { at: 0, focus: "BACK" },
        { at: REVEAL_TIMING.focusReturnAt, focus: "NORMAL" },
      ]);
      expect(card(result, "b").focusSteps).toEqual([
        { at: 0, focus: "BACK" },
        { at: REVEAL_TIMING.focusReturnAt, focus: "NORMAL" },
        { at: crownAt, focus: "BACK" },
      ]);
    });

    it("builds suspense in RESULT and ends with the verdict", () => {
      expect(result.banner?.lead).toEqual({ text: "And chat says…", tone: "orange", effect: "DRUMROLL" });
      expect(result.banner?.payoff).toMatchObject({ text: "Chat disagrees with Louis!" });
      expect(card(result, "a").result?.revealAt).toBe(REVEAL_TIMING.distributionAt);
    });
  });

  describe("when the host did not vote", () => {
    it("says so in HOST_FIRST REVEAL without a spotlight", () => {
      const presentation = getRoundPresentation(reveal("HOST_FIRST", aWins, hostPicked(null)));
      expect(presentation.banner).toEqual({
        lead: { text: "Louis sat this one out", tone: "muted", effect: "NONE" },
        payoff: { text: "It's all up to chat!", tone: "orange", effect: "NONE", at: REVEAL_TIMING.leadHold },
      });
      for (const entry of cardsOf(presentation)) {
        expect(entry.hostPick).toBeNull();
        expect(entry.focusSteps).toEqual([{ at: 0, focus: "NORMAL" }]);
      }
    });

    it.each(REVEAL_ORDERS)("still crowns the winner in RESULT (%s)", (revealOrder) => {
      const presentation = getRoundPresentation(resultPhase(revealOrder, aWins, hostPicked(null)));
      expect(card(presentation, "a").crownAt).not.toBeNull();
      expect(card(presentation, "a").hostPick).toBeNull();
      expect(finalFocus(presentation, "a")).toBe("NORMAL");
      expect(finalFocus(presentation, "b")).toBe("BACK");
      expect(presentation.banner?.payoff).toMatchObject({ text: "Chat has spoken!", effect: "NONE" });
    });

    it("leads AUDIENCE_FIRST RESULT with the missing host vote", () => {
      const presentation = getRoundPresentation(resultPhase("AUDIENCE_FIRST", aWins, hostPicked(null)));
      expect(presentation.banner?.lead).toEqual({ text: "Louis sat this one out", tone: "muted", effect: "NONE" });
      expect(card(presentation, "a").crownAt).toBe(REVEAL_TIMING.leadHold);
    });
  });

  describe("ties and empty rounds", () => {
    it("crowns every winner of a tie", () => {
      const presentation = getRoundPresentation(resultPhase("AUDIENCE_FIRST", tieAB, hostPicked("b")));
      expect(card(presentation, "a").crownAt).not.toBeNull();
      expect(card(presentation, "b").crownAt).not.toBeNull();
      expect(card(presentation, "c").crownAt).toBeNull();
      expect(presentation.banner?.payoff?.text).toBe("Chat agrees with Louis!");
    });

    it.each(REVEAL_ORDERS)("crowns nobody when nobody voted (%s)", (revealOrder) => {
      const presentation = getRoundPresentation(resultPhase(revealOrder, noVotes, hostPicked(null)));
      for (const entry of cardsOf(presentation)) {
        expect(entry.crownAt).toBeNull();
        expect(entry.result?.totalVotes).toBe(0);
        expect(entry.focusSteps.at(-1)?.focus).toBe("NORMAL");
      }
      expect(presentation.banner?.payoff?.text).toBe("No votes this round");
    });

    it("says nobody voted at the end of AUDIENCE_FIRST REVEAL", () => {
      const presentation = getRoundPresentation(reveal("AUDIENCE_FIRST", noVotes, hostPicked(null)));
      expect(presentation.banner?.payoff?.text).toBe("No votes this round");
    });
  });
});
