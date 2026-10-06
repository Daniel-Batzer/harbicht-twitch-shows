import { describe, expect, it } from "vitest";
import type { Question } from "./question";
import { selectRandomQuestion } from "./select-random-question";

function makeQuestion(id: string): Question {
  return {
    id,
    prompt: `Prompt ${id}`,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
  };
}

const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];

describe("selectRandomQuestion", () => {
  it("picks the first question for random number 0", () => {
    expect(selectRandomQuestion(questions, 0)?.id).toBe("q1");
  });

  it("picks the last question for a random number just below 1", () => {
    expect(selectRandomQuestion(questions, 0.999)?.id).toBe("q3");
  });

  it("maps the random number proportionally onto the list", () => {
    expect(selectRandomQuestion(questions, 0.5)?.id).toBe("q2");
  });

  it("returns undefined for an empty list", () => {
    expect(selectRandomQuestion([], 0.5)).toBeUndefined();
  });
});
