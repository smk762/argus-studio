/**
 * Bundled sample EvalReport for /proof demo mode — no backend required, mirrors
 * the public GitHub demo pattern used by /curate and /gallery. Generated from a
 * real argus_proof run through the schema-valid models (a LoRA weight/epoch
 * sweep: 8 samples, one near-dup pair, a spread of scores so the gate lands some
 * auto-pass, one auto-fail, and a borderline band awaiting HITL review).
 */

import type { EvalReport } from "@/lib/proofApi";

export const DEMO_REPORT: EvalReport = {
  proof_version: "1.1",
  run_id: "proof-demo-sabine-lora-v3",
  images: [
    {
      image_id: "proof-e10-w0.8-s1",
      seed: 1,
      metrics: { identity: 0.86, clip_score: 0.78, aesthetic: 0.71, preference: 0.69, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: true,
      duplicate_group: 0,
    },
    {
      image_id: "proof-e10-w0.8-s2",
      seed: 2,
      metrics: { identity: 0.83, clip_score: 0.74, aesthetic: 0.68, preference: 0.66, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: true,
      duplicate_group: 1,
    },
    {
      image_id: "proof-e10-w1.0-s1",
      seed: 3,
      metrics: { identity: 0.61, clip_score: 0.55, aesthetic: 0.58, preference: 0.52, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: null,
      duplicate_group: 2,
    },
    {
      image_id: "proof-e10-w1.0-s2",
      seed: 4,
      metrics: { identity: 0.59, clip_score: 0.57, aesthetic: 0.6, preference: 0.54, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: null,
      duplicate_group: 2,
    },
    {
      image_id: "proof-e6-w0.8-s1",
      seed: 5,
      metrics: { identity: 0.79, clip_score: 0.72, aesthetic: 0.66, preference: 0.63, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: null,
      duplicate_group: 3,
    },
    {
      image_id: "proof-e6-w1.0-s1",
      seed: 6,
      metrics: { identity: 0.34, clip_score: 0.41, aesthetic: 0.39, preference: 0.3, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [{ code: "identity_mismatch", note: "auto: identity below floor" }],
      passed: false,
      duplicate_group: 4,
    },
    {
      image_id: "proof-e14-w1.0-s1",
      seed: 7,
      metrics: { identity: 0.72, clip_score: 0.44, aesthetic: 0.52, preference: 0.48, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: null,
      duplicate_group: 5,
    },
    {
      image_id: "proof-e14-w1.0-s2",
      seed: 8,
      metrics: { identity: 0.64, clip_score: 0.58, aesthetic: 0.55, preference: 0.51, safety: null },
      hitl_rating: null,
      hitl_rater: null,
      reject_reasons: [],
      passed: null,
      duplicate_group: 6,
    },
  ],
  aggregate: {
    n_images: 8,
    n_passed: 2,
    pass_rate: 0.2857142857142857,
    means: { identity: 0.6725, clip_score: 0.59875, aesthetic: 0.58625, preference: 0.54125, safety: null },
    n_groups: 7,
    n_needs_hitl: 4,
    diversity: 0.63,
  },
  scorers: [
    { name: "insightface", metric: "identity", version: "0.7.3", model: "buffal_l" },
    { name: "clipscore", metric: "clip_score", version: "1.0", model: "ViT-L/14" },
    { name: "pyiqa", metric: "aesthetic", version: "0.1.13", model: "topiq_nr" },
    { name: "imagereward", metric: "preference", version: "1.0", model: "ImageReward-v1.0" },
    { name: "phash", metric: "duplicate", version: "1.0", model: "phash-8" },
  ],
  verdict: {
    passed: false,
    pending: true,
    reasons: [
      "pass_rate 0.29 vs threshold 0.75 — pending review (2/7 groups passed, 4 need review)",
      "diversity 0.63",
    ],
  },
  created_at: "2026-07-08T12:00:00Z",
};

/** The demo run browser shows just this one bundled run. */
export const DEMO_SUMMARY = {
  run_id: DEMO_REPORT.run_id,
  passed: DEMO_REPORT.verdict.passed,
  pending: DEMO_REPORT.verdict.pending,
  pass_rate: DEMO_REPORT.aggregate.pass_rate,
  n_images: DEMO_REPORT.aggregate.n_images,
  n_groups: DEMO_REPORT.aggregate.n_groups,
  n_needs_hitl: DEMO_REPORT.aggregate.n_needs_hitl,
  created_at: DEMO_REPORT.created_at,
};
