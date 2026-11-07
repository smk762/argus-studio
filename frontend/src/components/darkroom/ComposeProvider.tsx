"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";

import { generate, preflight as runPreflight, type Preflight } from "@/lib/darkroomApi";
import { canExpand, defaultCompose, normaliseCompose, toRequest, type ComposeState } from "@/lib/darkroom/compose";
import { IDLE, isRunning, liveReducer, type LiveState } from "@/lib/darkroom/live";

import { useDarkroom } from "./DarkroomProvider";

export interface PreflightStatus {
  state: "idle" | "checking" | "done" | "error";
  result: Preflight | null;
  error: string | null;
  /** The request the result answers, to tell a stale verdict from a current one. */
  forRequest: string | null;
}

export interface Compose {
  compose: ComposeState;
  /** False until the server's catalogue has set the defaults. */
  ready: boolean;
  update: (patch: Partial<ComposeState> | ((current: ComposeState) => ComposeState)) => void;
  replace: (next: ComposeState) => void;
  preflight: PreflightStatus;
  /** `POST /preflight` for the form as it stands. */
  check: () => Promise<Preflight | null>;
  /** Whether the shown verdict still matches the form. */
  preflightCurrent: boolean;
  /** The generation in flight, or the last one. */
  live: LiveState;
  running: boolean;
  /** `POST /generate/stream` for the form as it stands. Pre-flight runs on the server first, regardless. */
  start: () => void;
  /** Close the stream. Darkroom finishes on its own; the record still lands in history. */
  stop: () => void;
  clearLive: () => void;
  /** Which pane shows. A record, when one is open, sits over it. */
  view: DarkroomView;
  setView: (view: DarkroomView) => void;
  recordId: string | null;
  openRecord: (id: string) => void;
  closeRecord: () => void;
}

export type DarkroomView = "generate" | "history";

const ComposeContext = createContext<Compose | null>(null);

export function ComposeProvider({ children }: { children: ReactNode }) {
  const { health, policies, models } = useDarkroom();
  const [compose, setCompose] = useState<ComposeState>(() => defaultCompose(null, null, null));
  const [ready, setReady] = useState(false);
  const [preflight, setPreflight] = useState<PreflightStatus>({ state: "idle", result: null, error: null, forRequest: null });
  const [live, dispatch] = useReducer(liveReducer, IDLE);
  const [view, setView] = useState<DarkroomView>("generate");
  const [recordId, setRecordId] = useState<string | null>(null);
  const touched = useRef(false);
  const controller = useRef<AbortController | null>(null);

  // Server defaults the first time the catalogue arrives; afterwards only keep the form consistent with it.
  useEffect(() => {
    if (!policies || !models) return;
    setCompose((current) => {
      const base = touched.current ? current : defaultCompose(health, policies, models);
      return normaliseCompose(base, policies, models);
    });
    setReady(true);
  }, [health, policies, models]);

  const update = useCallback<Compose["update"]>((patch) => {
    touched.current = true;
    setCompose((current) => (typeof patch === "function" ? patch(current) : { ...current, ...patch }));
  }, []);

  // A record can name a model or a policy this server no longer offers.
  const replace = useCallback(
    (next: ComposeState) => {
      touched.current = true;
      setCompose(normaliseCompose(next, policies, models));
    },
    [policies, models],
  );

  const expandable = canExpand(health);

  const check = useCallback(async () => {
    const request = toRequest(compose, expandable);
    const key = JSON.stringify(request);
    setPreflight({ state: "checking", result: null, error: null, forRequest: key });
    try {
      const result = await runPreflight(request);
      setPreflight({ state: "done", result, error: null, forRequest: key });
      return result;
    } catch (caught) {
      setPreflight({ state: "error", result: null, error: caught instanceof Error ? caught.message : String(caught), forRequest: key });
      return null;
    }
  }, [compose, expandable]);

  const running = isRunning(live);

  const start = useCallback(() => {
    if (controller.current) return;
    const request = toRequest(compose, expandable);
    const abort = new AbortController();
    controller.current = abort;
    dispatch({ type: "start", request });
    setPreflight({ state: "idle", result: null, error: null, forRequest: null });
    setRecordId(null);
    setView("generate");
    generate(
      request,
      {
        onPreflight: (result) => {
          dispatch({ type: "preflight", preflight: result });
          setPreflight({ state: "done", result, error: null, forRequest: JSON.stringify(request) });
        },
        onQueued: () => dispatch({ type: "queued" }),
        onProgress: (progress) => dispatch({ type: "progress", progress }),
        onScan: (scan) => dispatch({ type: "scan", scan }),
      },
      abort.signal,
    )
      .then((record) => {
        dispatch({ type: "complete", record });
        setRecordId(record.id);
      })
      .catch((caught: unknown) => {
        if (abort.signal.aborted) dispatch({ type: "error", error: "Stopped. Darkroom finishes the generation on its own; its record will appear in the history." });
        else dispatch({ type: "error", error: caught instanceof Error ? caught.message : String(caught) });
      })
      .finally(() => {
        controller.current = null;
      });
  }, [compose, expandable]);

  const stop = useCallback(() => controller.current?.abort(), []);
  const clearLive = useCallback(() => {
    if (!controller.current) dispatch({ type: "reset" });
  }, []);

  const openRecord = useCallback((id: string) => setRecordId(id), []);
  const closeRecord = useCallback(() => setRecordId(null), []);

  const preflightCurrent = preflight.forRequest === JSON.stringify(toRequest(compose, expandable));

  const value = useMemo<Compose>(
    () => ({ compose, ready, update, replace, preflight, check, preflightCurrent, live, running, start, stop, clearLive, view, setView, recordId, openRecord, closeRecord }),
    [compose, ready, update, replace, preflight, check, preflightCurrent, live, running, start, stop, clearLive, view, recordId, openRecord, closeRecord],
  );
  return <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>;
}

export function useCompose(): Compose {
  const value = useContext(ComposeContext);
  if (!value) throw new Error("useCompose needs a ComposeProvider");
  return value;
}
