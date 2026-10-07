import styles from "./QuestionCard.module.scss";

type QuestionCardProps = {
  /** Small label above the card, e.g. "Round 2 / 5". */
  eyebrow?: string;
  context: string | null;
  prompt: string;
};

export function QuestionCard({ eyebrow, context, prompt }: QuestionCardProps) {
  return (
    <section className={styles.card}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      {context && <p className={styles.context}>{context}</p>}
      <h1 className={styles.prompt}>{prompt}</h1>
    </section>
  );
}
