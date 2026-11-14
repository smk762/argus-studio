import { notFound } from "next/navigation";

import { PackageSubPage } from "@/components/docs/PackageDoc";
import { PACKAGE_DOCS, packageDocs, subPages } from "@/lib/packageDocs";
import { pageMetadata } from "@/lib/pageMeta";

// Only the imported pages exist; the static export prerenders each one.
export const dynamicParams = false;

export function generateStaticParams() {
  return PACKAGE_DOCS.flatMap((pkg) => subPages(pkg).map((page) => ({ pkg: pkg.short, slug: page.slug })));
}

function find(short: string, slug: string) {
  const pkg = packageDocs(short);
  const page = pkg ? subPages(pkg).find((candidate) => candidate.slug === slug) : undefined;
  return pkg && page ? { pkg, page } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ pkg: string; slug: string }> }) {
  const { pkg: short, slug } = await params;
  const found = find(short, slug);
  return pageMetadata({
    title: found ? `${found.page.title} · ${found.pkg.package} · Docs` : "Packages · Docs",
    path: `/docs/packages/${short}/${slug}/`,
    description: found ? `${found.page.file} from ${found.pkg.package} ${found.pkg.version}, imported from the dev branch.` : undefined,
  });
}

export default async function PackageDocPage({ params }: { params: Promise<{ pkg: string; slug: string }> }) {
  const { pkg: short, slug } = await params;
  const found = find(short, slug);
  if (!found) notFound();
  return <PackageSubPage pkg={found.pkg} page={found.page} />;
}
