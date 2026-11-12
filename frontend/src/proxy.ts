import { NextResponse, type NextRequest } from "next/server";

import { COMPANION_HEADERS, contentSecurityPolicy, CSP_ENV, cspHeaderName, cspMode, newNonce } from "@/lib/csp";

/**
 * Per-request Content-Security-Policy (see lib/csp.ts). A fresh nonce goes on
 * the request as `x-nonce` (the root layout puts it on its inline scripts) and
 * inside the request's own CSP header, which is where Next reads it to nonce
 * its framework scripts. The response carries the policy, enforced or
 * report-only per `ARGUS_CSP`.
 */
export function proxy(request: NextRequest) {
  // Computed key, as in runtimeConfig.ts: a literal process.env.ARGUS_CSP
  // could be fixed at build time, and one image must serve any deployment.
  const env = process.env as Record<string, string | undefined>;
  const mode = cspMode(env[CSP_ENV]);
  const header = cspHeaderName(mode);

  const requestHeaders = new Headers(request.headers);
  let policy: string | null = null;
  if (header) {
    const nonce = newNonce();
    policy = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === "development" });
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (header && policy) response.headers.set(header, policy);
  for (const [name, value] of COMPANION_HEADERS) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not Next's static chunks, image optimisation, the favicon,
      // or the bundled demo samples, and not link prefetches.
      source: "/((?!_next/static|_next/image|favicon.ico|curator-sample|darkroom-sample).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
