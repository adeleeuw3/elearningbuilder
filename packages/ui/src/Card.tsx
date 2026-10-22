/**
 * Card — Prism §6. 8px radius, flat elevation at rest, and ONE glow when state earns it.
 * `locked` dims to .55 with no glow, matching the node-state vocabulary in §1.
 */
import * as React from "react";
import { cn } from "./lib/cn";
import { springClasses, springForState, toneBorder, toneShadow, type ToneState } from "./lib/tone";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: ToneState;
  /** Lift + glow on hover (use for clickable tiles, not static containers). */
  interactive?: boolean;
  /** Larger 12px radius for full panels rather than tiles. */
  panel?: boolean;
}

export function Card({ tone = "rest", interactive, panel, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "border bg-card",
        panel ? "rounded-large" : "rounded-card",
        toneShadow(tone),
        toneBorder(tone),
        "transition-[transform,box-shadow]",
        springClasses(springForState(tone)),
        tone === "locked" && "opacity-55",
        interactive && tone !== "locked" && "cursor-pointer hover:-translate-y-px hover:shadow-glow-flow",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Thumbnail strip for a course/artifact tile — a gradient in the pair's colours (§6). */
export function CardThumb({
  tone = "flow",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "flow" | "glow" | "bloom" }) {
  const grad = tone === "flow" ? "bg-grad-flow" : tone === "glow" ? "bg-grad-glow" : "bg-grad-bloom";
  return (
    <div
      className={cn("aspect-video overflow-hidden rounded-t-card", grad, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
