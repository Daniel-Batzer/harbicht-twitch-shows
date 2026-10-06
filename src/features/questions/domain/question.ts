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
