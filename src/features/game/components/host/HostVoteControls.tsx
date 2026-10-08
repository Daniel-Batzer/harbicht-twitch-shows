"use client";

import { useActionState } from "react";
import clsx from "clsx";
import type { QuestionOption } from "../../../questions/domain/question";
import { describeVoteFailure, type HostVoteAction } from "./vote-feedback";
import styles from "./HostVoteControls.module.scss";

type HostVoteControlsProps = {
  options: QuestionOption[];
  /** The host's current choice in this round. */
  hostOptionId: string | null;
  /** Effective votes so far; shown to the host only, never the distribution. */
  voteCount: number;
  /** While voting is open the host can vote and change their vote; afterwards it is read-only. */
  isVotingOpen: boolean;
  onVote: HostVoteAction;
};

export function HostVoteControls({ options, hostOptionId, voteCount, isVotingOpen, onVote }: HostVoteControlsProps) {
  const [feedback, voteAction, isPending] = useActionState(onVote, null);
  const hostOption = options.find((option) => option.id === hostOptionId);

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h3 className={styles.heading}>Your vote</h3>
        <span className={styles.voteCount}>
          {voteCount} {voteCount === 1 ? "vote" : "votes"}
        </span>
      </header>

      {/* Without a host vote the round has no host-pick moment; the overlay says so instead (Decision 045). */}
      {isVotingOpen && !hostOption && (
        <p className={styles.warning}>
          You haven&apos;t voted yet. Without your vote, the host-pick reveal is skipped this round.
        </p>
      )}

      {isVotingOpen ? (
        // One form; the clicked button submits its own option id.
        <form action={voteAction} className={styles.options}>
          {options.map((option, index) => (
            <button
              key={option.id}
              className={clsx(styles.optionButton, option.id === hostOptionId && styles.chosen)}
              type="submit"
              name="optionId"
              value={option.id}
              aria-pressed={option.id === hostOptionId}
              disabled={isPending}
            >
              <span className={styles.optionNumber}>{index + 1}</span>
              {option.label}
            </button>
          ))}
        </form>
      ) : (
        <p className={styles.summary}>
          {hostOption ? (
            <>
              You chose <strong>{hostOption.label}</strong>.
            </>
          ) : (
            "You did not vote this round."
          )}{" "}
          Chat&apos;s numbers stay hidden until they are revealed.
        </p>
      )}

      {feedback && (
        <p className={styles.feedback} role="alert">
          {describeVoteFailure(feedback.failure)}
        </p>
      )}
    </section>
  );
}
