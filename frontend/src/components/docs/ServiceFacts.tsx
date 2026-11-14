import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { ExternalLink } from "@/components/ExternalLink";
import { SERVICES, getService, serviceHref } from "@/content/services";

const LINK_CLASS =
  "text-accent-purple-ink underline decoration-dotted underline-offset-2 hover:text-accent-purple-ink transition-colors";

/**
 * A service page's facts, straight from the registry: who uses it and the
 * config each package reads, then the official guides. The page's own MDX adds
 * the setup prose around it.
 */
export function ServiceFacts({ id }: { id: string }) {
  const service = getService(id);
  if (!service) return null;
  return (
    <>
      <Markdown tone="prose">{service.summary}</Markdown>

      <h2 id="used-by" className="text-xl font-semibold text-foreground mt-10 mb-3 scroll-mt-24">
        Used by
      </h2>
      <div className="my-4 overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-foreground">Package</th>
              <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-foreground">What for</th>
              <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-foreground">Reads</th>
            </tr>
          </thead>
          <tbody>
            {service.usedBy.map((u) => (
              <tr key={`${u.pkg}-${u.role}`}>
                <td className="border border-border px-3 py-2 align-top whitespace-nowrap">
                  {u.docs ? (
                    <ExternalLink href={u.docs} className={LINK_CLASS}>
                      {u.pkg}
                    </ExternalLink>
                  ) : (
                    <span className="text-foreground/80">{u.pkg}</span>
                  )}
                </td>
                <td className="border border-border px-3 py-2 align-top">
                  <Markdown tone="prose">{u.role}</Markdown>
                </td>
                <td className="border border-border px-3 py-2 align-top">
                  <Markdown tone="prose">{u.config.length ? u.config.map((c) => `\`${c}\``).join(", ") : "—"}</Markdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="official-guides" className="text-xl font-semibold text-foreground mt-10 mb-3 scroll-mt-24">
        Official guides
      </h2>
      <ul className="my-3 ml-5 list-disc space-y-1.5 text-sm text-foreground/80 marker:text-muted">
        {service.guides.map((g) => (
          <li key={g.url} className="pl-1">
            <ExternalLink href={g.url} className={LINK_CLASS}>
              {g.label}
            </ExternalLink>
            {g.note ? <span className="text-muted">: {g.note}</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Every service, one line each, for the section overview. */
export function ServiceIndex() {
  return (
    <div className="my-4 overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-foreground">Service</th>
            <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-foreground">Used by</th>
          </tr>
        </thead>
        <tbody>
          {SERVICES.map((s) => (
            <tr key={s.id}>
              <td className="border border-border px-3 py-2 align-top">
                <Link href={serviceHref(s.id)} className={LINK_CLASS}>
                  {s.title}
                </Link>
              </td>
              <td className="border border-border px-3 py-2 align-top text-foreground/80">
                {[...new Set(s.usedBy.map((u) => u.pkg))].join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
