"use client";

import { REGION_IDS } from "@maritime/shared";
import { useEffect } from "react";

import { useVesselsStore } from "./vessels-store";
import { WsClient } from "./ws-client";

const WS_URL = process.env.NEXT_PUBLIC_WORKER_WS_URL;

/**
 * Mounting hook: opens the worker WebSocket, hydrates the Zustand store
 * from snapshot/position frames, and surfaces connection status. The store
 * itself does not import the WS client — wiring lives here so RSC render
 * paths stay clean and the dependency direction is one-way.
 */
export function useVesselsStream(): void {
  useEffect(() => {
    if (!WS_URL) {
      console.warn("[stream] NEXT_PUBLIC_WORKER_WS_URL is not set; stream disabled");
      return;
    }

    const { applySnapshot, applyPositionUpdate, setConnectionStatus } = useVesselsStore.getState();

    const client = new WsClient(WS_URL, {
      onSnapshot: (msg) => applySnapshot(msg.vessels),
      onPosition: (msg) => applyPositionUpdate(msg.event),
      onStatus: (status) => setConnectionStatus(status),
    });

    client.connect();
    // Subscribe to every region the worker collects. The HUD's
    // choke-points row reads counts for all six (M5 #38) and the worker
    // fan-out is `client.subscriptions.has(event.region)` — a narrower
    // browser subscription would zero out tiles that the worker is
    // actively populating in Postgres. The viewport-filter granularity
    // discussion (PRD §11 Q4) lives a level below this and is unaffected.
    client.subscribe([...REGION_IDS]);

    return () => {
      client.disconnect();
    };
  }, []);
}
