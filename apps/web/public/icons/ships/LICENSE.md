# Ship-type silhouette atlas

The seven PNGs in this directory (`tanker.png`, `cargo.png`, `bulker.png`,
`lng.png`, `passenger.png`, `fishing.png`, `other.png`) are project-original
generated artwork. They are released into the public domain (CC0).

Source generator: `scripts/generate-ship-icons.mjs`. Run on demand:

```
node scripts/generate-ship-icons.mjs
```

Each silhouette is a 64×64 white-on-transparent mask. deck.gl's
`IconLayer` consumes these with `mask: true` and tints them per-vessel
via `getColor`.
