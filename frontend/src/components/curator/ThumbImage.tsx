"use client";

import { useState } from "react";
import { IS_LIVE } from "@/lib/curatorEnv";
import { thumbUrl } from "@/lib/curatorApi";
import { basename } from "@/lib/path";

/** Deterministic hue from a string (stable per face cluster / path). */
function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

interface Props {
  scanId: string;
  relPath: string;
  faceCluster?: string | null;
  className?: string;
  rounded?: string;
  /** How the image fills its box. "cover" (default) crops; "contain" shows all of it. */
  fit?: "cover" | "contain";
  /**
   * CSS object-position for the "cover" fit — the focal point kept in frame when
   * the tile crops (e.g. "50% 25%" to favour the head). Ignored for "contain".
   */
  objectPosition?: string;
}

/**
 * Thumbnail tile. In `live` mode it loads the curator's WEBP thumb from /thumb;
 * in `demo` mode (or if the image fails to load) it renders a deterministic
 * coloured placeholder keyed by face cluster so identities stay visually
 * distinct without bundling binaries.
 */
export function ThumbImage({
  scanId,
  relPath,
  faceCluster,
  className = "",
  rounded = "",
  fit = "cover",
  objectPosition,
}: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = IS_LIVE && !failed;
  const seed = faceCluster ?? relPath;
  const hue = hueFor(seed);
  const base = basename(relPath);
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbUrl(scanId, relPath)}
        alt={relPath}
        loading="lazy"
        onError={() => setFailed(true)}
        style={fit === "cover" && objectPosition ? { objectPosition } : undefined}
        className={`h-full w-full ${fitClass} ${rounded} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${rounded} ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 45% 22%), hsl(${(hue + 40) % 360} 50% 14%))`,
      }}
      aria-label={relPath}
    >
      <span className="px-2 text-center text-[10px] font-mono leading-tight text-white/70 break-all line-clamp-3">
        {base}
      </span>
    </div>
  );
}
