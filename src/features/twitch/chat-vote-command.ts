// Parses the chat vote command (`!vote 2`). Pure and deliberately strict:
// exactly one number after `!vote`, nothing else. Loosening the syntax later
// is easy; tightening it after viewers got used to it is not.
// The parser does not know the question, so whether 4 is a valid option is
// decided later (findOptionIdByNumber).

export type ChatVoteCommand =
  | { kind: "VOTE"; optionNumber: number }
  /** Starts with `!vote` but the argument is missing or not a single option number. */
  | { kind: "INVALID_VOTE" }
  /** Ordinary chat, including look-alikes such as `!votes 1` or `!vote2`. */
  | { kind: "NOT_A_VOTE" };

// Zero-width characters, word joiner, BOM, and U+E0000, which Chatterino and
// 7TV append to repeated messages to get past Twitch's duplicate filter.
const INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF\u{E0000}]/gu;

const VOTE_COMMAND = /^!vote(?:\s+(.*))?$/i;
const OPTION_NUMBER = /^\d{1,2}$/;

export function parseChatVoteCommand(text: string): ChatVoteCommand {
  const normalizedText = text.replace(INVISIBLE_CHARACTERS, "").trim();
  const match = VOTE_COMMAND.exec(normalizedText);
  if (!match) return { kind: "NOT_A_VOTE" };

  const argument = match[1]?.trim() ?? "";
  if (!OPTION_NUMBER.test(argument)) return { kind: "INVALID_VOTE" };

  const optionNumber = Number(argument);
  if (optionNumber < 1) return { kind: "INVALID_VOTE" };

  return { kind: "VOTE", optionNumber };
}
