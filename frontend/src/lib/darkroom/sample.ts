/**
 * The bundled sample behind `/darkroom` in demo mode, when no darkroom answers.
 * These are argus-safelight's fixture records: flat drawings with canned
 * verdicts, read-only, so nothing here came from a real generation.
 */

import type { GenerationRecord, Health, Models, Policies, RecordPage, RecordQuery } from "@/lib/darkroomApi";

import models from "./fixture/models.json";
import policies from "./fixture/policies.json";
import fx_deleted_illegal from "./fixture/records/fx-deleted-illegal.json";
import fx_deleted_minor from "./fixture/records/fx-deleted-minor.json";
import fx_deleted_unchecked from "./fixture/records/fx-deleted-unchecked.json";
import fx_failed from "./fixture/records/fx-failed.json";
import fx_omitted_exposed from "./fixture/records/fx-omitted-exposed.json";
import fx_omitted_unchecked from "./fixture/records/fx-omitted-unchecked.json";
import fx_passed from "./fixture/records/fx-passed.json";
import fx_passed_noage from "./fixture/records/fx-passed-noage.json";
import fx_refused from "./fixture/records/fx-refused.json";
import fx_refused_illegal from "./fixture/records/fx-refused-illegal.json";
import fx_review_agree from "./fixture/records/fx-review-agree.json";
import fx_review_disagree from "./fixture/records/fx-review-disagree.json";

const RECORDS = [fx_deleted_illegal, fx_deleted_minor, fx_deleted_unchecked, fx_failed, fx_omitted_exposed, fx_omitted_unchecked, fx_passed, fx_passed_noage, fx_refused, fx_refused_illegal, fx_review_agree, fx_review_disagree] as unknown as GenerationRecord[];

/** Read-only, so every write control stays off. No backend answers, so none is claimed. */
export const SAMPLE_HEALTH: Health = {
  version: "sample",
  backends: { comfyui: false, ollama: false, singguard: false, nudenet: false, age: false },
  policies: (policies as unknown as Policies).policies.map((policy) => policy.name),
  default_policy: (policies as unknown as Policies).default,
  thinking: "cascade",
  nsfw_allowed: false,
  sfw_available: false,
  devmode: false,
  read_only: true,
};

export const SAMPLE_POLICIES = policies as unknown as Policies;
export const SAMPLE_MODELS = models as unknown as Models;

/** What `GET /records` would answer for the sample: newest first, filtered and paged the same way. */
export function sampleRecords(query: RecordQuery = {}): RecordPage {
  const found = RECORDS.filter(
    (record) => (!query.outcome || record.outcome === query.outcome) && (!query.mode || record.request.mode === query.mode),
  ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  return { records: found.slice((page - 1) * pageSize, page * pageSize), total: found.length, page, page_size: pageSize };
}

export function sampleRecord(id: string): GenerationRecord {
  const record = RECORDS.find((entry) => entry.id === id);
  if (!record) throw new Error(`No record ${id}.`);
  return record;
}

/** Sample images sit in `public/`. Like `imageUrl`, only a record with an image should ever ask. */
export const sampleImageUrl = (id: string): string => `/darkroom-sample/${encodeURIComponent(id)}.png`;
