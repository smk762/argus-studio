import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Forge",
  path: "/forge/",
  description: "Argus Forge, stage 4: turn a curated export into a ready-to-run LoRA training config, in your browser.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
