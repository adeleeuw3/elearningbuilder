/**
 * NodeCard — the workflow-canvas node. This is where Prism's node-state vocabulary lives
 * (DESIGN_SYSTEM.md §1) and where the app's one genuinely tricky rule is resolved:
 *
 *   A node can be BOTH an AI node (category = Bloom) AND currently running (state = Flow).
 *   Prism allows max one glow, so STATE owns the glow and the category is demoted to a
 *   wash chip. `categoryTone` therefore only tints the small icon tile — never the shadow.
 *
 * Selection is also a Flow state; when selected the node scales 1.03 and plays the Flow
 * spring, exactly as motion.md prescribes.
 */
import * as React from "react";
import { cn } from "./lib/cn";
import {
  isTone,
  springClasses,
  toneBorder,
  toneGradient,
  toneOn,
  toneShadow,
  type Tone,
  type ToneState,
} from "./lib/tone";

export interface NodeCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * Header content. A string renders as the node's name; a node lets callers put a category
   * pill there instead and move the name into the body — the anatomy a learning card needs.
   */
  title: React.ReactNode;
  /** Lifecycle state — owns the glow. */
  state?: ToneState;
  /** What kind of node it is — tints the icon tile only. */
  categoryTone?: Tone | "none";
  icon?: React.ReactNode;
  selected?: boolean;
  /** Drag affordance lives on the header, so the body stays clickable. */
  onHeaderPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * Category border class (e.g. `border-bloom-from`).
   *
   * Category and state are orthogonal, so they use different channels: the border carries the
   * category, the glow carries the state. Prism §4 says a glow replaces the border, which holds
   * when the border is only decoration — here it is information, so it stays and the glow sits
   * on top. Still one glow per element.
   */
  borderClass?: string;
  /** Rendered at the top right of the header — a status dot, checkmark, or count. */
  status?: React.ReactNode;
  /** Rendered below the body, separated by a hairline. */
  footer?: React.ReactNode;
}

export function NodeCard({
  title,
  state = "rest",
  categoryTone = "none",
  icon,
  selected,
  onHeaderPointerDown,
  borderClass,
  status,
  footer,
  className,
  children,
  ...rest
}: NodeCardProps) {
  // Selection is a Flow state and outranks the resting state for the glow.
  const effective: ToneState = selected ? "flow" : state;

  const tile =
    categoryTone === "none"
      ? "bg-card-sub text-ink-soft"
      : cn(toneGradient(categoryTone), toneOn(categoryTone));

  return (
    <div
      className={cn(
        "w-[216px] rounded-card border bg-card",
        toneShadow(effective),
        // Een categorierand wint van de tone-rand: die draagt informatie, geen decoratie.
        borderClass ?? toneBorder(effective),
        // box-shadow blijft BUITEN de transition. Tailwind's box-shadow-declaratie is
        // byte-identiek tussen alle shadow-klassen (dezelfde var()-keten), dus Chromium ziet
        // geen wijziging, start geen transitie én houdt de oude waarde vast: een knoop die van
        // Bloom naar Flow ging (selectie) hield dan zijn Bloom-glow. motion.md schrijft hier
        // toch al alleen transform/opacity voor.
        "transition-[transform,opacity]",
        springClasses("flow"),
        selected && "scale-[1.03]",
        state === "locked" && !selected && "opacity-55",
        className,
      )}
      {...rest}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        className="flex cursor-grab items-center gap-2.5 border-b border-stroke-soft px-3 py-2.5 active:cursor-grabbing"
      >
        <span
          aria-hidden="true"
          className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-control text-xs font-bold", tile)}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
        {status}
        {state === "locked" && !selected && !status && (
          <span className="text-[10px] text-ink-faint">locked</span>
        )}
      </div>
      <div className="flex flex-col gap-2 px-3 py-3 text-xs text-ink-soft">{children}</div>
      {footer && (
        <div className="flex items-center gap-2 border-t border-stroke-soft px-3 py-2 text-[11px] text-ink-faint">
          {footer}
        </div>
      )}
    </div>
  );
}

/** A connection port. Colour = the tone of the data on that wire. */
export function NodePort({
  tone = "rest",
  side,
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: ToneState; side: "in" | "out" }) {
  const ring = isTone(tone)
    ? tone === "flow"
      ? "border-flow-from"
      : tone === "glow"
        ? "border-glow-from"
        : "border-bloom-from"
    : "border-stroke";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute z-10 h-[11px] w-[11px] -translate-y-1/2 rounded-full border-2 bg-card",
        side === "in" ? "-left-1.5" : "-right-1.5",
        ring,
        className,
      )}
      {...rest}
    />
  );
}
