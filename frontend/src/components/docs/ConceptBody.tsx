import { getConcept } from "@/content/concepts";
import { Markdown } from "@/components/Markdown";

/**
 * Renders a concept's body straight from the shared registry, so a doc page
 * and its in-tool ParamInfo can never disagree. Use inside MDX pages.
 */
export function ConceptBody({ id }: { id: string }) {
  const concept = getConcept(id);
  if (!concept) return null;
  return <Markdown tone="prose">{concept.body}</Markdown>;
}
