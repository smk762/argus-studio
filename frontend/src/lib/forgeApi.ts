/**
 * Thin client for the argus-forge API (:8103) — the training bridge that
 * turns a curator export (images + manifest.jsonl + .txt sidecars) into
 * ready-to-run trainer configs. Shapes come from `@/lib/generated/forge`, built
 * from the pinned schema/forge-wire.schema.json in smk762/argus-forge. That
 * schema marks fields with defaults as optional, though forge always sends them,
 * so {@link Filled} names the ones this app reads without a check.
 */

import type { TargetProfile } from "@/components/curator/types";
import { forgeUrl } from "@/lib/curatorEnv";
import type * as Wire from "@/lib/generated/forge";
import type { Filled } from "@/lib/wire";
import { asError } from "@/lib/apiError";
import { capabilityOf, healthMemo, requireCapability, type Capability } from "@/lib/capabilities";

export type TrainerId = Wire.ForgeRequest["trainer"];

export const TRAINER_LABELS: Record<TrainerId, string> = {
  kohya: "kohya sd-scripts",
  onetrainer: "OneTrainer",
  diffusers: "diffusers",
};

export type ForgeTrainingParams = Wire.TrainingParams;

export type ForgeParamOverrides = Wire.ParamOverrides;

export type ForgeSizeHint = Wire.SizeHint;

export type ForgeDatasetInfo = Filled<
  Omit<Wire.DatasetInfo, "target_profile">,
  "manifest_rows" | "manifest_version" | "missing_from_disk"
> & { target_profile: TargetProfile };

/**
 * A trainer forge can emit for, as advertised by `GET /trainers` — the
 * authoritative list, so the UI stops hardcoding what the server supports.
 * `files` names what a config run writes; `entrypoint` is the runnable script
 * among them, or null when the trainer is driven by its own UI.
 */
export type TrainerInfo = Filled<Wire.TrainerInfo, "entrypoint">;

export async function listTrainers(signal?: AbortSignal): Promise<TrainerInfo[]> {
  const resp = await fetch(`${forgeUrl()}/trainers`, { signal });
  if (!resp.ok) return asError(resp);
  const body: unknown = await resp.json();
  // `resp.json()` is unvalidated: a proxy or an older build answering with an
  // object (or a bare string, whose `.length` also passes a naive check) would
  // otherwise reach `trainers.map` and throw during render. Keep only entries
  // shaped like a TrainerInfo, so the caller's `.files`/`.label` are real.
  if (!Array.isArray(body)) return [];
  return body.filter(
    (t): t is TrainerInfo =>
      typeof t === "object" && t !== null && typeof (t as TrainerInfo).id === "string",
  ).map((t) => ({
    ...t,
    label: typeof t.label === "string" && t.label ? t.label : t.id,
    files: Array.isArray(t.files) ? t.files : [],
    notes: typeof t.notes === "string" ? t.notes : "",
    entrypoint: typeof t.entrypoint === "string" ? t.entrypoint : null,
  }));
}

export type InspectRequest = Wire.InspectRequest;

/**
 * Inspect an export without generating anything (POST /inspect): image and
 * caption counts, manifest state, and the training params forge would suggest.
 * Read-only, so it is safe on a demo-safe host.
 */
export async function inspectExport(req: InspectRequest, signal?: AbortSignal): Promise<ForgeDatasetInfo> {
  const resp = await fetch(`${forgeUrl()}/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

export type ForgeRequest = Wire.ForgeRequest;

export type ForgeGeneratedFile = Filled<Wire.GeneratedFile, "path">;

export type ForgeResult = Filled<
  Omit<Wire.ForgeResult, "files" | "dataset">,
  "captions_collected" | "warnings"
> & { files: ForgeGeneratedFile[]; dataset: ForgeDatasetInfo };

export interface ForgeHealth {
  status: string;
  service: string;
  version: string;
  /** Absolute export root forge contains `export_dir` under, or null if unset. */
  export_root?: string | null;
  /**
   * `"disabled"` on a demo-safe host (argus-forge#16): `POST /config` still
   * renders configs, but live `POST /run` training returns 403. Lets a client
   * drop its train affordance up front rather than learn from the 403.
   */
  training?: "enabled" | "disabled";
}

async function fetchForgeHealth(signal?: AbortSignal): Promise<ForgeHealth> {
  const resp = await fetch(`${forgeUrl()}/health`, { signal });
  if (!resp.ok) return asError(resp);
  return resp.json();
}

/** The posture a writing {@link forgeConfig} gates on. */
const forgeHealth = healthMemo(fetchForgeHealth);

export async function getForgeHealth(signal?: AbortSignal): Promise<ForgeHealth> {
  return forgeHealth.remember(await fetchForgeHealth(signal));
}

/**
 * Whether this forge server will run training locally.
 *
 * Legacy `false`: unlike proof's read-only flag, a server omitting `training`
 * predates the run registry entirely, so there is nothing to enable — and
 * training is GPU work that fails slowly and expensively when wrongly offered.
 */
export function allowsTraining(health: ForgeHealth | null): Capability {
  // Only the two values forge actually advertises are believed; an absent field
  // (or a value a future forge adds) falls back to `legacy` rather than being
  // read as a settled refusal.
  return capabilityOf(
    health,
    (h) => (h.training === "enabled" ? true : h.training === "disabled" ? false : undefined),
    false,
  );
}

/**
 * Render trainer configs for an export dir (POST /config). Forge collects
 * caption sidecars from the manifest's source paths first, so running this
 * after the lens caption handoff picks the fresh captions up. `dry_run`
 * returns file contents without touching the filesystem.
 *
 * Only a writing call is gated: a demo-safe forge still renders previews, but
 * forces them to dry-run, so asking it to write would silently not.
 */
export async function forgeConfig(req: ForgeRequest, signal?: AbortSignal): Promise<ForgeResult> {
  if (!req.dry_run) {
    await requireCapability(
      forgeHealth,
      allowsTraining,
      "This argus-forge server is demo-safe: it renders config previews but won't write them or train.",
      signal,
    );
  }
  const resp = await fetch(`${forgeUrl()}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) return asError(resp);
  return resp.json();
}
