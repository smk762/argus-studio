import { notFound } from "next/navigation";

import { PackageReadme } from "@/components/docs/PackageDoc";
import { PACKAGE_DOCS, packageDocs } from "@/lib/packageDocs";
import { pageMetadata } from "@/lib/pageMeta";

// Only the imported packages exist; the static export prerenders each one.
export const dynamicParams = false;

export function generateStaticParams() {
  return PACKAGE_DOCS.map((pkg) => ({ pkg: pkg.short }));
}

export async function generateMetadata({ params }: { params: Promise<{ pkg: string }> }) {
  const { pkg: short } = await params;
  const pkg = packageDocs(short);
  return pageMetadata({
    title: pkg ? `${pkg.package} · Docs` : "Packages · Docs",
    path: `/docs/packages/${short}/`,
    description: pkg ? `${pkg.package} ${pkg.version}: its README, imported from the dev branch.` : undefined,
  });
}

export default async function PackagePage({ params }: { params: Promise<{ pkg: string }> }) {
  const pkg = packageDocs((await params).pkg);
  if (!pkg) notFound();
  return <PackageReadme pkg={pkg} />;
}
