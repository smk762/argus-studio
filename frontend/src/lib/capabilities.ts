/**
 * Server capabilities: what a backend will actually accept, as opposed to what
 * this deployment's own config suggests it might (argus-studio#66).
 *
 * Each suite service advertises its write posture on `GET /health`, so a client
 * can disable an affordance up front instead of discovering a 403 after the user
 * has committed to an action:
 *
 *   argus-curator  `allow_move`  destructive move-mode exports
 *   argus-forge    `training`    live `POST /run` (needs a GPU)
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
 * `health` is `null` while loading or when the fetch failed -> `null`. An older
 * server that omits the field falls back to `legacy`, which should be whatever
 * that server's behaviour was before it could advertise: permissive for
 * capabilities that were always allowed, restrictive for ones that were not.
 */
export function capabilityOf<T>(
  health: T | null,
  read: (health: T) => boolean | undefined,
  legacy: boolean,
): Capability {
  if (health === null) return null;
  return read(health) ?? legacy;
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
