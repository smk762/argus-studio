/**
 * The rail's facets, applied in the browser to the rows on screen. The attribute,
 * scene and garment rules mirror the curator's `selection.py`, so what the grid
 * shows is what a keep-set preview of the same facets keeps. A frame without the
 * reading drops out once its facet is on.
 */

import type { CuratorFilters, FaceAge, FaceGender, FaceRace, ImageResult, SceneEnvironment } from "@/components/curator/types";
import { guardFilterMatches, matchesGuardView, shieldState } from "@/lib/curatorGuard";
import { contentRating } from "@/lib/curatorModeration";

function attributesMatch(img: ImageResult, f: CuratorFilters): boolean {
  const lists: [string | null | undefined, number | null | undefined, readonly string[]][] = [
    [img.primary_face_attributes?.race, img.primary_face_attributes?.race_conf, f.faceRaces],
    [img.primary_face_attributes?.gender, img.primary_face_attributes?.gender_conf, f.faceGenders],
    [img.primary_face_attributes?.age, img.primary_face_attributes?.age_conf, f.faceAges],
  ];
  for (const [value, conf, allowed] of lists) {
    if (allowed.length === 0) continue;
    if (value == null || !allowed.includes(value)) return false;
    // No confidence at all is a MiVOLO regression age, which the floor does not apply to.
    if (conf != null && conf < f.minAttributeConf) return false;
  }
  if (f.minAgeYears == null && f.maxAgeYears == null) return true;
  const years = img.primary_face_attributes?.age_years;
  if (years == null) return false;
  if (f.minAgeYears != null && years < f.minAgeYears) return false;
  return f.maxAgeYears == null || years <= f.maxAgeYears;
}

function sceneMatches(img: ImageResult, f: CuratorFilters): boolean {
  if (f.scenes.length === 0 && f.sceneEnvironments.length === 0) return true;
  const scene = img.scene;
  if (scene == null) return false;
  if (f.sceneEnvironments.length > 0) {
    if (!f.sceneEnvironments.includes(scene.environment) || scene.environment_conf < f.minSceneConf) return false;
  }
  if (f.scenes.length === 0) return true;
  return (scene.categories ?? []).some((c) => f.scenes.includes(c.label) && c.conf >= f.minSceneConf);
}

function garmentsMatch(img: ImageResult, f: CuratorFilters): boolean {
  if (f.garments.length === 0 && f.excludeGarments.length === 0) return true;
  if (img.garments == null) return false;
  const worn = img.garments.filter((g) => g.conf >= f.minGarmentConf);
  if (worn.some((g) => f.excludeGarments.includes(g.label))) return false;
  if (f.garments.length === 0) return true;
  const hits = worn.filter((g) => f.garments.includes(g.label));
  if (hits.length === 0) return false;
  return !f.garmentsUncropped || hits.some((g) => !g.touches_edge);
}

function ratingMatches(img: ImageResult, f: CuratorFilters): boolean {
  if (f.contentRatings.length === 0) return true;
  const rating = contentRating(img);
  return rating != null && f.contentRatings.includes(rating);
}

/** True when an image should be shown / is eligible under the current facets. */
export function matchesFilters(img: ImageResult, f: CuratorFilters, officialPolicy: string | null = null): boolean {
  if (img.score < f.minScore) return false;
  if (f.passedOnly && !img.passed) return false;
  if (f.hideDuplicates && img.is_duplicate) return false;
  if (f.singleFaceOnly && img.face_count !== 1) return false;
  if (f.requireKnownFace && !img.primary_face_cluster) return false;
  if (f.faceClusters.length > 0) {
    if (!img.primary_face_cluster || !f.faceClusters.includes(img.primary_face_cluster)) return false;
  }
  if (f.poses.length > 0) {
    if (!img.primary_face_pose || !f.poses.includes(img.primary_face_pose)) return false;
  }
  return (
    attributesMatch(img, f) &&
    sceneMatches(img, f) &&
    garmentsMatch(img, f) &&
    ratingMatches(img, f) &&
    guardFilterMatches(img, f) &&
    matchesGuardView(shieldState(img, officialPolicy), f.guardView)
  );
}

export interface FacetCounts {
  races: Map<FaceRace, number>;
  genders: Map<FaceGender, number>;
  ages: Map<FaceAge, number>;
  /** How many primary faces have an age in years, so the range only shows when it can match. */
  yearsKnown: number;
  scenes: Map<string, number>;
  environments: Map<SceneEnvironment, number>;
  garments: Map<string, number>;
}

function bump<K>(map: Map<K, number>, key: K | null | undefined): void {
  if (key != null) map.set(key, (map.get(key) ?? 0) + 1);
}

/** Frames per value, at the confidence the facets apply. A frame counts once per label. */
export function facetCounts(results: readonly ImageResult[], minSceneConf: number, minGarmentConf: number): FacetCounts {
  const counts: FacetCounts = {
    races: new Map(),
    genders: new Map(),
    ages: new Map(),
    yearsKnown: 0,
    scenes: new Map(),
    environments: new Map(),
    garments: new Map(),
  };
  for (const img of results) {
    const attrs = img.primary_face_attributes;
    bump(counts.races, attrs?.race);
    bump(counts.genders, attrs?.gender);
    bump(counts.ages, attrs?.age);
    if (attrs?.age_years != null) counts.yearsKnown += 1;
    if (img.scene) {
      const labels = (img.scene.categories ?? []).filter((c) => c.conf >= minSceneConf).map((c) => c.label);
      for (const label of new Set(labels)) bump(counts.scenes, label);
      if (img.scene.environment_conf >= minSceneConf) bump(counts.environments, img.scene.environment);
    }
    const garments = (img.garments ?? []).filter((g) => g.conf >= minGarmentConf).map((g) => g.label);
    for (const label of new Set(garments)) bump(counts.garments, label);
  }
  return counts;
}

/** Labels by how many frames carry them, keeping any already ticked so it can be cleared. */
export function rankedLabels(counts: ReadonlyMap<string, number>, ticked: readonly string[]): string[] {
  const labels = [...new Set([...counts.keys(), ...ticked])];
  return labels.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

/** `east_asian` -> `East asian`, `top_tshirt_sweatshirt` -> `Top tshirt sweatshirt`. */
export function slugLabel(slug: string): string {
  const words = slug.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : slug;
}
