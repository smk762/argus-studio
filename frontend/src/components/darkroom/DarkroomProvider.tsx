"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { curatorUiMode } from "@/lib/curatorEnv";
import { STATIC_DEMO } from "@/lib/staticDemo";
import {
  getDarkroomHealth,
  getModels,
  getPolicies,
  getRecord,
  getRecords,
  imageUrl,
  type GenerationRecord,
  type Health,
  type Models,
  type Policies,
  type RecordPage,
  type RecordQuery,
} from "@/lib/darkroomApi";

export interface Darkroom {
  health: Health | null;
  policies: Policies | null;
  models: Models | null;
  /** Null while the first `/health` is in flight; otherwise why darkroom cannot be reached. */
  error: string | null;
  loading: boolean;
  reload: () => void;
  /** True while the page shows the bundled sample: demo mode with no darkroom answering. */
  sample: boolean;
  records: (query: RecordQuery) => Promise<RecordPage>;
  record: (id: string) => Promise<GenerationRecord>;
  image: (id: string) => string;
}

type Sample = typeof import("@/lib/darkroom/sample");

const DarkroomContext = createContext<Darkroom | null>(null);

const HEALTH_POLL_MS = 30_000;

/** `/health`, `/policies` and `/models` once, then `/health` again on a timer so a backend coming or going is noticed. */
export function DarkroomProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [models, setModels] = useState<Models | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [tick, setTick] = useState(0);
  const [loadedTick, setLoadedTick] = useState(-1);
  const loading = loadedTick !== tick;

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The static demo has no darkroom to ask; go straight to the bundled sample.
        if (STATIC_DEMO) throw new Error("no darkroom in the static demo");
        const [nextHealth, nextPolicies, nextModels] = await Promise.all([getDarkroomHealth(), getPolicies(), getModels()]);
        if (cancelled) return;
        setHealth(nextHealth);
        setPolicies(nextPolicies);
        setModels(nextModels);
        setSample(null);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        if (curatorUiMode() === "demo") {
          const bundled = await import("@/lib/darkroom/sample");
          if (cancelled) return;
          setHealth(bundled.SAMPLE_HEALTH);
          setPolicies(bundled.SAMPLE_POLICIES);
          setModels(bundled.SAMPLE_MODELS);
          setSample(bundled);
          setError(null);
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setLoadedTick(tick);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const catalogued = policies != null && models != null;

  useEffect(() => {
    // The sample has no server to poll. Refresh looks for one again.
    if (sample) return;
    const timer = setInterval(async () => {
      try {
        const next = await getDarkroomHealth();
        setHealth(next);
        // Darkroom answers again, but the form still needs the catalogue the first load missed.
        if (catalogued) setError(null);
        else reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    }, HEALTH_POLL_MS);
    return () => clearInterval(timer);
  }, [sample, catalogued, reload]);

  const value = useMemo<Darkroom>(
    () => ({
      health,
      policies,
      models,
      error,
      loading,
      reload,
      sample: sample != null,
      records: (query) => (sample ? Promise.resolve(sample.sampleRecords(query)) : getRecords(query)),
      record: (id) => (sample ? Promise.resolve().then(() => sample.sampleRecord(id)) : getRecord(id)),
      image: (id) => (sample ? sample.sampleImageUrl(id) : imageUrl(id)),
    }),
    [health, policies, models, error, loading, reload, sample],
  );
  return <DarkroomContext.Provider value={value}>{children}</DarkroomContext.Provider>;
}

export function useDarkroom(): Darkroom {
  const value = useContext(DarkroomContext);
  if (!value) throw new Error("useDarkroom needs a DarkroomProvider");
  return value;
}
