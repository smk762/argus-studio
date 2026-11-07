/**
 * What the scan read off a frame, as text for the card and the detail view.
 * Text only: these sit beside a thumbnail that may be covered. Sources stay
 * visible, so a model's guess does not read as a fact about a person.
 */

import type { FaceAttributes, GarmentDetection, ImageResult, ScanSummary, SceneTags } from "@/components/curator/types";
import { slugLabel } from "@/lib/curatorFacets";

function years(value: number): string {
  return `${Math.round(value)}y`;
}

const percent = (conf: number | null | undefined): string => (conf == null ? "" : ` ${Math.round(conf * 100)}%`);

/** One line for a face or an identity: gender and age, each with the model that said so. */
export function attributeLine(attrs: FaceAttributes | null | undefined): string | null {
  if (!attrs) return null;
  const parts: string[] = [];
  if (attrs.race) parts.push(`${slugLabel(attrs.race)}${percent(attrs.race_conf)}`);
  if (attrs.gender) parts.push(`${attrs.gender}${attrs.gender_source ? ` (${attrs.gender_source})` : ""}`);
  if (attrs.age_years != null) {
    parts.push(`${years(attrs.age_years)}${attrs.age_source ? ` (${attrs.age_source}${attrs.age_body ? ", with body" : ""})` : ""}`);
  } else if (attrs.age) {
    parts.push(`${attrs.age}${attrs.age_source ? ` (${attrs.age_source})` : ""}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The age a card shows when the frame has one, marking one inferred from the set. */
export function cardAge(img: ImageResult): string | null {
  const measured = img.primary_face_attributes?.age_years;
  if (measured != null) return years(measured);
  return img.set_age ? `≈${years(img.set_age.years)} set` : null;
}

/** Ages MiVOLO read from a body with no matched face. */
export function bodyAgeLines(img: ImageResult): string[] {
  return (img.people ?? [])
    .filter((person) => person.face_index == null && person.age_years != null)
    .map((person) => `${years(person.age_years as number)} (body only)`);
}

/** Why the frame's face or age reading cannot be taken at face value. Empty when it can. */
export function checkWarnings(img: ImageResult): string[] {
  const out: string[] = [];
  if (img.face_error) out.push(`Face detection failed, so no face here means unchecked: ${img.face_error}`);
  if (img.people_check === "detection_failed") {
    out.push(`The person detector failed, so faces ran without bodies${img.people_error ? `: ${img.people_error}` : "."}`);
  } else if (img.people_check === "body_ages_failed") {
    out.push(`People were found, but their body ages failed${img.people_error ? `: ${img.people_error}` : "."}`);
  }
  return out;
}

export function sceneRows(scene: SceneTags | null | undefined): [string, string][] {
  if (!scene) return [];
  return [
    ["Environment", `${scene.environment} ${Math.round(scene.environment_conf * 100)}%`],
    ...(scene.categories ?? []).map((c): [string, string] => [slugLabel(c.label), `${Math.round(c.conf * 100)}%`]),
  ];
}

export function garmentRows(garments: readonly GarmentDetection[] | null | undefined): [string, string][] {
  return (garments ?? []).map((g) => [
    slugLabel(g.label),
    `${Math.round(g.conf * 100)}%${g.touches_edge ? ", cut off" : ""}`,
  ]);
}

/** What the scan did with the set age, when it was asked for. Null otherwise. */
export function setAgeOutcome(summary: Pick<ScanSummary, "set_age" | "set_age_skipped" | "results">): string | null {
  if (summary.set_age) {
    const { years: age, faces, cluster_id, share } = summary.set_age;
    const frames = summary.results.filter((row) => row.set_age).length;
    const from = faces != null ? ` from ${faces} faces${cluster_id ? ` in ${cluster_id}` : ""}` : "";
    const held = share != null ? ` (${Math.round(share * 100)}%)` : "";
    return `Set age ≈${years(age)}${from}${held}, on ${frames} ${frames === 1 ? "frame" : "frames"} with no face.`;
  }
  return summary.set_age_skipped ? `No set age: ${summary.set_age_skipped}.` : null;
}
