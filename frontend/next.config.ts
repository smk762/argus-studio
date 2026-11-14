import path from "node:path";
import { loadEnvConfig } from "@next/env";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Load repo-root `.env` (this file lives in `frontend/`).
loadEnvConfig(path.join(__dirname, ".."));

// `NEXT_PUBLIC_DEMO_STATIC=1` builds the backend-free public demo as a plain
// static export (out/) for a static host such as Cloudflare Pages — see
// src/lib/staticDemo.ts. Unset, the build is the normal per-request server
// (`standalone`) that the published image and compose run.
const staticDemo = process.env.NEXT_PUBLIC_DEMO_STATIC === "1";

const nextConfig: NextConfig = {
  output: staticDemo ? "export" : "standalone",
  // Static hosts serve `/curate/index.html` for `/curate/` and redirect the
  // bare path, so emit directories rather than `curate.html` files.
  ...(staticDemo ? { trailingSlash: true, images: { unoptimized: true } } : {}),
  // The Caption tab is the root page; send the obvious guess there. The static
  // export can't redirect, so public/_redirects does the same on the static host.
  ...(staticDemo ? {} : { redirects: async () => [{ source: "/caption", destination: "/", permanent: true }] }),
  // Let `.mdx` files be treated as routes/pages alongside TS/TSX.
  pageExtensions: ["ts", "tsx", "mdx"],
};

const withMDX = createMDX({
  // Turbopack serializes this config, so remark/rehype plugins must be given
  // as string module names (with optional options), not imported functions.
  options: {
    remarkPlugins: [["remark-gfm", {}]],
  },
});

export default withMDX(nextConfig);
