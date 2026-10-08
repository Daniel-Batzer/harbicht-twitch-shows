import type { TwitchStatusView } from "../twitch-connection";
import type { TwitchConnectionError } from "../twitch-connection-store";
import styles from "./TwitchConnectionPanel.module.scss";

// Host-only: shows whether chat votes can arrive and lets the host connect or
// disconnect. Never shows credentials; "not configured" only names the
// variables to set.

type TwitchConnectionPanelProps = {
  status: TwitchStatusView;
  onDisconnect: () => Promise<void>;
};

/** A plain link: the route redirects to Twitch, which a client-side navigation cannot follow. */
const CONNECT_URL = "/api/twitch/auth/start";

const stateLabels: Record<TwitchStatusView["state"], string> = {
  NOT_CONFIGURED: "Not configured",
  DISCONNECTED: "Offline",
  CONNECTING: "Connecting…",
  CONNECTED: "Live",
  RECONNECTING: "Reconnecting…",
};

const errorMessages: Record<TwitchConnectionError, string> = {
  AUTH_DENIED: "Access was declined on Twitch.",
  STATE_MISMATCH: "The Twitch login could not be verified. Start it again from this page.",
  AUTH_FAILED: "The Twitch login failed. Try again.",
  MISSING_SCOPE: "Twitch did not grant chat access (user:read:chat).",
  TOKEN_INVALID: "The Twitch login expired or was revoked. Connect again.",
  SUBSCRIPTION_FAILED: "Twitch refused the chat subscription.",
  REVOKED: "Twitch revoked chat access, e.g. because the app was disconnected on Twitch. Connect again.",
  CONNECTION_LOST: "The connection to Twitch was lost.",
};

function describeLastChatMessage(secondsAgo: number | null): string {
  if (secondsAgo === null) return "no chat messages yet";
  if (secondsAgo < 5) return "last chat message just now";
  if (secondsAgo < 120) return `last chat message ${secondsAgo} s ago`;
  return `last chat message ${Math.floor(secondsAgo / 60)} min ago`;
}

export function TwitchConnectionPanel({ status, onDisconnect }: TwitchConnectionPanelProps) {
  const hasConnection =
    status.state === "CONNECTING" || status.state === "CONNECTED" || status.state === "RECONNECTING";

  return (
    <section className={styles.panel} data-state={status.state}>
      <header className={styles.header}>
        <h2 className={styles.heading}>Twitch chat</h2>
        <span className={styles.badge}>{stateLabels[status.state]}</span>
      </header>

      {status.state === "NOT_CONFIGURED" && (
        <p className={styles.hint}>
          Set <code>TWITCH_CLIENT_ID</code>, <code>TWITCH_CLIENT_SECRET</code> and <code>TWITCH_REDIRECT_URI</code> in
          your local environment and restart the dev server.
        </p>
      )}

      {status.state === "DISCONNECTED" && (
        <p className={styles.hint}>Chat votes are off. Connect to let viewers vote with !vote 1, 2 or 3.</p>
      )}

      {hasConnection && status.broadcasterLogin && (
        <p className={styles.hint}>
          {status.state === "CONNECTED" ? "Reading chat as " : "Connecting to chat as "}
          <strong className={styles.login}>{status.broadcasterLogin}</strong>
          {status.state === "RECONNECTING" && ` (attempt ${status.reconnectAttempt})`}
        </p>
      )}

      {status.state === "CONNECTED" && (
        <p className={styles.stats}>
          <span>{status.chatVotes.accepted} chat votes counted</span>
          <span>{status.chatVotes.rejected} rejected</span>
          <span>{describeLastChatMessage(status.secondsSinceLastChatMessage)}</span>
        </p>
      )}

      {status.lastError && status.state !== "CONNECTED" && (
        <p className={styles.error} role="alert">
          {errorMessages[status.lastError]}
        </p>
      )}

      {status.state === "DISCONNECTED" && (
        <a className={styles.connectButton} href={CONNECT_URL}>
          Connect Twitch
        </a>
      )}

      {hasConnection && (
        <form action={onDisconnect}>
          <button className={styles.disconnectButton} type="submit">
            Disconnect
          </button>
        </form>
      )}
    </section>
  );
}
