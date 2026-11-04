/**
 * What /curate may show and export from a finished scan.
 *
 * A rejected frame (`passed === false`) is decided before any score is read:
 * curator no longer runs NudeNet on it, so `nsfw` is null, and a missing score
 * must not be read as clear. Those frames, and an under-18 face with exposure,
 * stay blurred and cannot be revealed or exported. A passing frame NudeNet
 * scored at or above the blur line, or failed to score, is blurred until the
 * viewer reveals it.
 */

import type { AgeReading, ImageResult } from "@/components/curator/types";

/** Classes the exposed score starts from. Matches argus-cortex DEFAULT_EXPOSED_LABELS. */
export const EXPOSED_LABELS = [
  "BUTTOCKS_EXPOSED",
  "FEMALE_BREAST_EXPOSED",
  "FEMALE_GENITALIA_EXPOSED",
  "MALE_GENITALIA_EXPOSED",
  "ANUS_EXPOSED",
] as const;

/** MiVOLO ages under this, with any reported exposed detection, stay blurred. */
export const MINOR_AGE_YEARS = 18;
/** NudeNet reports nothing under this, so an exposed score here is a real detection. */
export const MINOR_EXPOSED_SCORE = 0.2;
/** Blur a passing frame once its exposed reading reaches this. A click can lift it. */
export const BLUR_EXPOSED_SCORE = 0.25;

export interface ThumbSafety {
  /** CSS-blur the thumbnail. */
  blurred: boolean;
  /** A click may lift the blur. Never for a rejected frame or minor-exposed. */
  revealable: boolean;
  /** Short label drawn on the veil. */
  label: string;
  /** Full explanation, for the title and the detail view. */
  reason: string;
}

const CLEAR: ThumbSafety = { blurred: false, revealable: false, label: "", reason: "" };

function mivoloYears(attrs: AgeReading | null | undefined): number | null {
  if (attrs?.age_years == null) return null;
  if (attrs.age_source != null && attrs.age_source !== "mivolo") return null;
  return attrs.age_years;
}

/** Every MiVOLO age the under-18 rule reads: faces, body-only people, then the set age. */
export function mivoloAges(img: ImageResult): number[] {
  const faces = img.faces ?? [];
  const measured = faces.map((face) => mivoloYears(face.attributes)).filter((age): age is number => age != null);
  const primary = mivoloYears(img.primary_face_attributes);
  if (primary != null && !faces.some((face) => face.primary)) measured.unshift(primary);
  const bodies = (img.people ?? [])
    .filter((person) => person.face_index == null)
    .map((person) => mivoloYears(person))
    .filter((age): age is number => age != null);
  const ages = [...measured, ...bodies];
  if (ages.length === 0 && img.set_age) return [img.set_age.years];
  return ages;
}

/** The strongest exposed reading: the highest exposed class, or the exposed score. Zero when NudeNet did not report. */
export function exposedReading(img: ImageResult): number {
  const nsfw = img.nsfw;
  if (nsfw == null) return 0;
  const fromLabels = EXPOSED_LABELS.reduce((max, label) => Math.max(max, nsfw.labels?.[label] ?? 0), 0);
  return Math.max(fromLabels, nsfw.exposed_score ?? 0);
}

/** A MiVOLO age under 18 sharing the frame with an exposed detection of at least 0.2. */
export function isMinorExposed(img: ImageResult): boolean {
  if (img.nsfw == null) return false;
  if (exposedReading(img) < MINOR_EXPOSED_SCORE) return false;
  return mivoloAges(img).some((age) => age < MINOR_AGE_YEARS);
}

function held(label: string, reason: string): ThumbSafety {
  return { blurred: true, revealable: false, label, reason };
}

function veiled(label: string, reason: string): ThumbSafety {
  return { blurred: true, revealable: true, label, reason };
}

/**
 * How to show one thumbnail from a finished scan.
 *
 * `nsfwRan` is the scan's `nsfw_config.enabled`. A missing score is "not
 * checked" only when NudeNet actually ran; a scan that never asked for it
 * has no score to hide.
 *
 * `passed === false` is decided first and does not read `nsfw`.
 *
 * `pending` is the scan-wide list of checks still running. While nudity has
 * not landed, or exposure has landed and the ages have not, the frame stays
 * covered and cannot be revealed. An empty list is a finished scan.
 */
export function thumbSafety(img: ImageResult, nsfwRan: boolean, pending: readonly string[] = []): ThumbSafety {
  if (img.passed === false) {
    const why = img.reject_reason?.trim()
      ? `Rejected: ${img.reject_reason}.`
      : "Rejected by the scan.";
    return held("Rejected", `${why} Rejected frames stay blurred.`);
  }
  if (pending.includes("nsfw") && img.nsfw == null && !img.nudenet_failed) {
    return held("Checking", "Nudity has not been scored yet, so this stays blurred.");
  }
  if (pending.includes("faces") && exposedReading(img) >= MINOR_EXPOSED_SCORE && mivoloAges(img).length === 0) {
    return held("Stays blurred", "Exposure is in, and the ages are still coming.");
  }
  if (isMinorExposed(img)) {
    return held("Stays blurred", "An under-18 face with exposure stays blurred.");
  }
  if (img.nudenet_failed) {
    return veiled("NudeNet failed", "NudeNet's check failed, so this stays blurred until you reveal it.");
  }
  if (img.nsfw == null) {
    if (!nsfwRan) return CLEAR;
    if (mivoloAges(img).some((age) => age < MINOR_AGE_YEARS)) {
      return held("Stays blurred", "An under-18 face has no nudity score, so this stays blurred.");
    }
    return veiled("Not checked", "Nudity was not scored, so this stays blurred until you reveal it.");
  }
  if (exposedReading(img) >= BLUR_EXPOSED_SCORE) {
    return veiled(
      "Blurred",
      `Exposure ${exposedReading(img).toFixed(2)} is at or above ${BLUR_EXPOSED_SCORE.toFixed(2)}.`,
    );
  }
  return CLEAR;
}

/** A finished scan ran NudeNet, so a row with no score was skipped rather than cleared. */
export function scanCheckedNsfw(summary: { nsfw_config?: { enabled?: boolean | null } | null }): boolean {
  return summary.nsfw_config?.enabled === true;
}

/** Rejected frames and minor-exposed frames are never part of an export selection. */
export function canExport(img: ImageResult): boolean {
  return img.passed === true && !isMinorExposed(img);
}

/** Why a frame cannot be selected, or null when it can. */
export function exportBlockReason(img: ImageResult): string | null {
  if (img.passed === false) {
    return img.reject_reason?.trim()
      ? `Not exported: ${img.reject_reason}.`
      : "Rejected frames are not exported.";
  }
  if (isMinorExposed(img)) return "An under-18 image with exposure is not exported.";
  return null;
}

/**
 * Sentence for a selection that came back smaller than requested, naming each
 * frame's `reject_reason`. Null when every requested frame landed.
 */
export function framesLeftOut(requested: readonly ImageResult[], landed: (relPath: string) => boolean): string | null {
  const missing = requested.filter((img) => !landed(img.rel_path));
  if (missing.length === 0) return null;
  const why = (img: ImageResult): string => {
    if (img.passed === false) return img.reject_reason?.trim() || "rejected";
    if (isMinorExposed(img)) return "minor-exposed";
    return "not transferred";
  };
  const detail = missing.map((img) => `${img.rel_path} (${why(img)})`).join("; ");
  const noun = missing.length === 1 ? "image was" : "images were";
  return `${missing.length} of ${requested.length} selected ${noun} not exported: ${detail}.`;
}
