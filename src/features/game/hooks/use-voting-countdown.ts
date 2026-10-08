"use client";

import { useEffect, useState } from "react";
import type { VotingTimerSnapshot } from "../game-snapshot";
import { COUNTDOWN_PRESENTATION, getCountdownDisplay, type CountdownDisplay } from "../voting-countdown";

/**
 * Ticks the countdown display with the viewer's clock (Decision 047). Display
 * state only: it never sends a command, even when it reaches zero.
 *
 * Returns null until the first tick in the browser, so a server-rendered page
 * never hydrates with a time read on the server.
 */
export function useVotingCountdown(timer: VotingTimerSnapshot): CountdownDisplay | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const firstTickId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, COUNTDOWN_PRESENTATION.tickIntervalMs);
    return () => {
      clearTimeout(firstTickId);
      clearInterval(intervalId);
    };
  }, []);

  return nowMs === null ? null : getCountdownDisplay(timer, nowMs);
}
