import type { CSSProperties } from "react";
import type { QuestionOption } from "../../../questions/domain/question";
import type { RoundResultSnapshot } from "../../game-snapshot";
import styles from "./HostResultSummary.module.scss";

type HostResultSummaryProps = {
  options: QuestionOption[];
  result: RoundResultSnapshot;
  /** The host's own choice; on the dashboard it is shown from the reveal on. */
  hostOptionId: string | null;
};

export function HostResultSummary({ options, result, hostOptionId }: HostResultSummaryProps) {
  return (
    <section className={styles.summary}>
      <p className={styles.total}>
        {result.totalVotes} {result.totalVotes === 1 ? "vote" : "votes"}
        {result.winningOptionIds.length > 1 && " · tie"}
      </p>
      <ol className={styles.options}>
        {options.map((option) => {
          const optionResult = result.options.find((entry) => entry.optionId === option.id);
          const percentage = optionResult?.percentage ?? 0;
          return (
            <li
              key={option.id}
              className={styles.option}
              data-winner={result.winningOptionIds.includes(option.id)}
              style={{ "--share": `${percentage}%` } as CSSProperties}
            >
              <span className={styles.label}>
                {option.label}
                {option.id === hostOptionId && <span className={styles.hostTag}>Your pick</span>}
              </span>
              <span className={styles.numbers}>
                {optionResult?.voteCount ?? 0} · {percentage}%
              </span>
            </li>
          );
        })}
      </ol>
      {hostOptionId === null && <p className={styles.hint}>You did not vote this round.</p>}
    </section>
  );
}
