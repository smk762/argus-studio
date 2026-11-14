import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { connection } from "next/server";
import "./globals.css";
import { runtimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";
import { DEMO_SITE_URL, STATIC_DEMO } from "@/lib/staticDemo";
import { DemoStrip } from "@/components/DemoStrip";

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

const DESCRIPTION = "Structured captioning and dataset curation for LoRA training";
const DEMO_DESCRIPTION =
  "Argus Studio, the web UI of the Argus suite: acquire, curate, caption, configure, evaluate and bake. " +
  "A static demo with recorded outputs.";

// Per-page titles come from each route's layout.tsx (`<Page> · Argus Studio demo`);
// this template and default cover the rest. Each route sets its own canonical.
export const metadata: Metadata = STATIC_DEMO
  ? {
      metadataBase: new URL(DEMO_SITE_URL),
      title: { default: "Argus Studio demo · Dragonhound Labs", template: "%s · Argus Studio demo" },
      description: DEMO_DESCRIPTION,
      openGraph: {
        type: "website",
        siteName: "Argus Studio",
        description: DEMO_DESCRIPTION,
        images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argus Studio caption view" }],
      },
      twitter: {
        card: "summary_large_image",
        description: DEMO_DESCRIPTION,
        images: ["/og.png"],
      },
    }
  : {
      title: { default: "Argus Studio", template: "%s · Argus Studio" },
      description: DESCRIPTION,
    };

// The browser chrome follows the page (S13). These are the family's --dh-bg values;
// a <meta> can't read a CSS variable.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#121416" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Opt into per-request rendering (see the note at the top of this file).
  if (!STATIC_DEMO) await connection();
  const config = runtimeConfig();
  // Server build: set by src/proxy.ts for this request; absent when ARGUS_CSP=off.
  // The static export has no request (headers() would fail the prerender) and no
  // proxy; scripts/csp.mjs hashes its inline scripts into a <meta> CSP instead.
  const nonce = STATIC_DEMO ? undefined : ((await headers()).get("x-nonce") ?? undefined);
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        {/*
          The family theme script (public/dh-theme.js, a copy of vendor/dh/dh-theme.js).
          A plain blocking <script src>, first in <head>, so the saved choice (the
          `dh-theme` cookie, shared across *.dragonhound.dev) is on <html> before the
          first paint. Not next/script: that would load it after hydration and flash.
          External, so the static export's CSP covers it with 'self' and no hash; the
          server build's nonce + 'strict-dynamic' policy needs the nonce on it.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- blocking on purpose: it must set the theme before first paint */}
        <script src="/dh-theme.js" nonce={nonce} />
        {/* favicon.ico, icon.svg and apple-icon.png sit in src/app/ (argus-cortex brand/mark/favicon/); Next emits their <link> tags. */}
        <link rel="manifest" href="/site.webmanifest" />
        {/*
          Sets the global `runtimeConfig()` reads, so the client sees the same
          values the server just rendered with.

          This is NOT ordered ahead of Next's bundles — React emits their
          `<script async>` tags above this one. It works because config is only
          ever read during render, and React's hydration entry runs later than
          any of them. So: never read config at client module scope (a top-level
          `const BASE = curatorUrl()`) — that would race the async chunks and
          bind localhost on some loads and the real value on others.

          The inline script and dh-theme.js carry the request's CSP nonce from src/proxy.ts;
          Next nonces only its own scripts. If a policy ever blocks this one,
          `runtimeConfig()` logs an error rather than failing quietly.
        */}
        {!STATIC_DEMO && <script nonce={nonce} dangerouslySetInnerHTML={{ __html: runtimeConfigScript(config) }} />}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {STATIC_DEMO && <DemoStrip />}
        {children}
        {/* Static demo only: a devtools console greeting (public/dragonhound-console.js,
            guarded by window.__dragonhound so it logs once per full page load).
            The live build never loads it. The static CSP (scripts/csp.mjs) allows it as 'self'. */}
        {STATIC_DEMO && <Script src="/dragonhound-console.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
