import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { API_BASE, REVERB } from "../config/env";

/**
 * Laravel Echo over Reverb (WebSocket) - replaces HTTP polling for chat.
 *
 * Auth: the SPA uses Sanctum PERSONAL ACCESS TOKENS (Bearer), no cookies,
 * so Echo must send the Authorization header to /broadcasting/auth (the
 * route lives in the api middleware group - see bootstrap/app.php).
 *
 * Events use broadcastAs() names (message.sent / message.deleted), so the
 * client listens on the DOT-PREFIXED names (".message.sent", ...).
 */

interface AuthorizerChannel {
  name: string;
}

type AuthCallback = (error: Error | null, auth: { auth: string } | null) => void;

let echo: Echo<"reverb"> | null = null;

function reverbConfig(): Record<string, unknown> {
  // forceTLS only when the baked scheme says https (behind a TLS proxy
  // like Caddy); for plain-HTTP demos ws://host:8080 stays as-is.
  const forceTLS = REVERB.scheme === "https";
  return {
    key: REVERB.key,
    wsHost: REVERB.host,
    wsPort: REVERB.port,
    wssPort: REVERB.port,
    forceTLS,
    disableStats: true,
    enabledTransports: ["ws", "wss"],
    // Bearer-token auth for private channels. NOTE: authorize's first
    // arg is the socketId string, not a params object.
    authorizer: (channel: AuthorizerChannel) => ({
      authorize: (socketId: string, callback: AuthCallback) => {
        const token = localStorage.getItem("token");
        fetch(`${API_BASE}/broadcasting/auth`, {
          method: "POST",
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`auth ${res.status}`);
            callback(null, (await res.json()) as { auth: string });
          })
          .catch((reason: unknown) => { callback(reason instanceof Error ? reason : new Error(String(reason)), null); }
          );
      },
    }),
  };
}

/** Singleton Echo instance; null while logged out. */
export function getEcho(): Echo<"reverb"> | null {
  if (echo) return echo;
  if (!localStorage.getItem("token")) return null;

  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
  echo = new Echo({ broadcaster: "reverb", ...reverbConfig() });
  return echo;
}

/** Private conversation channel - minimal typed surface for hooks. */
export interface EchoReactive {
  // Generic payload: hook goi listen<MessageSentEvent>('.message.sent', ...).
  listen(eventName: string, callback: (payload: unknown) => void): unknown;
  listenForWhisper(eventName: string, callback: (payload: unknown) => void): unknown;
}

export function conversationChannel(conversationId: number): EchoReactive | null {
  const e = getEcho();
  if (!e) return null;
  return e.private(`conversation.${conversationId}`);
}

/** Drop the socket + subscriptions (logout / auth change). */
export function disconnectEcho(): void {
  if (!echo) return;
  echo.disconnect();
  echo = null;
}
