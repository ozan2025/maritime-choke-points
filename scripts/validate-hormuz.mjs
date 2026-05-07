#!/usr/bin/env node
// Hormuz-only 5-minute validation spike. Throwaway.
// Run: AISSTREAM_KEY=your_key node validate-hormuz.mjs

const KEY = process.env.AISSTREAM_KEY;
if (!KEY) {
  console.error("Missing AISSTREAM_KEY");
  process.exit(1);
}

// WIDENED to entire Persian Gulf + Strait of Hormuz + Gulf of Oman
// to determine whether AISStream has *any* coverage in this region.
const HORMUZ = { sw: [22.0, 50.0], ne: [28.0, 60.0] };
const RUN_MS = 120_000;
const START = Date.now();

const stats = { positions: 0, vessels: new Set(), staticReports: 0 };
const decoder = new TextDecoder();

const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
ws.binaryType = "arraybuffer";

ws.addEventListener("open", () => {
  console.log("[ok] Connected. Subscribing to Hormuz only. Listening 5 minutes...\n");
  ws.send(
    JSON.stringify({
      APIKey: KEY,
      BoundingBoxes: [[HORMUZ.sw, HORMUZ.ne]],
    })
  );
});

ws.addEventListener("message", (event) => {
  let text;
  if (typeof event.data === "string") text = event.data;
  else if (event.data instanceof ArrayBuffer) text = decoder.decode(event.data);
  else return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (msg.error) {
    console.error("[err]", msg.error);
    return;
  }
  if (msg.MessageType === "PositionReport") {
    const meta = msg.MetaData || {};
    stats.positions++;
    if (meta.MMSI) stats.vessels.add(meta.MMSI);
    if (stats.positions <= 8) {
      const name = (meta.ShipName || "").trim() || "(no name)";
      console.log(
        `[pos ${stats.positions}] MMSI ${meta.MMSI}  "${name}"  @ ${meta.latitude?.toFixed(3)}, ${meta.longitude?.toFixed(3)}`
      );
    }
  } else if (msg.MessageType === "ShipStaticData") {
    stats.staticReports++;
  }
});

ws.addEventListener("error", (e) => console.error("[err] WS:", e.message || e));
ws.addEventListener("close", (e) => console.log(`[info] WS closed: ${e.code}`));

const interim = setInterval(() => {
  const elapsed = ((Date.now() - START) / 1000).toFixed(0);
  console.log(
    `[${elapsed}s] positions: ${stats.positions}  unique vessels: ${stats.vessels.size}  static reports: ${stats.staticReports}`
  );
}, 30_000);

setTimeout(() => {
  clearInterval(interim);
  console.log("\n=== HORMUZ 5-MIN RESULT ===");
  console.log(`PositionReports:  ${stats.positions}`);
  console.log(`Unique vessels:   ${stats.vessels.size}`);
  console.log(`Static reports:   ${stats.staticReports}`);
  console.log(`Rate:             ${(stats.positions / 300).toFixed(2)} msg/sec`);
  if (stats.vessels.size > 0) {
    console.log("\n[PASS] Hormuz delivers data. Headline region validated.");
  } else {
    console.log("\n[FAIL] Zero Hormuz vessels in 5 minutes. Try widening bbox or check AISStream coverage in that region.");
  }
  ws.close();
  process.exit(0);
}, RUN_MS);
