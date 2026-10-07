import type { CSSProperties } from "react";
import type { QuestionOption } from "../../../questions/domain/question";
import styles from "./AnswerCards.module.scss";

type AnswerCardsProps = {
  options: QuestionOption[];
  /** "open" while voting runs, "locked" once voting is closed. */
  state: "open" | "locked";
};

// Presentation is tuned for three options (Decision 033) but renders any count;
// slot colors cycle in SCSS.
export function AnswerCards({ options, state }: AnswerCardsProps) {
  return (
    <ol className={styles.cards} data-state={state}>
      {options.map((option, index) => (
        <li
          key={option.id}
          className={styles.card}
          data-slot={(index % 3) + 1}
          style={{ "--slot-index": index } as CSSProperties}
        >
          <span className={styles.badge}>{index + 1}</span>
          <span className={styles.label}>{option.label}</span>
        </li>
      ))}
    </ol>
  );
}
