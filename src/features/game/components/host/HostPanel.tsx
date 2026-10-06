"use client";

import { useActionState } from "react";
import type { TransitionFailureReason } from "../../domain/game-state";
import type { GameSnapshot } from "../../game-snapshot";
import styles from "./HostPanel.module.scss";

export type HostActionFeedback = { failureReason: TransitionFailureReason } | null;
type HostAction = () => Promise<HostActionFeedback>;

type HostPanelProps = {
  snapshot: GameSnapshot;
  onStartGame: HostAction;
  onEndGame: HostAction;
};

const failureMessages: Record<TransitionFailureReason, string> = {
  GAME_ALREADY_RUNNING: "A game is already running. End it before starting a new one.",
  NO_GAME_RUNNING: "There is no running game to end.",
  DECK_EMPTY: "The deck has no questions.",
};

export function HostPanel({ snapshot, onStartGame, onEndGame }: HostPanelProps) {
  const [startFeedback, startAction, isStarting] = useActionState(onStartGame, null);
  const [endFeedback, endAction, isEnding] = useActionState(onEndGame, null);
  const feedback = startFeedback ?? endFeedback;
  const isGameRunning = snapshot.status !== "IDLE";

  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <h1 className={styles.title}>Host</h1>
        <span className={styles.status} data-status={snapshot.status}>
          {snapshot.status}
        </span>
      </header>

      <section className={styles.controls}>
        <form action={startAction}>
          <button className={styles.startButton} type="submit" disabled={isGameRunning || isStarting}>
            Start game
          </button>
        </form>
        <form action={endAction}>
          <button className={styles.endButton} type="submit" disabled={!isGameRunning || isEnding}>
            End game
          </button>
        </form>
      </section>

      {feedback && (
        <p className={styles.feedback} role="alert">
          {failureMessages[feedback.failureReason]}
        </p>
      )}

      <section className={styles.preview}>
        {snapshot.status === "IDLE" ? (
          <p className={styles.idleHint}>No game running. The overlay is waiting.</p>
        ) : (
          <>
            <p className={styles.roundLabel}>Round {snapshot.roundNumber}</p>
            {snapshot.question.context && <p className={styles.context}>{snapshot.question.context}</p>}
            <h2 className={styles.prompt}>{snapshot.question.prompt}</h2>
            <ol className={styles.options}>
              {snapshot.question.options.map((option) => (
                <li key={option.id}>{option.label}</li>
              ))}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
