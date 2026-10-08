import { readEventSubFrame } from "./eventsub-messages";
import type { RecentMessageIds } from "./recent-message-ids";

// One EventSub WebSocket session, including Twitch's session_reconnect
// migration. Uses Node's built-in WebSocket client (no dependency).
// https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
//
// What this client does on its own:
// - session_reconnect: opens the reconnect URL, waits for its welcome, then
//   closes the old socket. Subscriptions move along, so nothing is re-created.
// - keepalive watchdog: no message within the keepalive timeout (+ grace)
//   means the connection is dead.
// What it leaves to its owner (twitch-connection.ts):
// - subscribing after the first welcome (within Twitch's 10 s deadline),
// - reconnecting after a lost connection (a new session needs new subscriptions),
// - reacting to revocations.

export const EVENTSUB_WEBSOCKET_URL = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";

/** Used until the welcome message reports the session's keepalive timeout. */
const INITIAL_KEEPALIVE_TIMEOUT_SECONDS = 30;
/** Extra time before a silent connection counts as dead (network jitter, busy dev server). */
const KEEPALIVE_GRACE_MS = 5_000;

export type EventSubNotification = { messageId: string; subscriptionType: string; event: unknown };

export type EventSubClientCallbacks = {
  /** The first welcome: subscribe now. Not called again after a session_reconnect. */
  onSessionStarted: (sessionId: string) => void;
  onNotification: (notification: EventSubNotification) => void;
  onRevoked: (revocation: { subscriptionType: string; status: string }) => void;
  /** The session is gone (closed or silent). Called at most once; the client is closed afterwards. */
  onConnectionLost: (reason: string) => void;
};

export type EventSubClient = {
  /** Closes every socket without reporting a lost connection. */
  close: () => void;
};

type EventSubClientOptions = {
  url: string;
  recentMessageIds: RecentMessageIds;
  callbacks: EventSubClientCallbacks;
};

export function openEventSubClient({ url, recentMessageIds, callbacks }: EventSubClientOptions): EventSubClient {
  let activeSocket: WebSocket | null = null;
  /** The socket opened for a session_reconnect, until its welcome arrives. */
  let pendingSocket: WebSocket | null = null;
  let keepaliveTimeoutMs = INITIAL_KEEPALIVE_TIMEOUT_SECONDS * 1000;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let isClosed = false;

  function stopWatchdog() {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  }

  function resetWatchdog() {
    stopWatchdog();
    watchdog = setTimeout(
      () => loseConnection("no message within the keepalive timeout"),
      keepaliveTimeoutMs + KEEPALIVE_GRACE_MS,
    );
  }

  function closeAll() {
    isClosed = true;
    stopWatchdog();
    activeSocket?.close();
    pendingSocket?.close();
    activeSocket = null;
    pendingSocket = null;
  }

  function loseConnection(reason: string) {
    if (isClosed) return;
    closeAll();
    callbacks.onConnectionLost(reason);
  }

  /** Swaps in the reconnect socket once Twitch has welcomed it, then retires the old one. */
  function completeReconnect(socket: WebSocket) {
    const oldSocket = activeSocket;
    activeSocket = socket;
    pendingSocket = null;
    oldSocket?.close();
    resetWatchdog();
  }

  function handleFrame(socket: WebSocket, data: unknown) {
    if (isClosed) return;
    if (socket === activeSocket) resetWatchdog();
    if (typeof data !== "string") {
      console.warn("[twitch] ignored a non-text EventSub frame");
      return;
    }

    const frame = readEventSubFrame(data, recentMessageIds);
    switch (frame.kind) {
      case "INVALID_FRAME":
        console.warn("[twitch] ignored an invalid EventSub frame", { problem: frame.problem });
        return;
      case "INVALID_PAYLOAD":
        console.warn("[twitch] ignored an EventSub message with an invalid payload", {
          messageType: frame.messageType,
          messageId: frame.messageId,
        });
        return;
      case "DUPLICATE":
        console.debug("[twitch] ignored a duplicate EventSub message", { messageId: frame.messageId });
        return;
      case "WELCOME":
        keepaliveTimeoutMs = frame.keepaliveTimeoutSeconds * 1000;
        if (socket === pendingSocket) {
          completeReconnect(socket);
        } else if (socket === activeSocket) {
          resetWatchdog();
          callbacks.onSessionStarted(frame.sessionId);
        }
        return;
      case "KEEPALIVE":
        return;
      case "RECONNECT":
        if (socket === activeSocket && !pendingSocket) {
          console.info("[twitch] Twitch asked to reconnect; migrating the session");
          pendingSocket = connect(frame.reconnectUrl);
        }
        return;
      case "NOTIFICATION":
        callbacks.onNotification(frame);
        return;
      case "REVOCATION":
        callbacks.onRevoked({ subscriptionType: frame.subscriptionType, status: frame.status });
        return;
      case "UNKNOWN_MESSAGE_TYPE":
        console.debug("[twitch] ignored an unknown EventSub message type", { messageType: frame.messageType });
        return;
    }
  }

  function connect(socketUrl: string): WebSocket {
    const socket = new WebSocket(socketUrl);
    socket.addEventListener("message", (event) => handleFrame(socket, event.data));
    socket.addEventListener("error", () => {
      if (!isClosed) console.warn("[twitch] EventSub socket error");
    });
    socket.addEventListener("close", (event) => {
      // The old socket after a completed reconnect closes as expected.
      if (socket !== activeSocket && socket !== pendingSocket) return;
      loseConnection(`socket closed (code ${event.code}${event.reason ? `: ${event.reason}` : ""})`);
    });
    return socket;
  }

  activeSocket = connect(url);
  // Also covers a socket that opens but never sends its welcome.
  resetWatchdog();

  return { close: closeAll };
}
