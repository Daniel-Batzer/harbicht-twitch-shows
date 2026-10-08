import { describe, expect, it } from "vitest";
import { findOptionIdByNumber, type Question } from "./question";

const question: Question = {
  id: "q1",
  prompt: "Prompt?",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ],
};

describe("findOptionIdByNumber", () => {
  it("maps 1-based numbers to options in question order", () => {
    expect(findOptionIdByNumber(question, 1)).toBe("a");
    expect(findOptionIdByNumber(question, 2)).toBe("b");
    expect(findOptionIdByNumber(question, 3)).toBe("c");
  });

  it("works for any number of options, not just three", () => {
    const fourOptions: Question = { ...question, options: [...question.options, { id: "d", label: "D" }] };

    expect(findOptionIdByNumber(fourOptions, 4)).toBe("d");
  });

  it.each([0, -1, 4, 1.5, Number.NaN])("returns null for %s", (optionNumber) => {
    expect(findOptionIdByNumber(question, optionNumber)).toBeNull();
  });
});
