"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// TEMPORARY (Decision 046): chat votes and the Twitch connection change the
// host's data without a host action, so /host re-renders its server
// components every few seconds. router.refresh keeps client state (open
// forms, action feedback). Replaced together with the overlay polling once a
// realtime transport is chosen (Decision 026).

export const HOST_REFRESH_INTERVAL_MS = 2000;

export function HostAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = setInterval(() => {
      // A background tab does not need fresh data; it refreshes when shown again.
      if (document.visibilityState === "visible") router.refresh();
    }, HOST_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [router]);

  return null;
}
