"use client";

import { useActionState, useState } from "react";
import type { QuestionOption } from "../../../questions/domain/question";
import { describeVoteFailure, type HostVoteAction } from "./vote-feedback";
import styles from "./SimulatedVotesPanel.module.scss";

const RANDOM_BATCH_SIZE = 10;

type SimulatedVotesPanelProps = {
  options: QuestionOption[];
  /** Outside VOTING the controls are disabled; the domain would reject the votes anyway. */
  isVotingOpen: boolean;
  onSimulatedVote: HostVoteAction;
  onRandomVotes: HostVoteAction;
};

/**
 * DEV ONLY: stands in for Twitch chat until Phase 5. A simulated viewer goes
 * through exactly the same voting rules as a real one.
 */
export function SimulatedVotesPanel({
  options,
  isVotingOpen,
  onSimulatedVote,
  onRandomVotes,
}: SimulatedVotesPanelProps) {
  const [simulatedFeedback, simulatedVoteAction, isSimulatedPending] = useActionState(onSimulatedVote, null);
  const [randomFeedback, randomVotesAction, isRandomPending] = useActionState(onRandomVotes, null);
  // Controlled, because React resets uncontrolled fields after a form action;
  // keeping the name makes "vote again as the same viewer" a single click.
  const [viewerKey, setViewerKey] = useState("viewer-1");
  const feedback = simulatedFeedback ?? randomFeedback;

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.devTag}>DEV</span>
        <h2 className={styles.heading}>Simulated viewers</h2>
      </header>

      <form action={simulatedVoteAction} className={styles.row}>
        <label className={styles.viewerField}>
          Viewer
          <input
            className={styles.viewerInput}
            name="viewerKey"
            value={viewerKey}
            onChange={(event) => setViewerKey(event.target.value)}
            pattern="[A-Za-z0-9\-]{1,32}"
            required
          />
        </label>
        <div className={styles.optionButtons}>
          {options.map((option, index) => (
            <button
              key={option.id}
              className={styles.optionButton}
              type="submit"
              name="optionId"
              value={option.id}
              title={option.label}
              disabled={!isVotingOpen || isSimulatedPending}
            >
              Vote {index + 1}
            </button>
          ))}
        </div>
      </form>

      <form action={randomVotesAction}>
        <input type="hidden" name="count" value={RANDOM_BATCH_SIZE} />
        <button className={styles.randomButton} type="submit" disabled={!isVotingOpen || isRandomPending}>
          Add {RANDOM_BATCH_SIZE} random votes
        </button>
      </form>

      <p className={styles.hint}>
        {isVotingOpen
          ? "Voting again as the same viewer replaces their vote. Random votes come from a fixed pool of viewers, so repeated batches replace earlier ones."
          : "Simulated votes are available while voting is open."}
      </p>

      {feedback && (
        <p className={styles.feedback} role="alert">
          {describeVoteFailure(feedback.failure)}
        </p>
      )}
    </section>
  );
}
