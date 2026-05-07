#!/usr/bin/env node
// Global AISStream sanity check (per expert advice).
// Subscribe to the entire planet, 30 seconds, bucket positions by region.
// Tells us whether AISStream's firehose has Persian Gulf coverage at all.

const KEY = process.env.AISSTREAM_KEY;
if (!KEY) {
  console.error("Missing AISSTREAM_KEY");
  process.exit(1);
}

const CHOKE_POINTS = {
  hormuz:      { sw: [26.0, 55.5], ne: [27.0, 57.5] },
  babElMandeb: { sw: [12.3, 43.0], ne: [13.5, 44.0] },
  malacca:     { sw: [1.0, 102.5], ne: [4.0, 105.0] },
  suez:        { sw: [29.5, 32.3], ne: [31.5, 32.7] },
};

const REGIONS = {
  persianGulf:    { sw: [22.0, 48.0], ne: [30.0, 60.0] },
  redSea:         { sw: [12.0, 32.0], ne: [30.0, 44.0] },
  arabianSea:     { sw: [10.0, 50.0], ne: [25.0, 75.0] },
  mediterranean:  { sw: [30.0, -5.0], ne: [46.0, 36.0] },
  southChinaSea:  { sw: [-5.0, 95.0], ne: [25.0, 125.0] },
  northAtlantic:  { sw: [25.0, -80.0], ne: [60.0, -10.0] },
};

const counts = { total: 0 };
for (const k of Object.keys(CHOKE_POINTS)) counts[`choke_${k}`] = 0;
for (const k of Object.keys(REGIONS)) counts[`region_${k}`] = 0;

const decoder = new TextDecoder();
const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
ws.binaryType = "arraybuffer";

ws.addEventListener("open", () => {
  console.log("[ok] Connected. Subscribing to GLOBAL [-90,-180] -> [90,180] for 30s...\n");
  ws.send(
    JSON.stringify({
      APIKey: KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
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
  counts.total++;
  if (msg.MessageType !== "PositionReport") return;
  const meta = msg.MetaData || {};
  const lat = meta.latitude;
  const lon = meta.longitude;
  if (lat == null || lon == null) return;
  const inBox = (b) => lat >= b.sw[0] && lat <= b.ne[0] && lon >= b.sw[1] && lon <= b.ne[1];
  for (const [name, b] of Object.entries(CHOKE_POINTS)) if (inBox(b)) counts[`choke_${name}`]++;
  for (const [name, b] of Object.entries(REGIONS)) if (inBox(b)) counts[`region_${name}`]++;
});

ws.addEventListener("error", (e) => console.error("[err]", e.message || e));
ws.addEventListener("close", (e) => console.log(`[info] WS closed: ${e.code}`));

setTimeout(() => {
  console.log("\n=== GLOBAL 30s SANITY CHECK ===");
  console.log(`Total messages received: ${counts.total}`);
  console.log("\nChoke point hits (PositionReport count in 30s):");
  for (const k of Object.keys(CHOKE_POINTS)) {
    console.log(`  ${k.padEnd(15)} ${counts[`choke_${k}`]}`);
  }
  console.log("\nWider region hits:");
  for (const k of Object.keys(REGIONS)) {
    console.log(`  ${k.padEnd(15)} ${counts[`region_${k}`]}`);
  }
  if (counts.total === 0) {
    console.log("\n[CRITICAL] Zero global messages. Connection or auth issue.");
  } else if (counts.region_persianGulf === 0 && counts.region_redSea === 0) {
    console.log("\n[FINDING] Global feed flowing, but ZERO Persian Gulf and Red Sea traffic. Coverage gap (or restriction) confirmed.");
  } else if (counts.choke_hormuz === 0 && counts.region_persianGulf > 0) {
    console.log("\n[FINDING] Persian Gulf traffic exists, but Hormuz bbox empty. Bbox needs widening.");
  } else if (counts.choke_hormuz > 0) {
    console.log("\n[OK] Hormuz traffic visible in global feed. Project lives.");
  }
  ws.close();
  process.exit(0);
}, 30_000);
