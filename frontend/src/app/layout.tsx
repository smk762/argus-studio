import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { runtimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";

/**
 * LOAD-BEARING, not an optimization hint. The API endpoints are read from the
 * container's environment (argus-studio#56); without this the layout is
 * prerendered and the *builder's* env is baked into `window.__ARGUS_ENV__`,
 * regressing #56 with no build error to notice it by.
 *
 * The cost is that every route — including the static `/docs` MDX pages — is
 * server-rendered per request. Serving the config from a dynamic route handler
 * (`<script src="/__env.js">`) instead would let the rest of the app stay
 * static; see argus-studio#56 for why that was deferred.
 *
 * Note Next 16 removes `dynamic` when Cache Components is enabled — turning
 * `cacheComponents: true` on in next.config.ts would silently make this inert.
 */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Argus Vision",
  description: "Structured captioning and dataset curation for LoRA training",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = runtimeConfig();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
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
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript(config) }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
