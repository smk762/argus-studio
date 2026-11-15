import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Caption",
  path: "/",
  description: "Argus Lens, stage 3 of the Argus pipeline: structured image captions for LoRA training, from one recorded run.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
