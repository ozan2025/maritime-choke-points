"use client";

import { useDeferredValue, useEffect, useState } from "react";

import type { VesselSearchResult } from "@/lib/queries/vessel-search";

export type SearchStatus = "idle" | "loading" | "ok" | "error";

interface SearchResponseBody {
  results: VesselSearchResult[];
}

export interface UseVesselSearch {
  q: string;
  setQ: (next: string) => void;
  results: VesselSearchResult[];
  status: SearchStatus;
}

interface AsyncState {
  /** The trimmed query this snapshot was computed for. */
  q: string;
  results: VesselSearchResult[];
  /** Final state for that query — `ok` | `error` | (initial) `idle`. */
  status: "idle" | "ok" | "error";
}

/**
 * Powers the ⌘K palette. `useDeferredValue` is the React 19-native
 * debounce — typing stays responsive (the input shows the latest `q`
 * synchronously) while the deferred value lags behind a frame and gates
 * the network fetch. Cleaner than a `setTimeout` debouncer, and the
 * visible-vs-fetched skew gives the spinner row a natural cadence.
 *
 * `AbortController` cancels each in-flight fetch when the deferred
 * query changes — eliminates the late-response-overwrites-current race.
 *
 * Status is *derived* from comparing the deferred query against the
 * `q` field of the latest async snapshot: while a new deferred value
 * is pending its fetch result, the snapshot still belongs to the prior
 * query → `loading`. Avoids the `react-hooks/set-state-in-effect` rule
 * trip that an in-effect `setStatus("loading")` would cause.
 */
export function useVesselSearch(): UseVesselSearch {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const trimmed = deferredQ.trim();

  const [snapshot, setSnapshot] = useState<AsyncState>({ q: "", results: [], status: "idle" });

  useEffect(() => {
    if (trimmed.length === 0) return;

    const ctl = new AbortController();
    fetch(`/api/vessels/search?q=${encodeURIComponent(trimmed)}`, { signal: ctl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`search ${res.status}`);
        return (await res.json()) as SearchResponseBody;
      })
      .then((body) => {
        setSnapshot({ q: trimmed, results: body.results, status: "ok" });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSnapshot({ q: trimmed, results: [], status: "error" });
      });

    return () => ctl.abort();
  }, [trimmed]);

  let status: SearchStatus;
  let results: VesselSearchResult[];
  if (trimmed.length === 0) {
    status = "idle";
    results = [];
  } else if (snapshot.q === trimmed) {
    status = snapshot.status === "idle" ? "loading" : snapshot.status;
    results = snapshot.results;
  } else {
    status = "loading";
    results = [];
  }

  return { q, setQ, results, status };
}
