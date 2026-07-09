import path from "node:path";
import { loadEnvConfig } from "@next/env";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Load repo-root `.env` (this file lives in `frontend/`).
loadEnvConfig(path.join(__dirname, ".."));

const nextConfig: NextConfig = {
  output: "standalone",
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
