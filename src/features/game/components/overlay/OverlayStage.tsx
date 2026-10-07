"use client";

import { useEffect, useState } from "react";
import { usePolledGameSnapshot } from "../../hooks/use-polled-game-snapshot";
import { AnswerCards } from "./AnswerCards";
import { FinishedCard } from "./FinishedCard";
import { PhaseBanner } from "./PhaseBanner";
import { QuestionCard } from "./QuestionCard";
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

export function OverlayStage() {
  const snapshot = usePolledGameSnapshot();
  const scale = useStageScale();

  return (
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
          <QuestionCard
            eyebrow={`Round ${snapshot.round.number} / ${snapshot.round.totalRounds}`}
            context={snapshot.round.question.context}
            prompt={snapshot.round.question.prompt}
          />
          <PhaseBanner phase={snapshot.status} />
          {/* Answers appear when voting opens (ARCHITECTURE §22) and stay for the rest of the round. */}
          {snapshot.status !== "INTRO" && (
            <AnswerCards
              options={snapshot.round.question.options}
              state={snapshot.status === "VOTING" ? "open" : "locked"}
            />
          )}
        </div>
      )}
    </div>
  );
}
