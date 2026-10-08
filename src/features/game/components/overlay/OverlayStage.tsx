"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import type { RoundPhaseSnapshot } from "../../game-snapshot";
import { usePolledGameSnapshot } from "../../hooks/use-polled-game-snapshot";
import { AnswerCards } from "./AnswerCards";
import { ChatVoteHint } from "./ChatVoteHint";
import { FinishedCard } from "./FinishedCard";
import { PhaseBanner } from "./PhaseBanner";
import { QuestionCard } from "./QuestionCard";
import { getRoundPresentation } from "./round-presentation";
import { VotingCountdown } from "./VotingCountdown";
import styles from "./OverlayStage.module.scss";

// Reference canvas for OBS (Decision 006). The stage is laid out at this size
// and scaled to fit the actual viewport.
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

function useStageScale(): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return scale;
}

function RoundStage({ snapshot }: { snapshot: RoundPhaseSnapshot }) {
  // What is shown and when comes from the snapshot alone (Decisions 044, 045).
  const presentation = getRoundPresentation(snapshot);

  return (
    <>
      <QuestionCard
        eyebrow={`Round ${snapshot.round.number} / ${snapshot.round.totalRounds}`}
        context={snapshot.round.question.context}
        prompt={snapshot.round.question.prompt}
      />
      <PhaseBanner phaseKey={snapshot.status} banner={presentation.banner} />
      {/* Answers appear when voting opens (ARCHITECTURE §22) and stay mounted for the rest of the round. */}
      {presentation.cards && <AnswerCards cards={presentation.cards} />}
      <AnimatePresence>
        {snapshot.status === "VOTING" && <ChatVoteHint optionCount={snapshot.round.question.options.length} />}
      </AnimatePresence>
      {/* Leaves when the host stops the timer or the server locks voting (Decision 047). */}
      <AnimatePresence>
        {snapshot.status === "VOTING" && snapshot.votingTimer && <VotingCountdown timer={snapshot.votingTimer} />}
      </AnimatePresence>
    </>
  );
}

export function OverlayStage() {
  const snapshot = usePolledGameSnapshot();
  const scale = useStageScale();

  return (
    // "user": with reduced motion requested, Motion skips transform animations and keeps fades.
    <MotionConfig reducedMotion="user">
      <div
        className={styles.stage}
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {/* IDLE (and the first fetch) render nothing: the stage stays transparent. */}

        {snapshot?.status === "FINISHED" && (
          <div className={styles.centered}>
            <FinishedCard roundsPlayed={snapshot.roundsPlayed} />
          </div>
        )}

        {snapshot && snapshot.status !== "IDLE" && snapshot.status !== "FINISHED" && (
          // Keyed by round so a new round remounts and replays the question
          // entrance; phase changes within a round keep it mounted.
          <div key={snapshot.round.id} className={styles.round}>
            <RoundStage snapshot={snapshot} />
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
