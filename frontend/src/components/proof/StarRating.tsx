"use client";

/**
 * A 1–5 star rating. Click a star to set; click the current rating again to
 * clear it. Keyboard throughput (number keys, arrows) is driven by the review
 * board that owns the focused image — this stays a controlled presentational
 * widget so the same rating shows whether it was set by mouse or keyboard.
 */
interface StarRatingProps {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function StarRating({ value, onChange, size = "md", disabled = false }: StarRatingProps) {
  const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value != null && star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === star ? null : star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            aria-pressed={filled}
            className={`transition-colors disabled:opacity-40 ${
              filled ? "text-accent-amber" : "text-muted/40 hover:text-accent-amber/60"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={dim}>
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
