/**
 * Glue between the generated wire types (`src/lib/generated`) and the types the
 * app uses, plus compile-time checks that the two can't part ways unnoticed.
 *
 * Nothing here exists at runtime. `tsc` is the test: bumping a pin in
 * schema/pins.json fails typecheck on any line below the new schema breaks.
 */

import type {
  AttributeSource,
  ContentRating,
  EraxResult,
  ExportMode,
  FaceAge,
  FaceGender,
  FacePose,
  FaceRace,
  GarmentDetection,
  GuardConfig,
  GuardResult,
  ImageResult,
  NsfwResult,
  PersonDetection,
  ScanSummary,
  SceneEnvironment,
  SetAge,
} from "@/components/curator/types";
import type * as Curator from "@/lib/generated/curator";
import type * as Proof from "@/lib/generated/proof";
import type { EvalReport } from "@/lib/proofApi";

/**
 * `T` with the fields `K` always present. A service's schema marks every field
 * with a default as optional, because Pydantic describes what it would accept,
 * but the services serialize all of them. Fields left out of `K` stay optional,
 * which is how this app keeps tolerating older servers.
 */
export type Filled<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** A model as a current server sends it: every field present, all the way down. */
type Sent<T> = T extends object ? { [K in keyof T]-?: Sent<T[K]> } : T;

type Expect<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * A hand-written type that is wider than its model must still take everything
 * the server sends, and must name the same fields, so a new one gets a decision.
 */
type Fits<Model, Hand> = [Sent<Model>] extends [Hand] ? Same<keyof Model, keyof Hand> : false;

export type WireChecks = [
  // Kept by hand because they tolerate more than the schema allows. See curator/types.ts.
  Expect<Fits<Curator.ImageResult, ImageResult>>,
  Expect<Fits<Curator.ScanSummary, ScanSummary>>,
  Expect<Fits<Curator.GuardConfig, GuardConfig>>,
  Expect<Fits<Curator.GuardResult, GuardResult>>,
  Expect<Fits<Curator.NsfwResult, NsfwResult>>,
  Expect<Fits<Curator.EraxResult, EraxResult>>,
  Expect<Fits<Curator.SetAge, SetAge>>,
  Expect<Fits<Curator.PersonDetection, PersonDetection>>,
  Expect<Fits<Curator.GarmentDetection, GarmentDetection>>,
  // Built from nothing but aliases, so an Omit would only restate them.
  Expect<Fits<Proof.EvalReport, EvalReport>>,

  // Unions that drive runtime constants, so they stay declared next to those.
  Expect<Same<FacePose, NonNullable<Curator.FaceDetection["pose"]>>>,
  Expect<Same<FaceRace, NonNullable<Curator.FaceAttributes["race"]>>>,
  Expect<Same<FaceGender, NonNullable<Curator.FaceAttributes["gender"]>>>,
  Expect<Same<FaceAge, NonNullable<Curator.FaceAttributes["age"]>>>,
  Expect<Same<AttributeSource, NonNullable<Curator.FaceAttributes["age_source"]>>>,
  Expect<Same<SceneEnvironment, Curator.SceneTags["environment"]>>,
  Expect<Same<ContentRating, NonNullable<Curator.ImageResult["content_rating"]>>>,
  Expect<Same<ExportMode, NonNullable<Curator.ExportRequest["mode"]>>>,
];
