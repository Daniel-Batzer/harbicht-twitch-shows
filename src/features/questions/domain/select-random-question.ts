import type { Question } from "./question";

/**
 * Picks one question using an injected random number in [0, 1),
 * so callers decide where randomness comes from and tests stay deterministic.
 * Questions whose id is in `excludedQuestionIds` (e.g. already played in this
 * session) are never picked. Returns undefined when no question is left.
 */
export function selectRandomQuestion(
  questions: readonly Question[],
  randomNumber: number,
  excludedQuestionIds: readonly string[] = [],
): Question | undefined {
  const candidates = questions.filter((question) => !excludedQuestionIds.includes(question.id));
  if (candidates.length === 0) return undefined;

  const index = Math.min(Math.floor(randomNumber * candidates.length), candidates.length - 1);
  return candidates[index];
}
