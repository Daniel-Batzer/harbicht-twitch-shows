"use client";

import { useActionState } from "react";
import type { GameCommand, TransitionFailure } from "../../domain/game-state";
import type { GameSnapshot } from "../../game-snapshot";
import styles from "./HostPanel.module.scss";

/**
 * Failures the host can see: domain transition failures, plus input that never
 * reached the domain because it was not a valid command.
 */
export type HostActionFailure = TransitionFailure | { reason: "UNKNOWN_COMMAND" };
export type HostActionFeedback = { failure: HostActionFailure } | null;
type HostCommandAction = (previousFeedback: HostActionFeedback, formData: FormData) => Promise<HostActionFeedback>;

type HostPanelProps = {
  snapshot: GameSnapshot;
  /** Decided by the domain; the panel only arranges them. */
  availableCommands: GameCommand[];
  onCommand: HostCommandAction;
};

const commandLabels: Record<GameCommand, string> = {
  START_GAME: "Start game",
  OPEN_VOTING: "Open voting",
  LOCK_VOTING: "Lock voting",
  REVEAL_RESULT: "Reveal",
  SHOW_RESULT: "Show result",
  START_NEXT_ROUND: "Start next round",
  FINISH_GAME: "Finish game",
  END_GAME: "End game",
};

// The commands that move the game forward. At most one of them is available at a time.
const FORWARD_COMMANDS: GameCommand[] = [
  "START_GAME",
  "OPEN_VOTING",
  "LOCK_VOTING",
  "REVEAL_RESULT",
  "SHOW_RESULT",
  "START_NEXT_ROUND",
];

type HostControls = {
  primary: GameCommand | null;
  finishEarly: boolean;
  end: boolean;
};

/**
 * Places the available commands into fixed slots. On the last round's result
 * there is no next round, so Finish game becomes the primary step instead of a
 * second "finish early" button.
 */
function arrangeHostControls(availableCommands: GameCommand[]): HostControls {
  const forwardCommand = FORWARD_COMMANDS.find((command) => availableCommands.includes(command)) ?? null;
  const canFinish = availableCommands.includes("FINISH_GAME");

  return {
    primary: forwardCommand ?? (canFinish ? "FINISH_GAME" : null),
    finishEarly: forwardCommand !== null && canFinish,
    end: availableCommands.includes("END_GAME"),
  };
}

function describeFailure(failure: HostActionFailure): string {
  switch (failure.reason) {
    case "INVALID_TRANSITION":
      return `“${commandLabels[failure.command]}” is not possible while the game is ${failure.from}. The panel now shows the current state.`;
    case "INVALID_TOTAL_ROUNDS":
      return "The configured number of rounds is invalid.";
    case "NO_ROUNDS_REMAINING":
      return "That was the last round. Finish the game instead.";
    case "NOT_ENOUGH_QUESTIONS":
      return "The deck does not have enough unplayed questions for this session.";
    case "UNKNOWN_COMMAND":
      return "Unknown command.";
  }
}

export function HostPanel({ snapshot, availableCommands, onCommand }: HostPanelProps) {
  const [feedback, commandAction, isPending] = useActionState(onCommand, null);
  const controls = arrangeHostControls(availableCommands);

  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <h1 className={styles.title}>Host</h1>
        <span className={styles.status} data-status={snapshot.status}>
          {snapshot.status}
        </span>
      </header>

      {/* One form; the clicked button submits its own command value. */}
      <form action={commandAction} className={styles.controls}>
        <div className={styles.primarySlot}>
          {controls.primary && (
            <button
              className={styles.primaryButton}
              type="submit"
              name="command"
              value={controls.primary}
              disabled={isPending}
            >
              {commandLabels[controls.primary]}
            </button>
          )}
          {controls.finishEarly && (
            <button
              className={styles.secondaryButton}
              type="submit"
              name="command"
              value="FINISH_GAME"
              disabled={isPending}
            >
              Finish game early
            </button>
          )}
        </div>
        {controls.end && (
          <button className={styles.endButton} type="submit" name="command" value="END_GAME" disabled={isPending}>
            {snapshot.status === "FINISHED" ? "Close game" : commandLabels.END_GAME}
          </button>
        )}
      </form>

      {feedback && (
        <p className={styles.feedback} role="alert">
          {describeFailure(feedback.failure)}
        </p>
      )}

      <section className={styles.preview}>
        {snapshot.status === "IDLE" ? (
          <p className={styles.hint}>No game running. The overlay is waiting.</p>
        ) : snapshot.status === "FINISHED" ? (
          <>
            <p className={styles.roundLabel}>Game finished</p>
            <p className={styles.hint}>
              {snapshot.roundsPlayed} of {snapshot.totalRounds} rounds played. The overlay shows the game-over
              screen until you close the game.
            </p>
          </>
        ) : (
          <>
            <p className={styles.roundLabel}>
              Round {snapshot.round.number} / {snapshot.round.totalRounds}
            </p>
            {snapshot.round.question.context && (
              <p className={styles.context}>{snapshot.round.question.context}</p>
            )}
            <h2 className={styles.prompt}>{snapshot.round.question.prompt}</h2>
            <ol className={styles.options}>
              {snapshot.round.question.options.map((option) => (
                <li key={option.id}>{option.label}</li>
              ))}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
