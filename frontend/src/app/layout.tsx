import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { resolveRuntimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";

/**
 * The API endpoints are read from the container's environment on every request
 * (argus-studio#56), so nothing here may be prerendered at build time.
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
  const config = resolveRuntimeConfig(process.env as Record<string, string | undefined>);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        {/*
          Must run before the client bundle evaluates, so `runtimeConfig()` sees
          the same values the server just rendered with. A plain inline script in
          <head> is ordered ahead of Next's deferred bundles; next/script's
          beforeInteractive strategy would work too but pulls in the loader.
        */}
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript(config) }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
