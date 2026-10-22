/**
 * AddNodeMenu — searchable node palette. Closes on Escape and on outside click, and traps
 * nothing: it is a menu, not a dialog, so focus stays where the author put it.
 */
"use client";

import * as React from "react";
import { cn, toneGradient, toneOn } from "@ob/ui";
import { CATEGORY_TONE, NODE_LIBRARY, type NodeCategory } from "../../lib/pipeline";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, category: NodeCategory) => void;
}

const CATEGORY_ICON: Record<NodeCategory, string> = {
  source: "◧",
  generate: "✶",
  transform: "⇄",
  logic: "⑂",
  composite: "▦",
  output: "⇥",
};

export function AddNodeMenu({ open, onClose, onAdd }: Props) {
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !(t as HTMLElement).closest?.("[data-add-trigger]")) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const groups = NODE_LIBRARY.map((g) => ({
    ...g,
    items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Add a node"
      className={cn(
        "absolute bottom-[68px] left-1/2 z-30 w-[308px] -translate-x-1/2",
        "rounded-card border border-stroke bg-card p-2 shadow-elevation",
        "motion-safe:animate-[prism-bloom-in_420ms_both]",
      )}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search nodes or models…"
        aria-label="Search nodes"
        className="w-full rounded-control border border-stroke bg-card px-2.5 py-2 text-[13px] text-ink focus:border-flow-from focus:shadow-glow-flow focus:outline-none"
      />
      <div className="max-h-[264px] overflow-y-auto">
        {groups.length === 0 && (
          <p className="px-2 py-4 text-center text-[12.5px] text-ink-faint">
            No nodes match “{query}”.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.group}>
            <span className="mx-2 mb-1 mt-2.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              {g.group}
            </span>
            {g.items.map((item) => {
              const tone = CATEGORY_TONE[item.category];
              return (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    onAdd(item.label, item.category);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] transition-colors duration-snappy ease-snappy hover:bg-card-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-control text-[10px]",
                      tone === "none" ? "bg-card-sub text-ink-soft" : cn(toneGradient(tone), toneOn(tone)),
                    )}
                  >
                    {CATEGORY_ICON[item.category]}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
