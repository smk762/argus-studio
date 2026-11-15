"use client";

import { ApiVersionBadge } from "@/components/ApiVersionBadge";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ComposeForm } from "@/components/darkroom/ComposeForm";
import { ComposePane } from "@/components/darkroom/ComposePane";
import { ComposeProvider, useCompose, type DarkroomView } from "@/components/darkroom/ComposeProvider";
import { DarkroomProvider, useDarkroom } from "@/components/darkroom/DarkroomProvider";
import { HealthCard } from "@/components/darkroom/HealthCard";
import { History } from "@/components/darkroom/History";
import { RecordView } from "@/components/darkroom/RecordView";
import { Button, Card } from "@/components/darkroom/ui";
import { archiveUrl, DARKROOM_READ_ONLY_REASON } from "@/lib/darkroomApi";
import { ExternalLink } from "@/components/ExternalLink";
import { DemoBadge, RecordedDemoNote } from "@/components/DemoChrome";
import { STATIC_DEMO } from "@/lib/staticDemo";
import { MadeWith } from "@/components/MadeWith";
import { darkroomGenerateCommand } from "@/lib/madeWith";
import { BranchHandoffs } from "@/components/BranchHandoffs";

export default function DarkroomPage() {
  return (
    <DarkroomProvider>
      <ComposeProvider>
        <DarkroomStage />
      </ComposeProvider>
    </DarkroomProvider>
  );
}

const TABS: { view: DarkroomView; label: string }[] = [
  { view: "generate", label: "Generate" },
  { view: "history", label: "History" },
];

function DarkroomStage() {
  const { health, error, sample } = useDarkroom();
  const { view, setView, recordId, closeRecord, compose } = useCompose();
  // null = loading, "" = unreachable, else the server version.
  const version = error ? "" : (health?.version ?? null);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/darkroom"
        logo={{ letter: "D" }}
        title="Argus Darkroom"
        subtitle="Guarded image generation, with a record of every attempt"
        badge={
          STATIC_DEMO ? (
            <DemoBadge state="sample" title="No argus-darkroom in this build: a bundled, read-only sample history." />
          ) : (
            <ApiVersionBadge label="argus-darkroom" version={version} prefix={sample ? "" : "v"} />
          )
        }
      />

      <main id="main" tabIndex={-1} className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <MadeWith
          pkg="darkroom"
          verb="Guarded by"
          version={sample ? null : version}
          command={darkroomGenerateCommand(compose.enforcingPolicy || health?.default_policy)}
          className="lg:col-span-2"
        />
        {/* Darkroom branches rather than handing on to one next stage (#236):
            back to Forge, or out to Mask and Assay when they are deployed. */}
        <BranchHandoffs from="/darkroom" className="-mt-4 lg:col-span-2" />
        <aside className="space-y-4">
          <HealthCard />
          {sample ? (
            STATIC_DEMO ? (
              <RecordedDemoNote summary="A bundled, read-only darkroom history.">
                Canned verdicts on flat drawings, to show the record view. Generating needs a running argus-darkroom
                (the darkroom compose profile).
              </RecordedDemoNote>
            ) : (
              <CapabilityNotice reason="No darkroom is answering, so this is a bundled read-only sample: canned verdicts on flat drawings. Start the darkroom profile to generate." />
            )
          ) : health?.read_only ? (
            <CapabilityNotice reason={DARKROOM_READ_ONLY_REASON} />
          ) : null}
          <Card>
            <ComposeForm />
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          <nav className="flex flex-wrap items-center gap-2" aria-label="Darkroom views">
            {TABS.map((tab) => (
              <Button
                key={tab.view}
                small
                aria-pressed={view === tab.view && !recordId}
                tone={view === tab.view && !recordId ? "primary" : "neutral"}
                onClick={() => {
                  closeRecord();
                  setView(tab.view);
                }}
              >
                {tab.label}
              </Button>
            ))}
            {/* Server-only: the static demo has no darkroom to zip, and its prerendered HTML
                can't wait for `sample` to settle, so it never offers the link at all. */}
            {sample || STATIC_DEMO ? null : (
              <a
                href={archiveUrl()}
                className="ml-auto text-xs text-muted underline decoration-border underline-offset-2 hover:text-foreground"
                title="Every record and stored image, as a zip"
              >
                Download archive
              </a>
            )}
          </nav>

          {recordId ? <RecordView key={recordId} id={recordId} /> : view === "history" ? <History /> : <ComposePane />}
        </div>
      </main>

      <SiteFooter
        poweredBy={
          <ExternalLink
            href="https://github.com/smk762/argus-darkroom"
            className="text-accent-purple-ink transition-colors hover:text-accent-purple-ink"
          >
            argus-darkroom
          </ExternalLink>
        }
        right="MIT License"
      />
    </div>
  );
}
