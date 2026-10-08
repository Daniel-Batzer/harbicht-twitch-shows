"use client";

import { useEffect, useState } from "react";
import type { GameSnapshot } from "../game-snapshot";

// TEMPORARY transport (Decision 041): the overlay polls the server snapshot.
// When a realtime transport is chosen, only this hook and the API route change.

export const GAME_SNAPSHOT_POLL_INTERVAL_MS = 1000;
const GAME_SNAPSHOT_URL = "/api/game/state";

/** Returns the latest snapshot, or null until the first successful fetch. */
export function usePolledGameSnapshot(): GameSnapshot | null {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    // An unchanged snapshot keeps the previous object, so a poll alone never
    // re-renders the overlay or restarts its reveal animations.
    let lastSnapshotJson: string | null = null;

    async function fetchSnapshot() {
      try {
        const response = await fetch(GAME_SNAPSHOT_URL, {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
        const snapshotJson = await response.text();
        if (snapshotJson === lastSnapshotJson) return;
        lastSnapshotJson = snapshotJson;
        setSnapshot(JSON.parse(snapshotJson) as GameSnapshot);
      } catch (error) {
        if (abortController.signal.aborted) return;
        // Keep showing the last good snapshot; the next poll retries.
        console.warn("[overlay] failed to fetch game snapshot", error);
      }
    }

    void fetchSnapshot();
    const intervalId = setInterval(fetchSnapshot, GAME_SNAPSHOT_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      abortController.abort();
    };
  }, []);

  return snapshot;
}
