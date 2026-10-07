import styles from "./FinishedCard.module.scss";

type FinishedCardProps = {
  roundsPlayed: number;
};

export function FinishedCard({ roundsPlayed }: FinishedCardProps) {
  return (
    <section className={styles.card}>
      <h1 className={styles.title}>Game over</h1>
      <p className={styles.subtitle}>
        Thanks for playing · {roundsPlayed} {roundsPlayed === 1 ? "round" : "rounds"}
      </p>
    </section>
  );
}
