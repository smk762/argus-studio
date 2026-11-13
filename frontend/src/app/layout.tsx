import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { connection } from "next/server";
import "./globals.css";
import { runtimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";
import { THEME_BOOT } from "@/lib/theme";
import { DEMO_SITE_URL, STATIC_DEMO } from "@/lib/staticDemo";
import { DemoBanner } from "@/components/DemoChrome";

/*
 * LOAD-BEARING: the layout must render per request, not at build time. The API
 * endpoints are read from the container's environment (argus-studio#56); if the
 * layout were prerendered, the *builder's* env would be baked into
 * `window.__ARGUS_ENV__`, regressing #56 with no build error to notice it by.
 *
 * That used to be `export const dynamic = "force-dynamic"`. It is now the
 * `await connection()` in RootLayout, because segment config must be a literal
 * and the static demo export (NEXT_PUBLIC_DEMO_STATIC=1, lib/staticDemo.ts) needs
 * the opposite: it has no server and no per-request config, so it is
 * prerendered. The branch is on a build-time constant, never on runtime env, and
 * `npm run build` still lists every route as dynamic (ƒ).
 *
 * The cost is that every route — including the static `/docs` MDX pages — is
 * server-rendered per request. Serving the config from a dynamic route handler
 * (`<script src="/__env.js">`) instead would let the rest of the app stay
 * static; see argus-studio#56 for why that was deferred.
 *
 * Note Next 16 changes request-time semantics when Cache Components is enabled —
 * turn `cacheComponents: true` on in next.config.ts only after re-checking that
 * `npm run build` still lists every route as dynamic.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Structured captioning and dataset curation for LoRA training";
const DEMO_DESCRIPTION =
  "Argus Studio, the web UI of the Argus suite: acquire, curate, caption, configure, evaluate and bake. " +
  "A static demo with recorded outputs.";

export const metadata: Metadata = STATIC_DEMO
  ? {
      metadataBase: new URL(DEMO_SITE_URL),
      title: "Argus Studio — demo",
      description: DEMO_DESCRIPTION,
      alternates: { canonical: "/" },
      openGraph: {
        type: "website",
        url: DEMO_SITE_URL,
        siteName: "Argus Studio",
        title: "Argus Studio — demo",
        description: DEMO_DESCRIPTION,
        images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argus Studio caption view" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Argus Studio — demo",
        description: DEMO_DESCRIPTION,
        images: ["/og.png"],
      },
    }
  : {
      title: "Argus Vision",
      description: DESCRIPTION,
    };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Opt into per-request rendering (see the note at the top of this file).
  if (!STATIC_DEMO) await connection();
  const config = runtimeConfig();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* First in <head>, and it blocks parsing: a saved theme lands before anything paints. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/*
          Sets the global `runtimeConfig()` reads, so the client sees the same
          values the server just rendered with.

          This is NOT ordered ahead of Next's bundles — React emits their
          `<script async>` tags above this one. It works because config is only
          ever read during render, and React's hydration entry runs later than
          any of them. So: never read config at client module scope (a top-level
          `const BASE = curatorUrl()`) — that would race the async chunks and
          bind localhost on some loads and the real value on others.

          The tag also carries no CSP nonce, since Next only nonces its own
          scripts and `<Script>` components. Under a `script-src` policy this is
          blocked and `runtimeConfig()` logs an error rather than failing quietly.
        */}
        {!STATIC_DEMO && <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript(config) }} />}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {STATIC_DEMO && <DemoBanner />}
        {children}
        {/* Static demo only: a devtools console greeting (public/dragonhound-console.js,
            guarded by window.__dragonhound so it logs once per full page load).
            The live build never loads it. No CSP is set on the static host. */}
        {STATIC_DEMO && <Script src="/dragonhound-console.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
