import { describe, expect, it } from "vitest";
import { parseChatVoteCommand } from "./chat-vote-command";

describe("parseChatVoteCommand", () => {
  it.each([
    ["!vote 1", 1],
    ["!vote 2", 2],
    ["!vote 3", 3],
    ["!VOTE 2", 2],
    ["!Vote 3", 3],
    ["  !vote   2  ", 2],
    ["!vote\t1", 1],
    ["!vote 99", 99],
    ["!vote 02", 2],
  ])("reads %j as a vote for option %i", (text, optionNumber) => {
    expect(parseChatVoteCommand(text)).toEqual({ kind: "VOTE", optionNumber });
  });

  it("ignores invisible characters that chat clients append to repeated messages", () => {
    expect(parseChatVoteCommand("!vote 2 \u{E0000}")).toEqual({ kind: "VOTE", optionNumber: 2 });
    expect(parseChatVoteCommand("\u200B!vote\u200B 3")).toEqual({ kind: "VOTE", optionNumber: 3 });
  });

  it.each([
    "!vote",
    "!vote ",
    "!vote 0",
    "!vote 00",
    "!vote abc",
    "!vote 1.5",
    "!vote -1",
    "!vote +1",
    "!vote 1 2",
    "!vote 2 lol",
    "!vote 100",
  ])("rejects %j as an invalid vote", (text) => {
    expect(parseChatVoteCommand(text)).toEqual({ kind: "INVALID_VOTE" });
  });

  it.each(["hello chat", "", "!votes 1", "!vote2", "!voteX 1", "vote 1", "1", "I think !vote 2", "!1"])(
    "treats %j as ordinary chat",
    (text) => {
      expect(parseChatVoteCommand(text)).toEqual({ kind: "NOT_A_VOTE" });
    },
  );
});
