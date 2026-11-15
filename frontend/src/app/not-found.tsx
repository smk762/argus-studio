import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PIPELINE } from "@/lib/pipeline";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/**
 * The 404 page (S8): the same header, tokens and footer as every tool, and a way
 * on to each stage. `/caption` is redirected to `/` by public/_redirects on the
 * static host, since the Caption tab lives at the root.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="/404" logo={{ letter: "?" }} title="Page not found" subtitle="No page at this address" />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h2 className="text-lg font-medium text-foreground">There is no page at this address.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          It may have moved, or the link may be mistyped. Each stage of the pipeline has its own page:
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {PIPELINE.map((stage) => (
            <li key={stage.href}>
              <Link
                href={stage.href}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground transition-colors hover:bg-surface-hover"
              >
                {stage.stage != null && <span className="font-mono text-xs text-muted">{stage.stage}</span>}
                {stage.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter
        poweredBy={
          <Link href="/" className="text-accent-purple-ink">
            Argus Studio
          </Link>
        }
        right="MIT License"
      />
    </div>
  );
}
