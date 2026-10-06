import styles from "./QuestionCard.module.scss";

type QuestionCardProps = {
  context: string | null;
  prompt: string;
};

export function QuestionCard({ context, prompt }: QuestionCardProps) {
  return (
    <section className={styles.card}>
      {context && <p className={styles.context}>{context}</p>}
      <h1 className={styles.prompt}>{prompt}</h1>
    </section>
  );
}
