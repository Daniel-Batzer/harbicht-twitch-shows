// Remembers the most recent EventSub message ids. Twitch delivers at least
// once and resends with the same message id, and the overlap during a
// session_reconnect can deliver twice. Without this, a late duplicate of
// `!vote 1` could overwrite the same viewer's newer `!vote 2`.
// Bounded so it never grows over a long stream; the oldest id is forgotten first.

export type RecentMessageIds = {
  /** Returns true if the id is new (and remembers it), false if it was already seen. */
  remember: (messageId: string) => boolean;
};

export function createRecentMessageIds(capacity: number): RecentMessageIds {
  const seenIds = new Set<string>();
  const idsInArrivalOrder: string[] = [];

  return {
    remember(messageId) {
      if (seenIds.has(messageId)) return false;

      seenIds.add(messageId);
      idsInArrivalOrder.push(messageId);
      if (idsInArrivalOrder.length > capacity) {
        const oldestId = idsInArrivalOrder.shift();
        if (oldestId !== undefined) seenIds.delete(oldestId);
      }
      return true;
    },
  };
}
