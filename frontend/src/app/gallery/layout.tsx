import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Gallery",
  path: "/gallery/",
  description: "Argus Quarry, stage 1: a provenance-first public-domain and CC0 acquisition pool.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
