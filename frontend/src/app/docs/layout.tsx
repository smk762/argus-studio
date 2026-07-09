import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const metadata: Metadata = {
  title: "Docs · Argus Studio",
  description: "Interactive handbook for the Argus suite — concepts, guides, and live widgets.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="/docs"
        logo={{ letter: "A", tone: "purple" }}
        title="Argus Studio Docs"
        subtitle="Interactive handbook for the suite"
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">
            <DocsSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <article className="max-w-3xl">{children}</article>
        </main>
      </div>

      <SiteFooter
        poweredBy={
          <Link
            href="/"
            className="text-accent-purple transition-colors hover:text-accent-purple/80"
          >
            Argus Studio
          </Link>
        }
        right="MIT License"
      />
    </div>
  );
}
