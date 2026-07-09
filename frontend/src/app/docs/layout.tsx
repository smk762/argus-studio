import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const metadata: Metadata = {
  title: "Docs · Argus Studio",
  description: "Interactive handbook for the Argus suite — concepts, guides, and live widgets.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Nav active="/docs" />
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-purple/40 bg-accent-purple/20">
                <span className="text-sm font-bold text-accent-purple">A</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">Argus Studio Docs</h1>
                <p className="text-xs text-muted">Interactive handbook for the suite</p>
              </div>
            </div>
          </div>
        </div>
      </header>

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

      <footer className="mt-auto border-t border-border py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted sm:px-6">
          <span>
            Powered by{" "}
            <Link
              href="/"
              className="text-accent-purple transition-colors hover:text-accent-purple/80"
            >
              Argus Studio
            </Link>
          </span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
