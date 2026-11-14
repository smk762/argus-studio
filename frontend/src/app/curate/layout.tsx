import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Curate",
  path: "/curate/",
  description: "Argus Curator, stage 2: curate a dataset by quality and by face, on a bundled sample scan.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
