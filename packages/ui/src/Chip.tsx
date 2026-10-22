/**
 * Chip / status pill — Prism §6: wash background + ink text + a dot in the pair's colour.
 * The `tone` IS the meaning, so a chip always says something true: `tone="glow"` on a
 * "Published" chip, `tone="bloom"` on "AI generated", `tone="flow"` on "Running".
 */
import * as React from "react";
import { cn } from "./lib/cn";
import { toneInk, toneWash, type ToneState } from "./lib/tone";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ToneState;
  /** Hide the leading dot (for plain metadata chips like "en-US"). */
  noDot?: boolean;
}

export function Chip({ tone = "rest", noDot, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-xs font-semibold",
        toneWash(tone),
        toneInk(tone),
        className,
      )}
      {...rest}
    >
      {!noDot && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
