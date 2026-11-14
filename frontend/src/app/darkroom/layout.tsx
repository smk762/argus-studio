import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Darkroom",
  path: "/darkroom/",
  description: "Argus Darkroom, stage 7: guarded image generation with a record of every attempt.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
