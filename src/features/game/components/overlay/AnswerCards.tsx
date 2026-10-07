import type { CSSProperties } from "react";
import type { QuestionOption } from "../../../questions/domain/question";
import type { HostPickSnapshot, RoundResultSnapshot } from "../../game-snapshot";
import styles from "./AnswerCards.module.scss";

/**
 * - "open": voting runs
 * - "locked": voting is closed, nothing uncovered yet
 * - "revealed": from REVEAL on; what is shown comes from `result` and `host`
 */
export type AnswerCardsState = "open" | "locked" | "revealed";

type AnswerCardsProps = {
  options: QuestionOption[];
  state: AnswerCardsState;
  /** The audience result, once the snapshot has uncovered it (Decision 044). */
  result: RoundResultSnapshot | null;
  /** The host's choice, once the snapshot has uncovered it. */
  host: HostPickSnapshot | null;
  /**
   * True in the phase that uncovers the host's choice: the sash and the
   * spotlight then wait for the banner's shake to finish.
   */
  isHostPickMoment: boolean;
};

// Presentation is tuned for three options (Decision 033) but renders any count;
// slot colors cycle in SCSS. Elements that are already mounted keep their
// state between REVEAL and RESULT, so only what is new animates in.
export function AnswerCards({ options, state, result, host, isHostPickMoment }: AnswerCardsProps) {
  const hostOptionId = host?.optionId ?? null;

  return (
    <ol className={styles.cards} data-state={state} data-host-pick-moment={isHostPickMoment}>
      {options.map((option, index) => {
        const optionResult = result?.options.find((entry) => entry.optionId === option.id);
        const isWinner = result !== null && result.winningOptionIds.includes(option.id);
        const isHostPick = option.id === hostOptionId;
        // Spotlight on the host's pick while it is the only thing uncovered;
        // once everything is uncovered, only winners and the host's pick stay lit.
        const isDimmed =
          result === null ? hostOptionId !== null && !isHostPick : host !== null && !isWinner && !isHostPick;

        return (
          <li
            key={option.id}
            className={styles.card}
            data-slot={(index % 3) + 1}
            data-winner={isWinner}
            data-host-pick={isHostPick}
            data-dimmed={isDimmed}
            style={{ "--slot-index": index, "--share": `${optionResult?.percentage ?? 0}%` } as CSSProperties}
          >
            <span className={styles.badge}>{index + 1}</span>
            {host && isHostPick && <span className={styles.hostSash}>{host.displayName}&apos;s pick</span>}
            <span className={styles.label}>{option.label}</span>

            {result && optionResult && (
              <span className={styles.stats}>
                {result.totalVotes === 0 ? (
                  <span className={styles.votes}>No votes</span>
                ) : (
                  <>
                    <span className={styles.percentage}>{optionResult.percentage}%</span>
                    <span className={styles.votes}>
                      {optionResult.voteCount} {optionResult.voteCount === 1 ? "vote" : "votes"}
                    </span>
                  </>
                )}
                <span className={styles.bar} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
