import { pageMetadata } from "@/lib/pageMeta";

export const metadata = pageMetadata({
  title: "Proof",
  path: "/proof/",
  description: "Argus Proof, stage 5: post-training LoRA evaluation with a keyboard-first human review.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
