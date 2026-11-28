/**
 * Run ownership for the caption page's runs (URL, upload, folder, manifest,
 * Immich). They share one `loading` flag and one progress bar, and the user can
 * switch tabs and start another run while one is still in flight, so a run
 * that settles late must neither show its outcome in another tab nor clear the
 * state a newer run now owns.
 */

/** The page's run counter: a `useRef(0)`, bumped by each run that starts. */
export interface RunCounter {
  current: number;
}

export interface RunHandle {
  /**
   * True once a newer run has started or the user has left the tab this run
   * started in: its result and error must not land.
   */
  stale: () => boolean;
  /**
   * Reset the state every run shares (loading, progress), unless a newer run
   * has started and owns it now. Leaving the tab alone does not stop the reset:
   * the run is over, so nothing is loading any more.
   */
  settle: (reset: () => void) => void;
}

/** Start a run in tab `runMode`; `mode` reads the tab on screen when asked. */
export function startRun<M>(counter: RunCounter, mode: () => M, runMode: M): RunHandle {
  const run = ++counter.current;
  const newest = () => run === counter.current;
  return {
    stale: () => !newest() || mode() !== runMode,
    settle: (reset) => {
      if (newest()) reset();
    },
  };
}
