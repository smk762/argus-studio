import type { CaptionResult } from "@/types";

/** `metadata.subjects` as argus-lens writes it (assembly/subjects.py SubjectCount). */
interface Subjects {
  count: number | null;
  multiple: boolean;
  tag_count: number | null;
  prose_count: number | null;
  agree: boolean | null;
  evidence: string[];
}

/**
 * Read `metadata.subjects` defensively: `metadata` is an untyped bag and lens
 * releases before the curate-index work (argus-lens#53) don't send it at all,
 * so anything that isn't the expected shape renders nothing.
 */
function subjectsOf(result: CaptionResult): Subjects | null {
  const raw = result.metadata?.subjects;
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<Subjects>;
  if (typeof s.multiple !== "boolean") return null;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    count: num(s.count),
    multiple: s.multiple,
    tag_count: num(s.tag_count),
    prose_count: num(s.prose_count),
    agree: typeof s.agree === "boolean" ? s.agree : null,
    evidence: Array.isArray(s.evidence) ? s.evidence.filter((e): e is string => typeof e === "string") : [],
  };
}

/**
 * Headcount from the caption pass: the booru count tags (`2girls`,
 * `solo_focus`) cross-checked against the prose. A multi-person image is the
 * one that needs face ID before it can train an identity LoRA, which is
 * argus-curator's job, so it is called out rather than shown as a bare number.
 */
export function SubjectCount({ result }: { result: CaptionResult }) {
  const s = subjectsOf(result);
  if (!s || s.count == null) return null;

  const disagree = s.agree === false;
  const tone = s.multiple || disagree
    ? "border-accent-amber/40 bg-accent-amber/5 text-accent-amber"
    : "border-border bg-surface text-muted";

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold tracking-wider uppercase">
          {s.count === 0 ? "No people" : s.count === 1 ? "1 person" : `${s.count} people`}
        </span>
        <span className="font-mono text-[11px] text-muted">
          tags {s.tag_count ?? "–"} · prose {s.prose_count ?? "–"}
        </span>
        {s.evidence.length > 0 && (
          <span className="truncate font-mono text-[11px] text-muted" title={s.evidence.join(", ")}>
            {s.evidence.join(", ")}
          </span>
        )}
      </div>
      {(s.multiple || disagree) && (
        <p className="mt-1 text-[11px] leading-relaxed">
          {disagree ? "Tags and prose disagree on the headcount. " : ""}
          {s.multiple
            ? "Multi-person image: confirm who is who with face ID in Curate before using it for an identity LoRA."
            : "Check the image before training on it."}
        </p>
      )}
    </div>
  );
}
