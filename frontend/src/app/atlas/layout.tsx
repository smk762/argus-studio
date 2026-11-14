import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Atlas",
  path: "/atlas/",
  description: "Argus Atlas, stage 6: elevation data baked into georeferenced fantasy-map tiles, from recorded runs.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
