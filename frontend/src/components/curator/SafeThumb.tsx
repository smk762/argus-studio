"use client";

import { useState } from "react";
import { thumbSafety } from "@/lib/curatorSafety";
import type { ImageResult } from "./types";
import { faceFocalPoint } from "./types";
import { ThumbImage } from "./ThumbImage";

interface Props {
  scanId: string;
  img: ImageResult;
  /** The finished scan ran NudeNet (`nsfw_config.enabled`). */
  nsfwRan: boolean;
  fit?: "cover" | "contain";
  rounded?: string;
  /**
   * Click on the picture itself (not the reveal control). Omit when the
   * picture should not be a button, as in the detail view.
   */
  onActivate?: () => void;
}

/**
 * A thumbnail with the blur veil. The reveal control is a sibling of the
 * picture button, so it is not nested inside it.
 */
export function SafeThumb({ scanId, img, nsfwRan, fit = "cover", rounded = "", onActivate }: Props) {
  const safety = thumbSafety(img, nsfwRan);
  // The path that was revealed, not a boolean: navigating to another frame
  // stops matching and the veil comes back without resetting state in an effect.
  const [revealedPath, setRevealedPath] = useState<string | null>(null);
  const revealed = revealedPath === img.rel_path;
  const hidden = safety.blurred && !(revealed && safety.revealable);
  const picture = (
    <div className={`h-full w-full ${hidden ? "scale-105 blur-2xl" : ""}`}>
      <ThumbImage
        scanId={scanId}
        relPath={img.rel_path}
        faceCluster={img.primary_face_cluster}
        objectPosition={faceFocalPoint(img)}
        fit={fit}
        rounded={rounded}
      />
    </div>
  );

  return (
    <div className={`relative h-full w-full ${rounded}`}>
      {onActivate ? (
        <button type="button" onClick={onActivate} className="block h-full w-full cursor-pointer text-left">
          {picture}
        </button>
      ) : (
        picture
      )}
      {hidden && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/45 p-2 text-center"
          title={safety.reason}
        >
          <span className="text-[10px] font-medium leading-tight text-white/90">{safety.label}</span>
          {safety.revealable && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRevealedPath(img.rel_path);
              }}
              className="pointer-events-auto cursor-pointer rounded border border-white/40 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-black/80"
            >
              Reveal
            </button>
          )}
        </div>
      )}
      {!hidden && safety.blurred && safety.revealable && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealedPath(null);
          }}
          title="Blur again"
          className="absolute left-1/2 top-1 z-20 -translate-x-1/2 cursor-pointer rounded border border-white/40 bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/80"
        >
          Blur
        </button>
      )}
    </div>
  );
}
