import { ExternalLink } from "@/components/ExternalLink";
import { packageLinks, shownVersion, type SuitePackage } from "@/lib/madeWith";

/**
 * "Made with" line for a tool page (#171): the package and version behind the
 * view, the command that makes it, and links to the package's handbook page,
 * PyPI and source. Pass the version the page already has (a /health answer or
 * a recording); a page sentinel such as "demo" shows the package without one.
 */
export function MadeWith({
  pkg,
  verb,
  version,
  command,
  className = "",
}: {
  pkg: SuitePackage;
  /** How the package relates to the view, e.g. "Captioned by". */
  verb: string;
  version?: string | null;
  command?: string | null;
  className?: string;
}) {
  const links = packageLinks(pkg);
  const v = shownVersion(version);
  const link = "underline underline-offset-2 hover:text-foreground";
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      {verb}{" "}
      <span className="font-medium text-foreground/80">
        {links.name}
        {v ? ` ${v}` : ""}
      </span>
      {command ? (
        <>
          {" · "}
          <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[11px] text-foreground/80">{command}</code>
        </>
      ) : null}
      {" · "}
      <ExternalLink href={links.docs} className={link}>
        Docs
      </ExternalLink>
      {" · "}
      <ExternalLink href={links.pypi} className={link}>
        PyPI
      </ExternalLink>
      {" · "}
      <ExternalLink href={links.github} className={link}>
        GitHub
      </ExternalLink>
    </p>
  );
}
