/**
 * Which caption run owns the page's shared run state. /caption keeps one
 * `loading`, `progress` and result for every input mode, so a run that settles
 * after a newer one started, or after the user moved to another tab, must not
 * touch what is on screen.
 */

export interface CaptionRun<M extends string> {
  /** The run's result, error or progress belongs on screen: it is the newest run and `mode` is still its tab. */
  shows(mode: M): boolean;
  /** Reset the shared run state, unless a newer run owns it by now. A run whose tab was left still resets it. */
  finish(reset: () => void): void;
}

export class CaptionRuns<M extends string> {
  private newest = 0;

  /** Start a run in `mode`; it takes over the shared state from any earlier run. */
  begin(mode: M): CaptionRun<M> {
    const id = ++this.newest;
    return {
      shows: (now) => id === this.newest && now === mode,
      finish: (reset) => {
        if (id === this.newest) reset();
      },
    };
  }
}
