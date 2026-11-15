/** A chunk's `z/x/y` and the recipe it was baked from. Renders nothing for a plain canvas. */
export function JobBadges({
  chunk,
  recipe,
  recipeTitle,
  className = "",
}: {
  chunk?: string | null;
  recipe?: string | null;
  recipeTitle?: string;
  className?: string;
}) {
  if (!chunk && !recipe) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {chunk && (
        <span title="XYZ tile of this chunk" className="rounded border border-accent-blue/40 px-1 font-mono text-[10px] text-accent-blue-ink">
          {chunk}
        </span>
      )}
      {recipe && (
        <span
          title={recipeTitle ? `Recipe ${recipeTitle}` : "Style recipe"}
          className="max-w-full truncate rounded border border-accent-amber/40 px-1 font-mono text-[10px] text-accent-amber-ink"
        >
          {recipe}
        </span>
      )}
    </span>
  );
}
