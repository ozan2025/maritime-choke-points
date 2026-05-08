import { REGIONS, type RegionId, type VesselPositionEvent } from "@maritime/shared";
import { WebSocket } from "ws";
import type { VesselSource, VesselUpdateHandler } from "./source.js";

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/** AISStream regions this source subscribes to. Hormuz validated as 0
 *  messages on the free firehose (PRD §2) — kept so the M2-#11 inset
 *  counter has a feed if/when traffic resumes. */
const SUBSCRIBED_REGIONS: readonly RegionId[] = ["malaccaSingapore", "hormuzApproaches"];

/** Minimal shape of an AISStream subscription frame (sent on open). */
interface SubscriptionFrame {
  APIKey: string;
  /** `[[[lat_sw, lon_sw], [lat_ne, lon_ne]], ...]` per AISStream's
   *  latitude-first convention (PRD §8). */
  BoundingBoxes: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]>;
}

/** Subset of AISStream's PositionReport envelope we read. AISStream
 *  documents far more fields; everything we don't read is intentionally
 *  ignored. */
interface AisPositionReport {
  MessageType: "PositionReport";
  MetaData?: {
    MMSI?: number;
    latitude?: number;
    longitude?: number;
  };
  Message?: {
    PositionReport?: {
      Sog?: number;
      Cog?: number;
      TrueHeading?: number;
      NavigationalStatus?: number;
    };
  };
}

interface AisShipStaticData {
  MessageType: "ShipStaticData";
  MetaData?: { MMSI?: number };
  Message?: {
    ShipStaticData?: {
      Type?: number;
    };
  };
}

export interface AisStreamSourceOptions {
  apiKey: string;
  /** Override for tests. */
  url?: string;
  /** Override for tests. */
  regions?: readonly RegionId[];
}

/**
 * Live AIS upstream. Connects to AISStream's free WebSocket firehose,
 * subscribes to the configured bboxes, and emits a `VesselPositionEvent`
 * for every PositionReport that lands inside one of those bboxes.
 *
 * Mirrors the reconnect-with-backoff shape of `apps/web/lib/ws-client.ts`:
 * 1 s → 30 s cap, reset on clean re-open, an `intentionallyClosed` flag
 * suppresses auto-reconnect during shutdown.
 */
export class AisStreamSource implements VesselSource {
  private readonly apiKey: string;
  private readonly url: string;
  private readonly regions: readonly RegionId[];
  /** Latest known position per MMSI. Backs `snapshot()`. Bounded in
   *  practice by activity in the subscribed bboxes; M3 #8's Postgres
   *  write replaces this in-memory tier as the source of truth. */
  private readonly latest = new Map<number, VesselPositionEvent>();
  /** AIS ship-type (ITU-R M.1371) keyed by MMSI, populated from
   *  ShipStaticData broadcasts (~6 min cadence). Used to enrich
   *  PositionReport events. M3 #8 will persist this. */
  private readonly shipTypeByMmsi = new Map<number, number>();

  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private intentionallyClosed = false;
  private onUpdate: VesselUpdateHandler | null = null;

  constructor(options: AisStreamSourceOptions) {
    this.apiKey = options.apiKey;
    this.url = options.url ?? AISSTREAM_URL;
    this.regions = options.regions ?? SUBSCRIBED_REGIONS;
  }

  start(onUpdate: VesselUpdateHandler): void {
    if (this.onUpdate) return;
    this.onUpdate = onUpdate;
    this.intentionallyClosed = false;
    this.openSocket();
  }

  stop(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket !== null) {
      this.socket.close(1000, "worker shutting down");
      this.socket = null;
    }
    this.onUpdate = null;
  }

  snapshot(regions: readonly RegionId[]): VesselPositionEvent[] {
    const wanted = new Set(regions);
    const out: VesselPositionEvent[] = [];
    for (const event of this.latest.values()) {
      if (wanted.has(event.region)) out.push(event);
    }
    return out;
  }

  private openSocket(): void {
    if (this.backoffMs === INITIAL_BACKOFF_MS) {
      console.log(`[ais] connecting to ${this.url}`);
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch (err) {
      console.warn("[ais] constructor threw; will retry", err);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.on("open", () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      const frame = this.buildSubscriptionFrame();
      socket.send(JSON.stringify(frame));
      console.log(`[ais] open; subscribed to [${this.regions.join(", ")}]`);
    });

    socket.on("message", (data) => {
      this.handleFrame(data);
    });

    socket.on("close", (code, reason) => {
      this.socket = null;
      if (this.intentionallyClosed) return;
      const reasonText = reason.length > 0 ? reason.toString() : "no reason";
      console.warn(`[ais] closed unexpectedly (code=${code}, ${reasonText})`);
      this.scheduleReconnect();
    });

    socket.on("error", (err) => {
      // The `ws` package fires `error` then `close` — let `close` drive
      // the reconnect path so we don't double-schedule. Just log here.
      console.warn(`[ais] socket error: ${err.message}`);
    });
  }

  private scheduleReconnect(): void {
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    console.warn(`[ais] reconnecting in ${delay} ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private buildSubscriptionFrame(): SubscriptionFrame {
    return {
      APIKey: this.apiKey,
      BoundingBoxes: this.regions.map((id) => {
        const { sw, ne } = REGIONS[id];
        return [sw, ne] as const;
      }),
    };
  }

  private handleFrame(data: unknown): void {
    const text = frameToString(data);
    if (text === null) {
      console.warn("[ais] non-decodable frame; ignoring");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn("[ais] non-JSON frame; ignoring");
      return;
    }

    if (typeof parsed !== "object" || parsed === null) return;
    const candidate = parsed as { error?: unknown; MessageType?: unknown };

    if (typeof candidate.error === "string") {
      console.warn(`[ais] server error: ${candidate.error}`);
      return;
    }

    if (candidate.MessageType === "PositionReport") {
      this.handlePositionReport(parsed as AisPositionReport);
      return;
    }

    if (candidate.MessageType === "ShipStaticData") {
      this.handleShipStaticData(parsed as AisShipStaticData);
      return;
    }

    // Other message types (e.g. AddressedSafetyMessage) are ignored on
    // purpose. We don't filter on the wire because that would cost us
    // ShipStaticData broadcasts.
  }

  private handlePositionReport(msg: AisPositionReport): void {
    const meta = msg.MetaData;
    const report = msg.Message?.PositionReport;
    if (!meta || !report) return;

    const mmsi = meta.MMSI;
    const lat = meta.latitude;
    const lon = meta.longitude;
    if (
      typeof mmsi !== "number" ||
      !Number.isFinite(mmsi) ||
      typeof lat !== "number" ||
      !Number.isFinite(lat) ||
      typeof lon !== "number" ||
      !Number.isFinite(lon)
    ) {
      return;
    }

    const region = this.regionForPosition(lat, lon);
    if (region === null) return;

    // Fall back to the AIS "unknown" sentinels (Sog 102.3 kn, Cog 360°)
    // when the upstream omits the field. This collapses "AIS sent
    // sentinel" and "AISStream omitted the field" into the same wire
    // value so downstream renderers can detect "unknown" with a single
    // check, and matches the locked pass-through policy.
    const sog = numberOr(report.Sog, 102.3);
    const cog = numberOr(report.Cog, 360);
    const event: VesselPositionEvent = {
      mmsi,
      lat,
      lon,
      sog,
      cog,
      region,
      observedAt: new Date().toISOString(),
    };

    if (typeof report.TrueHeading === "number" && Number.isFinite(report.TrueHeading)) {
      event.trueHeading = report.TrueHeading;
    }
    if (
      typeof report.NavigationalStatus === "number" &&
      Number.isFinite(report.NavigationalStatus)
    ) {
      event.navigationalStatus = report.NavigationalStatus;
    }
    const cachedShipType = this.shipTypeByMmsi.get(mmsi);
    if (cachedShipType !== undefined) event.shipType = cachedShipType;

    this.latest.set(mmsi, event);
    this.onUpdate?.(event);
  }

  private handleShipStaticData(msg: AisShipStaticData): void {
    const mmsi = msg.MetaData?.MMSI;
    const shipType = msg.Message?.ShipStaticData?.Type;
    if (
      typeof mmsi !== "number" ||
      !Number.isFinite(mmsi) ||
      typeof shipType !== "number" ||
      !Number.isFinite(shipType)
    ) {
      return;
    }
    this.shipTypeByMmsi.set(mmsi, shipType);
  }

  private regionForPosition(lat: number, lon: number): RegionId | null {
    for (const id of this.regions) {
      const { sw, ne } = REGIONS[id];
      if (lat >= sw[0] && lat <= ne[0] && lon >= sw[1] && lon <= ne[1]) return id;
    }
    return null;
  }
}

/** `ws` delivers `Buffer` by default (binaryType "nodebuffer"); also
 *  handle `Buffer[]`, `ArrayBuffer`, and string for safety. */
function frameToString(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  if (Array.isArray(data) && data.every((b) => Buffer.isBuffer(b))) {
    return Buffer.concat(data as Buffer[]).toString("utf-8");
  }
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
  return null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
