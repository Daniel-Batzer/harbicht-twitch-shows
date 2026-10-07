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

  it("never picks an excluded question", () => {
    for (const randomNumber of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(selectRandomQuestion(questions, randomNumber, ["q1", "q3"])?.id).toBe("q2");
    }
  });

  it("maps the random number onto the remaining questions only", () => {
    expect(selectRandomQuestion(questions, 0, ["q1"])?.id).toBe("q2");
    expect(selectRandomQuestion(questions, 0.999, ["q1"])?.id).toBe("q3");
  });

  it("returns undefined when every question is excluded", () => {
    expect(selectRandomQuestion(questions, 0.5, ["q1", "q2", "q3"])).toBeUndefined();
  });
});
