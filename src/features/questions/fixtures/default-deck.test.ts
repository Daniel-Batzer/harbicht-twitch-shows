import { describe, expect, it } from "vitest";
import { defaultDeck } from "./default-deck";

// The first game is designed around three options (Decision 033); the domain
// allows more, so the fixture is checked for "at least three".
describe("defaultDeck fixture", () => {
  it("has questions", () => {
    expect(defaultDeck.questions.length).toBeGreaterThan(0);
  });

  it("uses unique question ids", () => {
    const ids = defaultDeck.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(defaultDeck.questions)("question $id has at least three labelled options with unique ids", (question) => {
    expect(question.prompt.trim()).not.toBe("");
    expect(question.options.length).toBeGreaterThanOrEqual(3);

    const optionIds = question.options.map((option) => option.id);
    expect(new Set(optionIds).size).toBe(optionIds.length);
    for (const option of question.options) {
      expect(option.label.trim()).not.toBe("");
    }
  });
});
