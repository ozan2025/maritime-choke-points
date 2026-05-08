import type {
  ClientMessage,
  ErrorMessage,
  PositionMessage,
  RegionId,
  ServerMessage,
  SnapshotMessage,
} from "@maritime/shared";

import type { ConnectionStatus } from "./vessels-store";

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export interface WsClientHandlers {
  onSnapshot?: (message: SnapshotMessage) => void;
  onPosition?: (message: PositionMessage) => void;
  onError?: (message: ErrorMessage) => void;
  onStatus?: (status: ConnectionStatus) => void;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private currentRegions: RegionId[] = [];
  // Set when the consumer asks to disconnect; suppresses auto-reconnect.
  private intentionallyClosed = false;

  constructor(
    private readonly url: string,
    private readonly handlers: WsClientHandlers = {},
  ) {}

  connect(): void {
    this.intentionallyClosed = false;
    this.openSocket();
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket !== null) {
      this.socket.close(1000, "client disconnecting");
      this.socket = null;
    }
    this.emitStatus("closed");
  }

  /** Replaces the active subscription. Sent immediately if open; otherwise
   *  applied on the next successful (re)connection. Resubscribe is a replace,
   *  not a merge — matches the wire-format contract. */
  subscribe(regions: RegionId[]): void {
    this.currentRegions = [...regions];
    if (this.socket !== null && this.socket.readyState === WebSocket.OPEN) {
      this.sendSubscribe();
    }
  }

  private openSocket(): void {
    this.emitStatus(this.backoffMs === INITIAL_BACKOFF_MS ? "connecting" : "reconnecting");

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch (err) {
      console.warn("[ws] constructor threw; will retry", err);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.emitStatus("open");
      if (this.currentRegions.length > 0) this.sendSubscribe();
    });

    socket.addEventListener("message", (event) => {
      this.handleFrame(event.data);
    });

    socket.addEventListener("close", () => {
      this.socket = null;
      if (this.intentionallyClosed) return;
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // The browser fires `error` then `close` — let `close` drive the
      // reconnect path so we don't double-schedule. Just log here.
      console.warn("[ws] socket error event");
    });
  }

  private scheduleReconnect(): void {
    this.emitStatus("reconnecting");
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private sendSubscribe(): void {
    const message: ClientMessage = { type: "subscribe", regions: this.currentRegions };
    this.socket?.send(JSON.stringify(message));
  }

  private handleFrame(raw: unknown): void {
    if (typeof raw !== "string") {
      console.warn("[ws] non-text frame received; ignoring");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[ws] non-JSON frame received; ignoring");
      return;
    }

    if (!isServerMessage(parsed)) {
      console.warn("[ws] unknown message shape; ignoring", parsed);
      return;
    }

    switch (parsed.type) {
      case "snapshot":
        this.handlers.onSnapshot?.(parsed);
        return;
      case "position":
        this.handlers.onPosition?.(parsed);
        return;
      case "error":
        console.warn(`[ws] server error: ${parsed.code} — ${parsed.message}`);
        this.handlers.onError?.(parsed);
        return;
    }
  }

  private emitStatus(status: ConnectionStatus): void {
    this.handlers.onStatus?.(status);
  }
}

function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown };
  return (
    candidate.type === "snapshot" || candidate.type === "position" || candidate.type === "error"
  );
}
