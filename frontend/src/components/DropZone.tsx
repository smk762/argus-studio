"use client";

import { useRef, useState } from "react";

interface Props {
  /** Called with the dropped/picked files (already filtered by `filter` if given). */
  onFiles: (files: File[]) => void;
  /** `accept` attribute for the click-to-browse file input. */
  accept?: string;
  multiple?: boolean;
  /** Keep only matching files from a drop (e.g. images). Defaults to keeping all. */
  filter?: (file: File) => boolean;
  label: string;
  hint?: string;
}

/** Dashed drop target that also opens a file picker on click. */
export function DropZone({ onFiles, accept, multiple = true, filter, label, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const emit = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter(filter ?? (() => true));
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        emit(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
        over
          ? "border-accent-purple bg-accent-purple/10"
          : "border-border bg-surface hover:border-accent-purple/50 hover:bg-surface-hover"
      }`}
    >
      <svg className="h-6 w-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <span className="text-sm font-medium text-foreground/90">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
