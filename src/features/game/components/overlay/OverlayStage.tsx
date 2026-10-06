"use client";

import { useEffect, useState } from "react";
import { usePolledGameSnapshot } from "../../hooks/use-polled-game-snapshot";
import { AnswerCards } from "./AnswerCards";
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
      {snapshot?.status === "INTRO" && (
        // Keyed by round so a new round remounts and replays the entrance.
        <div key={snapshot.roundId} className={styles.round}>
          <QuestionCard context={snapshot.question.context} prompt={snapshot.question.prompt} />
          <AnswerCards options={snapshot.question.options} />
        </div>
      )}
    </div>
  );
}
