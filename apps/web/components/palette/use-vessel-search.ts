"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";

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

const EMPTY_SNAPSHOT: AsyncState = { q: "", results: [], status: "idle" };

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
 *
 * The "type abc → backspace fully → re-type abc" edge case is handled
 * by clearing the snapshot in the public `setQ` whenever the input
 * transitions to empty. setState inside an event handler is fine
 * (the lint rule only fires for setState in effect bodies), and clearing
 * results when the input clears is the right UX anyway.
 */
export function useVesselSearch(): UseVesselSearch {
  const [q, setQRaw] = useState("");
  const deferredQ = useDeferredValue(q);
  const trimmed = deferredQ.trim();

  const [snapshot, setSnapshot] = useState<AsyncState>(EMPTY_SNAPSHOT);

  const setQ = useCallback((next: string) => {
    setQRaw(next);
    // Invalidate the snapshot when the input goes empty so a same-string
    // re-type kicks off a fresh fetch instead of flashing prior results.
    if (next.trim().length === 0) {
      setSnapshot(EMPTY_SNAPSHOT);
    }
  }, []);

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
