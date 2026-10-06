import type { Question } from "./question";

/**
 * Picks one question using an injected random number in [0, 1),
 * so callers decide where randomness comes from and tests stay deterministic.
 * Returns undefined for an empty list.
 */
export function selectRandomQuestion(
  questions: readonly Question[],
  randomNumber: number,
): Question | undefined {
  if (questions.length === 0) return undefined;

  const index = Math.min(Math.floor(randomNumber * questions.length), questions.length - 1);
  return questions[index];
}
