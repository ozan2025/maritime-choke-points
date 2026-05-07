#!/usr/bin/env node
// AISStream free-tier validation spike. Zero deps. Node 22+ (built-in WebSocket).
// Run: AISSTREAM_KEY=your_key node validate-aisstream.mjs
// Throwaway file — delete after we confirm the architecture holds.

const KEY = process.env.AISSTREAM_KEY;
if (!KEY) {
  console.error("Missing AISSTREAM_KEY env var.");
  console.error("Run: AISSTREAM_KEY=your_key node validate-aisstream.mjs");
  process.exit(1);
}

const CHOKE_POINTS = {
  hormuz:      { sw: [26.0, 55.5], ne: [27.0, 57.5] },
  babElMandeb: { sw: [12.3, 43.0], ne: [13.5, 44.0] },
  malacca:     { sw: [1.0, 102.5], ne: [4.0, 105.0] },
  suez:        { sw: [29.5, 32.3], ne: [31.5, 32.7] },
};

const stats = Object.fromEntries(
  Object.keys(CHOKE_POINTS).map((k) => [k, { messages: 0, vessels: new Set() }])
);
const messageTypes = new Map();
let rawSamplesPrinted = 0;
const RAW_SAMPLE_LIMIT = 3;
let totalReceived = 0;

function findRegion(lat, lon) {
  for (const [name, { sw, ne }] of Object.entries(CHOKE_POINTS)) {
    if (lat >= sw[0] && lat <= ne[0] && lon >= sw[1] && lon <= ne[1]) return name;
  }
  return null;
}

const RUN_MS = 60_000;
const START = Date.now();

const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
ws.binaryType = "arraybuffer";
const decoder = new TextDecoder();

ws.addEventListener("open", () => {
  console.log("[ok] Connected to wss://stream.aisstream.io");
  // Diagnostic mode: drop FilterMessageTypes to receive ALL message types
  ws.send(
    JSON.stringify({
      APIKey: KEY,
      BoundingBoxes: Object.values(CHOKE_POINTS).map(({ sw, ne }) => [sw, ne]),
    })
  );
  console.log("[ok] Subscribed to 4 choke points (no filter). Listening for 60s...\n");
});

ws.addEventListener("message", (event) => {
  totalReceived++;
  let text;
  if (typeof event.data === "string") text = event.data;
  else if (event.data instanceof ArrayBuffer) text = decoder.decode(event.data);
  else return;
  if (rawSamplesPrinted < RAW_SAMPLE_LIMIT) {
    console.log(`[sample ${rawSamplesPrinted + 1}]`, text.slice(0, 400));
    rawSamplesPrinted++;
  }
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (msg.error) {
    console.error("[err] Server error:", msg.error);
    return;
  }
  if (msg.MessageType) {
    messageTypes.set(msg.MessageType, (messageTypes.get(msg.MessageType) || 0) + 1);
  }
  if (msg.MessageType !== "PositionReport") return;
  const meta = msg.MetaData || {};
  const lat = meta.latitude;
  const lon = meta.longitude;
  if (lat == null || lon == null) return;
  const region = findRegion(lat, lon);
  if (!region) return;
  stats[region].messages++;
  if (meta.MMSI) stats[region].vessels.add(meta.MMSI);
});

ws.addEventListener("error", (e) => console.error("[err] WS error:", e.message || e));
ws.addEventListener("close", (e) =>
  console.log(`[info] WS closed: code=${e.code} ${e.reason || ""}`)
);

const interim = setInterval(() => {
  const elapsed = ((Date.now() - START) / 1000).toFixed(0);
  console.log(`--- ${elapsed}s ---`);
  for (const [name, s] of Object.entries(stats)) {
    console.log(
      `  ${name.padEnd(12)}  msgs: ${String(s.messages).padStart(5)}  unique vessels: ${s.vessels.size}`
    );
  }
}, 30_000);

setTimeout(() => {
  clearInterval(interim);
  console.log("\n=== RESULT ===");
  console.log(`Total messages received (any type): ${totalReceived}`);
  if (messageTypes.size > 0) {
    console.log("Message type histogram:");
    for (const [type, count] of [...messageTypes.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type.padEnd(32)} ${count}`);
    }
  }
  console.log("\nPositionReports per choke point:");
  let totalPos = 0;
  for (const [name, s] of Object.entries(stats)) {
    const rate = (s.messages / 60).toFixed(2);
    console.log(
      `  ${name.padEnd(12)}  ${s.messages} msgs (${rate}/sec)  ${s.vessels.size} unique vessels`
    );
    totalPos += s.messages;
  }
  if (totalReceived === 0) {
    console.log("\n[FAIL] No messages of any type received. Likely causes: invalid key, key not yet activated, or free tier doesn't deliver. Wait 2-3 min and retry, or check key on aisstream.io.");
  } else if (totalPos === 0) {
    console.log(`\n[PARTIAL] Received ${totalReceived} messages but none were PositionReports inside our bboxes. Check raw samples above.`);
  } else {
    console.log("\n[PASS] AISStream free tier delivers real data. Architecture validated.");
  }
  ws.close();
  process.exit(0);
}, RUN_MS);
