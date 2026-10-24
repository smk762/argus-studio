/**
 * Server capabilities: what a backend will actually accept, as opposed to what
 * this deployment's own config suggests it might (argus-studio#66).
 *
 * Each suite service advertises its write posture on `GET /health`, so a client
 * can disable an affordance up front instead of discovering a 403 after the user
 * has committed to an action:
 *
 *   argus-curator  `allow_move`  destructive move-mode exports
 *   argus-forge    `training`    live `POST /run` (demo-safe server posture)
 *   argus-proof    `read_only`   live evaluation + report writes
 *
 * These are deployment facts, not UI modes. `ARGUS_CURATOR_UI_MODE` says whether
 * the *curator SPA* renders a bundled sample; it says nothing about whether
 * argus-proof will run an evaluation, and on the public demo host the two come
 * apart — the curator is live while proof and forge are deliberately read-only.
 */

/**
 * Tri-state, because "not yet known" is a distinct case that must not read as
 * permission: `true` permitted, `false` refused by the server, `null` still
 * loading **or** `/health` failed.
 */
export type Capability = boolean | null;

/**
 * Whether to enable a control. Fails **safe**: only a positive `true` enables,
 * so a slow or unreachable `/health` leaves the control inert rather than armed
 * and surfacing a raw error once the user acts.
 */
export function permits(capability: Capability): boolean {
  return capability === true;
}

/**
 * Read a capability from a health payload that may predate the field.
 *
 * `health` is nullish while loading or when the fetch failed -> `null`. An older
 * server that omits the field falls back to `legacy`, which should be whatever
 * that server's behaviour was before it could advertise: permissive for
 * capabilities that were always allowed, restrictive for ones that were not.
 *
 * `read` must yield an actual boolean to be believed. `resp.json()` is unvalidated
 * `any`, so a field the server encodes as JSON `null` (an unresolved config value)
 * would otherwise sail past a `?? legacy` — `null ?? true` is `true` — and arm a
 * destructive control on a server that never said yes. Anything that is not a
 * boolean is treated as "did not advertise" and falls back to `legacy`.
 */
export function capabilityOf<T>(
  health: T | null | undefined,
  read: (health: T) => unknown,
  legacy: boolean,
): Capability {
  if (health == null) return null;
  const value = read(health);
  return typeof value === "boolean" ? value : legacy;
}

/**
 * A write the client refused to send because the server's capability says it
 * would be refused anyway (argus-studio#75). An ordinary `Error`, so a caller's
 * existing error path renders `message` without special-casing; `denied` tells
 * a settled refusal apart from a server whose posture could not be confirmed.
 */
export class CapabilityRefused extends Error {
  readonly denied: boolean;

  constructor(message: string, denied: boolean) {
    super(message);
    this.name = "CapabilityRefused";
    this.denied = denied;
  }
}

/**
 * The last `/health` a client saw, kept so its write fetchers can gate
 * themselves. `remember` is called by the client's own `get*Health`, so the
 * pages' existing probes keep it fresh; `current` fetches one on demand when a
 * write comes first, so a caller that never probed is still gated rather than
 * waved through.
 */
export interface HealthMemo<H> {
  remember(health: H): H;
  current(signal?: AbortSignal): Promise<H | null>;
}

export function healthMemo<H>(fetchHealth: (signal?: AbortSignal) => Promise<H>): HealthMemo<H> {
  let last: H | null = null;
  return {
    remember(health) {
      last = health;
      return health;
    },
    async current(signal) {
      if (last !== null) return last;
      try {
        return (last = await fetchHealth(signal));
      } catch (err) {
        // An abort is the caller cancelling, not an unreachable server.
        if (signal?.aborted) throw err;
        return null;
      }
    },
  };
}

/**
 * Throw {@link CapabilityRefused} unless the server permits this write. The
 * gate every write fetcher runs before its request, so coverage comes from the
 * client layer rather than from each component remembering a `permits()`.
 * Fails safe like {@link permits}: an unreachable `/health` refuses.
 */
export async function requireCapability<H>(
  memo: HealthMemo<H>,
  read: (health: H | null) => Capability,
  denied: string,
  signal?: AbortSignal,
): Promise<void> {
  const capability = read(await memo.current(signal));
  if (permits(capability)) return;
  throw new CapabilityRefused(
    capability === false ? denied : "Couldn't confirm this server allows that (its /health is unreachable).",
    capability === false,
  );
}

/**
 * Why a control is inert, or `null` when it is live and needs no explanation.
 * Keeping the two negative cases distinct matters: "the server refuses this" is
 * a settled answer a visitor should stop waiting on, while "we can't reach the
 * server" might resolve on its own.
 */
export function capabilityReason(
  capability: Capability,
  denied: string,
  unknown = "Checking what this server allows…",
): string | null {
  if (capability === true) return null;
  return capability === false ? denied : unknown;
}
