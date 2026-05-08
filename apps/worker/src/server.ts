import {
  isRegionId,
  type RegionId,
  type ServerMessage,
  type VesselPositionEvent,
} from "@maritime/shared";
import { WebSocketServer, type WebSocket } from "ws";
import type { VesselSource } from "./sources/source.js";
import type { PostgresWriter } from "./writer/postgres.js";

interface ClientState {
  id: number;
  socket: WebSocket;
  subscriptions: Set<RegionId>;
}

export interface VesselServerOptions {
  port: number;
  source: VesselSource;
  /** Optional persistence sink. When provided, every position event also
   *  goes to `vessel_positions_recent` and every static update upserts into
   *  `vessels`. Wire fan-out is unchanged either way. */
  writer?: PostgresWriter;
}

export class VesselServer {
  private readonly wss: WebSocketServer;
  private readonly source: VesselSource;
  private readonly writer: PostgresWriter | undefined;
  private readonly clients = new Map<number, ClientState>();
  private nextClientId = 1;

  constructor(options: VesselServerOptions) {
    this.source = options.source;
    this.writer = options.writer;
    this.wss = new WebSocketServer({ port: options.port });
  }

  start(): void {
    this.wss.on("connection", (socket) => this.handleConnection(socket));
    const writer = this.writer;
    this.source.start({
      onPosition: (event) => {
        writer?.recordPosition(event);
        this.broadcast(event);
      },
      onStatic: writer ? (update) => writer.upsertVessel(update) : undefined,
    });
    const address = this.wss.address();
    const port = typeof address === "object" && address ? address.port : "?";
    console.log(`[worker] ws server listening on ws://localhost:${port}`);
  }

  async stop(): Promise<void> {
    this.source.stop();
    for (const client of this.clients.values()) {
      client.socket.close(1001, "server shutting down");
    }
    this.clients.clear();
    await new Promise<void>((resolve, reject) => {
      this.wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private handleConnection(socket: WebSocket): void {
    const id = this.nextClientId++;
    const state: ClientState = { id, socket, subscriptions: new Set() };
    this.clients.set(id, state);
    console.log(`[worker] client ${id} connected (total=${this.clients.size})`);

    socket.on("message", (raw) => this.handleMessage(state, raw.toString()));
    socket.on("close", () => {
      this.clients.delete(id);
      console.log(`[worker] client ${id} disconnected (total=${this.clients.size})`);
    });
    socket.on("error", (err) => {
      console.warn(`[worker] client ${id} error: ${err.message}`);
    });
  }

  private handleMessage(client: ClientState, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`[worker] client ${client.id} sent non-JSON frame; ignoring`);
      this.send(client.socket, {
        type: "error",
        code: "invalid_json",
        message: "Frame was not valid JSON.",
      });
      return;
    }

    if (!isClientMessageEnvelope(parsed)) {
      console.warn(`[worker] client ${client.id} sent unknown frame; ignoring`);
      this.send(client.socket, {
        type: "error",
        code: "unknown_message_type",
        message: "Frame did not match any known ClientMessage shape.",
      });
      return;
    }

    if (parsed.type === "subscribe") {
      const regions = parsed.regions.filter(isRegionId);
      client.subscriptions = new Set(regions);
      console.log(
        `[worker] client ${client.id} subscribed to [${[...client.subscriptions].join(", ")}]`,
      );
      const subscribed = [...client.subscriptions];
      const snapshot = this.source.snapshot(subscribed);
      this.send(client.socket, { type: "snapshot", regions: subscribed, vessels: snapshot });
    }
  }

  private broadcast(event: VesselPositionEvent): void {
    const message: ServerMessage = { type: "position", event };
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(event.region)) {
        this.send(client.socket, message);
      }
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(message));
  }
}

function isClientMessageEnvelope(
  value: unknown,
): value is { type: "subscribe"; regions: string[] } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown; regions?: unknown };
  if (candidate.type !== "subscribe") return false;
  return Array.isArray(candidate.regions) && candidate.regions.every((r) => typeof r === "string");
}
