"use client";

import { useState } from "react";

import { OUTCOME_LABEL, OUTCOME_TONE, hasImage } from "@/lib/darkroom/outcome";
import { REASON_WORDS, matchesRule, promptChangedVerdict, reasonParts, recordRules, rowVerdict, type RuleHit } from "@/lib/darkroom/shields";
import { ago, formatWhen } from "@/lib/darkroom/time";
import { allowsDarkroomPurge, OUTCOMES, purgeAll, type GenerationRecord, type Mode, type Outcome } from "@/lib/darkroomApi";
import { permits } from "@/lib/capabilities";
import { useLoad } from "@/lib/darkroom/useLoad";

import { Info } from "@/components/Tooltip";

import { useCompose } from "./ComposeProvider";
import { useDarkroom } from "./DarkroomProvider";
import { Shield } from "./Shield";
import { Badge, Button, Notice, Spinner } from "./ui";

const PAGE_SIZE = 200;

interface HistoryFilter {
  outcome: Outcome | null;
  mode: Mode | null;
  /** Only records where the isolated and with-prompt scans disagree. */
  changed: boolean;
  /** A `policy:letter` code or a reason word, matched here because darkroom has no such filter. */
  rule: string | null;
}

/** Devmode's clean slate, whatever the filters show. It asks first, since nothing brings records back. */
function PurgeAll({ onPurged }: { onPurged: () => void }) {
  const { running } = useCompose();
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purge = async () => {
    setPurging(true);
    setError(null);
    try {
      await purgeAll();
      setConfirming(false);
      onPurged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPurging(false);
    }
  };

  if (!confirming) {
    return (
      <Button small tone="danger" onClick={() => setConfirming(true)} disabled={running} title={running ? "Wait for the current generation to finish." : "Delete every record and image, not just those the filters show."}>
        Delete everything
      </Button>
    );
  }
  return (
    <span role="group" aria-label="Confirm deleting every record" className="inline-flex flex-wrap items-center gap-2 text-sm text-foreground/70">
      <span>Delete every record and image, including any the filters hide? This cannot be undone.</span>
      <Button small tone="danger" onClick={purge} disabled={purging}>
        {purging ? "Deleting…" : "Delete all for good"}
      </Button>
      <Button small onClick={() => setConfirming(false)} disabled={purging}>
        Keep
      </Button>
      {error ? <span className="text-accent-red-ink">{error}</span> : null}
    </span>
  );
}

/** `GET /records`, filtered by outcome and mode on darkroom's side and by "Prompt changed the verdict" and the rule here. */
export function History() {
  const [filter, setFilterState] = useState<HistoryFilter>({ outcome: null, mode: null, changed: false, rule: null });
  const { records: fetchRecords, sample, health } = useDarkroom();
  const [purges, setPurges] = useState(0);
  const { data, error } = useLoad(`${filter.outcome ?? ""}|${filter.mode ?? ""}|${sample}|${purges}`, () => fetchRecords({ outcome: filter.outcome, mode: filter.mode, pageSize: PAGE_SIZE }));
  const fetched = data?.records ?? null;
  const narrowed = filter.changed || filter.rule != null;
  const records = fetched?.filter((record) => (!filter.changed || promptChangedVerdict(record)) && (!filter.rule || matchesRule(record, filter.rule))) ?? null;

  const setFilter = (patch: Partial<HistoryFilter>) => {
    setFilterState((current) => ({ ...current, ...patch }));
  };

  return (
    <section className="space-y-4" aria-labelledby="history-title">
      <header className="flex flex-wrap items-center gap-3">
        <h2 id="history-title" className="text-2xl font-semibold text-foreground">
          History
        </h2>
        <span className="text-sm text-foreground/70" aria-live="polite">
          {records && fetched ? (narrowed && fetched.length > 0 ? `${records.length} of ${fetched.length} record${fetched.length === 1 ? "" : "s"}` : `${records.length} record${records.length === 1 ? "" : "s"}`) : ""}
        </span>
        {permits(allowsDarkroomPurge(health)) ? <PurgeAll onPurged={() => setPurges((count) => count + 1)} /> : null}
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Filters">
        <FilterSelect label="Outcome" value={filter.outcome ?? ""} onChange={(value) => setFilter({ outcome: (value || null) as Outcome | null })} options={[["", "All outcomes"], ...OUTCOMES.map((value): [string, string] => [value, OUTCOME_LABEL[value]])]} />
        <FilterSelect
          label="Mode"
          value={filter.mode ?? ""}
          onChange={(value) => setFilter({ mode: (value || null) as Mode | null })}
          options={[
            ["", "Both modes"],
            ["sfw", "SFW"],
            ["nsfw", "NSFW"],
          ]}
        />
        <RuleSelect records={fetched ?? []} value={filter.rule} onChange={(rule) => setFilter({ rule })} />
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <input type="checkbox" checked={filter.changed} onChange={(event) => setFilter({ changed: event.target.checked })} className="accent-accent-purple" />
          <span>Prompt changed the verdict</span>
          <span aria-hidden="true" className="rounded-sm border border-accent-amber/60 px-1 text-xs font-bold text-accent-amber-ink">
            ≠
          </span>
          <Info text="Only records where a policy's isolated and with-prompt scans disagree." />
        </label>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {data && data.total > data.records.length ? <p className="text-xs text-muted">Showing the newest {data.records.length} of {data.total} records. The count and the filters here cover only those; the archive has them all.</p> : null}
      {!records && !error ? (
        <p className="flex items-center gap-2 text-sm text-foreground/70">
          <Spinner /> Loading records…
        </p>
      ) : null}
      {records && records.length === 0 ? (
        <p className="text-sm text-foreground/70">{fetched && fetched.length > 0 && narrowed ? "No record here matches these filters." : "No records match."}</p>
      ) : null}
      {records && records.length > 0 ? (
        <ul className="space-y-2">
          {records.map((record) => (
            <HistoryRow key={record.id} record={record} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The rules on the records in view, grouped by policy because a letter means something different under each one. */
function RuleSelect({ records, value, onChange }: { records: GenerationRecord[]; value: string | null; onChange: (rule: string | null) => void }) {
  const byPolicy = new Map<string, Map<string, RuleHit>>();
  for (const record of records) {
    for (const hit of recordRules(record)) {
      if (!byPolicy.has(hit.policy)) byPolicy.set(hit.policy, new Map());
      byPolicy.get(hit.policy)?.set(hit.code, hit);
    }
  }
  const words = REASON_WORDS.filter((word) => records.some((record) => reasonParts(record.outcome_reason).includes(word)));
  return (
    <label className="flex items-center text-sm">
      <span className="sr-only">Rule</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className="max-w-[320px] rounded-md border border-border/60 bg-surface px-2 py-1 text-sm text-foreground">
        <option value="">All rules</option>
        {[...byPolicy.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([policy, hits]) => (
            <optgroup key={policy} label={policy}>
              {[...hits.values()]
                .sort((a, b) => a.rule.localeCompare(b.rule))
                .map((hit) => (
                  <option key={hit.code} value={hit.code}>
                    {hit.policy} · {hit.rule}
                  </option>
                ))}
            </optgroup>
          ))}
        {words.length > 0 ? (
          <optgroup label="Other reasons">
            {words.map((word) => (
              <option key={word} value={word}>
                {word}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-foreground/70">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-border/60 bg-surface px-2 py-1 text-sm text-foreground">
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function HistoryRow({ record }: { record: GenerationRecord }) {
  const { openRecord } = useCompose();
  const verdict = rowVerdict(record);
  const changed = promptChangedVerdict(record);
  return (
    <li>
      <button type="button" onClick={() => openRecord(record.id)} className="w-full cursor-pointer text-left flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-2 transition-colors hover:border-accent-purple/60 hover:bg-surface-hover/60">
        <Thumb record={record} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{record.request.user_prompt || <span className="text-muted">(empty prompt)</span>}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <Badge className={OUTCOME_TONE[record.outcome]}>{record.outcome}</Badge>
            <span className="uppercase">{record.request.mode}</span>
            <span className="font-mono">{record.guard.enforcing_policy}</span>
            {record.outcome_reason ? <span>· {record.outcome_reason}</span> : null}
            <span title={formatWhen(record.created_at)}>· {ago(record.created_at)}</span>
          </p>
        </div>
        {changed ? (
          <span title="The prompt changed the verdict: the isolated and with-prompt scans disagree" className="rounded-sm border border-accent-amber/60 px-1 text-xs font-bold text-accent-amber-ink">
            ≠
          </span>
        ) : null}
        {verdict ? <Shield state={verdict.state} letters={verdict.letters} size="h-7 w-7" title={verdict.title} /> : <span className="w-7" />}
      </button>
    </li>
  );
}

/** A thumbnail for a served image. Anything else gets a plain mark and no img element. */
function Thumb({ record }: { record: GenerationRecord }) {
  const { image } = useDarkroom();
  if (hasImage(record)) {
    const blur = record.guard.nudenet?.blur ?? false;
    return (
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element -- loaded by record id from darkroom */}
        <img src={image(record.id)} alt="" loading="lazy" className={`h-full w-full object-cover ${blur ? "blur-md" : ""}`} draggable={false} />
      </span>
    );
  }
  const mark = record.outcome === "deleted" ? "✕" : record.outcome === "omitted" ? "–" : record.outcome === "refused" ? "⊘" : record.outcome === "failed" ? "!" : "·";
  return (
    <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-subheading ${record.outcome === "deleted" || record.outcome === "refused" ? "border-accent-red/40 text-accent-red-ink" : "border-dashed border-border text-muted"}`}>
      {mark}
    </span>
  );
}
