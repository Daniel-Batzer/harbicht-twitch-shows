// Questions are structured data. Options are a collection, not fixed A/B/C
// fields (Decision 008): three options is a game/presentation rule, not a
// model rule (Decision 033).

export type QuestionOption = {
  id: string;
  label: string;
};

export type Question = {
  id: string;
  prompt: string;
  /** Optional trigger text such as "Whenever you die in a game..." (Decision 007). */
  context?: string;
  options: QuestionOption[];
};

export type Deck = {
  id: string;
  name: string;
  questions: Question[];
};

/**
 * The option at a 1-based position in the question's order, the number the
 * overlay shows on each answer card and chat votes refer to (`!vote 2`).
 * Returns null when the question has no option at that position.
 */
export function findOptionIdByNumber(question: Question, optionNumber: number): string | null {
  if (!Number.isInteger(optionNumber) || optionNumber < 1) return null;
  return question.options[optionNumber - 1]?.id ?? null;
}
