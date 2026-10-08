"use client";

import { useActionState } from "react";
import clsx from "clsx";
import { TwitchConnectionPanel } from "../../../twitch/components/TwitchConnectionPanel";
import type { TwitchStatusView } from "../../../twitch/twitch-connection";
import {
  REVEAL_ORDERS,
  SHARED_CHAT_VOTING_MODES,
  type GameCommand,
  type RevealOrder,
  type SharedChatVotingMode,
  type TransitionFailure,
} from "../../domain/game-state";
import { getRevealedResult, type GameSnapshot, type RoundPhaseSnapshot } from "../../game-snapshot";
import type { HostRoundView } from "../../host-view";
import {
  CUSTOM_VOTING_DURATION_LIMITS,
  CUSTOM_VOTING_TIMER,
  NO_VOTING_TIMER,
  VOTING_DURATION_PRESETS,
} from "../../voting-duration-input";
import { HostResultSummary } from "./HostResultSummary";
import { HostVoteControls } from "./HostVoteControls";
import { HostVotingCountdown } from "./HostVotingCountdown";
import { SimulatedVotesPanel } from "./SimulatedVotesPanel";
import type { HostVoteAction } from "./vote-feedback";
import styles from "./HostPanel.module.scss";

/**
 * Failures the host can see: domain transition failures, plus input that never
 * reached the domain because it was not a valid command or setting.
 */
export type HostActionFailure =
  | TransitionFailure
  | { reason: "UNKNOWN_COMMAND" }
  | { reason: "INVALID_REVEAL_ORDER" }
  | { reason: "INVALID_SHARED_CHAT_MODE" };
export type HostActionFeedback = { failure: HostActionFailure } | null;
type HostCommandAction = (previousFeedback: HostActionFeedback, formData: FormData) => Promise<HostActionFeedback>;

type HostPanelProps = {
  snapshot: GameSnapshot;
  /** Host-only round data (vote count, own vote); null outside a round. */
  hostRound: HostRoundView | null;
  /** Decided by the domain; the panel only arranges them. */
  availableCommands: GameCommand[];
  /** Preselected when a new game is started. */
  defaultRevealOrder: RevealOrder;
  /** Preselected when a new game is started. */
  defaultSharedChatVotingMode: SharedChatVotingMode;
  /** Preselected when a new game is started; null means no timer. */
  defaultVotingDurationSeconds: number | null;
  twitchStatus: TwitchStatusView;
  /** DEV: the simulated-viewer controls exist only in development. */
  isVoteSimulationEnabled: boolean;
  onCommand: HostCommandAction;
  onHostVote: HostVoteAction;
  onSimulatedVote: HostVoteAction;
  onRandomVotes: HostVoteAction;
  onTwitchDisconnect: () => Promise<void>;
};

const commandLabels: Record<GameCommand, string> = {
  START_GAME: "Start game",
  OPEN_VOTING: "Open voting",
  LOCK_VOTING: "Lock voting",
  STOP_VOTING_TIMER: "Stop timer",
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

const revealOrderLabels: Record<RevealOrder, string> = {
  AUDIENCE_FIRST: "audience first, then your pick",
  HOST_FIRST: "your pick first, then the audience",
};

const revealOrderTitles: Record<RevealOrder, string> = {
  AUDIENCE_FIRST: "Audience first",
  HOST_FIRST: "Host first",
};

const sharedChatModeLabels: Record<SharedChatVotingMode, string> = {
  OWN_CHANNEL_ONLY: "only votes from your own chat count",
  INCLUDE_SHARED_CHAT: "votes from Shared Chat partner channels count too",
};

const sharedChatModeTitles: Record<SharedChatVotingMode, string> = {
  OWN_CHANNEL_ONLY: "Own channel only",
  INCLUDE_SHARED_CHAT: "Include Shared Chat",
};

/** Part of the start form: the order applies to the game that is about to start and stays fixed until it ends. */
function RevealOrderPicker({ defaultRevealOrder }: { defaultRevealOrder: RevealOrder }) {
  return (
    <fieldset className={styles.choice}>
      <legend className={styles.choiceLegend}>Reveal order</legend>
      {REVEAL_ORDERS.map((revealOrder) => (
        <label key={revealOrder} className={styles.choiceOption}>
          <input
            type="radio"
            name="revealOrder"
            value={revealOrder}
            defaultChecked={revealOrder === defaultRevealOrder}
          />
          <span className={styles.choiceTitle}>{revealOrderTitles[revealOrder]}</span>
          <span className={styles.choiceDescription}>Reveals {revealOrderLabels[revealOrder]}.</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Part of the start form, like the reveal order: fixed for the whole game. Only matters during Twitch Shared Chat. */
function SharedChatModePicker({ defaultMode }: { defaultMode: SharedChatVotingMode }) {
  return (
    <fieldset className={styles.choice}>
      <legend className={styles.choiceLegend}>Shared Chat</legend>
      {SHARED_CHAT_VOTING_MODES.map((mode) => (
        <label key={mode} className={styles.choiceOption}>
          <input type="radio" name="sharedChatVotingMode" value={mode} defaultChecked={mode === defaultMode} />
          <span className={styles.choiceTitle}>{sharedChatModeTitles[mode]}</span>
          <span className={styles.choiceDescription}>During Shared Chat, {sharedChatModeLabels[mode]}.</span>
        </label>
      ))}
    </fieldset>
  );
}

/** The custom value prefilled when the default duration is not one of the presets. */
const FALLBACK_CUSTOM_SECONDS = 45;

/**
 * Part of the start form, like the reveal order: every round of the game uses
 * this timer (Decision 047). The server validates the custom value.
 */
function VotingTimerPicker({ defaultDurationSeconds }: { defaultDurationSeconds: number | null }) {
  const isPreset = VOTING_DURATION_PRESETS.some((seconds) => seconds === defaultDurationSeconds);
  const defaultChoice =
    defaultDurationSeconds === null
      ? NO_VOTING_TIMER
      : isPreset
        ? String(defaultDurationSeconds)
        : CUSTOM_VOTING_TIMER;
  const { minSeconds, maxSeconds } = CUSTOM_VOTING_DURATION_LIMITS;
  const defaultCustomSeconds =
    defaultChoice === CUSTOM_VOTING_TIMER && defaultDurationSeconds !== null
      ? defaultDurationSeconds
      : FALLBACK_CUSTOM_SECONDS;

  return (
    <fieldset className={clsx(styles.choice, styles.timerChoice)}>
      <legend className={styles.choiceLegend}>Voting timer</legend>
      <label className={styles.choiceOption}>
        <input
          type="radio"
          name="votingTimer"
          value={NO_VOTING_TIMER}
          defaultChecked={defaultChoice === NO_VOTING_TIMER}
        />
        <span className={styles.choiceTitle}>No timer</span>
        <span className={styles.choiceDescription}>You lock voting by hand.</span>
      </label>
      {VOTING_DURATION_PRESETS.map((seconds) => (
        <label key={seconds} className={styles.choiceOption}>
          <input
            type="radio"
            name="votingTimer"
            value={String(seconds)}
            defaultChecked={defaultChoice === String(seconds)}
          />
          <span className={styles.choiceTitle}>{seconds} s</span>
          <span className={styles.choiceDescription}>Locks when time runs out.</span>
        </label>
      ))}
      <label className={styles.choiceOption}>
        <input
          type="radio"
          name="votingTimer"
          value={CUSTOM_VOTING_TIMER}
          defaultChecked={defaultChoice === CUSTOM_VOTING_TIMER}
        />
        <span className={styles.choiceTitle}>Custom</span>
        <span className={styles.choiceDescription}>
          <input
            className={styles.secondsInput}
            type="number"
            name="customVotingSeconds"
            inputMode="numeric"
            defaultValue={defaultCustomSeconds}
            aria-label="Custom voting duration in seconds"
          />{" "}
          s ({minSeconds}–{maxSeconds})
        </span>
      </label>
    </fieldset>
  );
}

function describeVotingTimer(votingDurationSeconds: number | null): string {
  return votingDurationSeconds === null
    ? "no timer, you lock voting by hand"
    : `${votingDurationSeconds} s, then voting locks automatically`;
}

/**
 * The host sees the audience result at the same moment as the overlay, so the
 * reveal is a surprise for them too. Until then they only see their own vote.
 */
function HostRoundOutcome({
  snapshot,
  hostRound,
  onHostVote,
}: {
  snapshot: RoundPhaseSnapshot;
  hostRound: HostRoundView | null;
  onHostVote: HostVoteAction;
}) {
  if (snapshot.status === "INTRO") {
    return (
      <ol className={styles.options}>
        {snapshot.round.question.options.map((option) => (
          <li key={option.id}>{option.label}</li>
        ))}
      </ol>
    );
  }

  const result = getRevealedResult(snapshot);
  if (result) {
    return (
      <HostResultSummary
        options={snapshot.round.question.options}
        result={result}
        hostOptionId={hostRound?.hostOptionId ?? null}
      />
    );
  }

  if (!hostRound) return null;
  return (
    <HostVoteControls
      options={snapshot.round.question.options}
      hostOptionId={hostRound.hostOptionId}
      voteCount={hostRound.voteCount}
      isVotingOpen={snapshot.status === "VOTING"}
      onVote={onHostVote}
    />
  );
}

function describeFailure(failure: HostActionFailure): string {
  switch (failure.reason) {
    case "INVALID_TRANSITION":
      // Most likely the timer locked voting between the last refresh and the click (Decision 047).
      if (failure.from === "LOCKED" && (failure.command === "LOCK_VOTING" || failure.command === "STOP_VOTING_TIMER")) {
        return "Time was already up, voting is locked.";
      }
      return `“${commandLabels[failure.command]}” is not possible while the game is ${failure.from}. The panel now shows the current state.`;
    case "INVALID_TOTAL_ROUNDS":
      return "The configured number of rounds is invalid.";
    case "INVALID_VOTING_DURATION": {
      const { minSeconds, maxSeconds } = CUSTOM_VOTING_DURATION_LIMITS;
      return `Choose a voting timer. A custom timer needs whole seconds from ${minSeconds} to ${maxSeconds}.`;
    }
    case "VOTING_TIMER_EXPIRED":
      return "The countdown has already run out, so the timer can no longer be stopped. Voting locks in a moment.";
    case "NO_ROUNDS_REMAINING":
      return "That was the last round. Finish the game instead.";
    case "NOT_ENOUGH_QUESTIONS":
      return "The deck does not have enough unplayed questions for this session.";
    case "UNKNOWN_COMMAND":
      return "Unknown command.";
    case "INVALID_REVEAL_ORDER":
      return "Choose a reveal order before starting the game.";
    case "INVALID_SHARED_CHAT_MODE":
      return "Choose a Shared Chat setting before starting the game.";
  }
}

export function HostPanel({
  snapshot,
  hostRound,
  availableCommands,
  defaultRevealOrder,
  defaultSharedChatVotingMode,
  defaultVotingDurationSeconds,
  twitchStatus,
  isVoteSimulationEnabled,
  onCommand,
  onHostVote,
  onSimulatedVote,
  onRandomVotes,
  onTwitchDisconnect,
}: HostPanelProps) {
  const [feedback, commandAction, isPending] = useActionState(onCommand, null);
  const controls = arrangeHostControls(availableCommands);
  const votingTimer = snapshot.status === "VOTING" ? snapshot.votingTimer : null;

  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <h1 className={styles.title}>Host</h1>
        <span className={styles.status} data-status={snapshot.status}>
          {snapshot.status}
        </span>
      </header>

      <TwitchConnectionPanel status={twitchStatus} onDisconnect={onTwitchDisconnect} />

      {/* One form; the clicked button submits its own command value. */}
      <form action={commandAction} className={styles.commandForm}>
        {snapshot.status === "IDLE" && (
          <div className={styles.startSettings}>
            <RevealOrderPicker defaultRevealOrder={defaultRevealOrder} />
            <SharedChatModePicker defaultMode={defaultSharedChatVotingMode} />
            <VotingTimerPicker defaultDurationSeconds={defaultVotingDurationSeconds} />
          </div>
        )}
        {votingTimer && (
          <HostVotingCountdown
            timer={votingTimer}
            canStopTimer={availableCommands.includes("STOP_VOTING_TIMER")}
            isPending={isPending}
          />
        )}
        <div className={styles.controls}>
          <div className={styles.primarySlot}>
            {controls.primary && (
              <button
                className={styles.primaryButton}
                type="submit"
                name="command"
                value={controls.primary}
                disabled={isPending}
              >
                {controls.primary === "LOCK_VOTING" && votingTimer
                  ? "Lock voting now"
                  : commandLabels[controls.primary]}
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
        </div>
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
            {hostRound && (
              <p className={styles.hint}>
                Reveal order: {revealOrderLabels[hostRound.revealOrder]}. Shared Chat:{" "}
                {sharedChatModeLabels[hostRound.sharedChatVotingMode]}. Voting timer:{" "}
                {describeVotingTimer(hostRound.votingDurationSeconds)}.
              </p>
            )}
            {snapshot.status === "LOCKED" && (
              <p className={styles.lockedNote}>
                {snapshot.votingClosedBy === "TIMER" ? "Locked by the timer." : "Locked by you."}
              </p>
            )}

            <HostRoundOutcome snapshot={snapshot} hostRound={hostRound} onHostVote={onHostVote} />
          </>
        )}
      </section>

      {/* Rendered for the whole round (not only VOTING) so a rejected vote can still show its message. */}
      {isVoteSimulationEnabled && snapshot.status !== "IDLE" && snapshot.status !== "FINISHED" && (
        <SimulatedVotesPanel
          options={snapshot.round.question.options}
          isVotingOpen={snapshot.status === "VOTING"}
          onSimulatedVote={onSimulatedVote}
          onRandomVotes={onRandomVotes}
        />
      )}
    </main>
  );
}
