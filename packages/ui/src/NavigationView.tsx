/**
 * NavigationView — Prism §6: a vertical rail where the selected item gets a left vertical
 * strip in --grad-flow WITH glow, plus a --flow-wash background. The strip grows via the
 * Flow spring so the glow "springs on" (motion.md).
 */
import * as React from "react";
import { cn } from "./lib/cn";
import { springClasses } from "./lib/tone";

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface NavigationViewProps {
  items: readonly NavItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Insert a divider after these item ids. */
  dividerAfter?: readonly string[];
  className?: string;
  label?: string;
}

export function NavigationView({
  items,
  selectedId,
  onSelect,
  dividerAfter = [],
  className,
  label = "Sections",
}: NavigationViewProps) {
  return (
    <nav
      role="tablist"
      aria-label={label}
      aria-orientation="vertical"
      className={cn("rounded-large border border-stroke bg-card p-2 shadow-elevation", className)}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <React.Fragment key={item.id}>
            <button
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(item.id)}
              className={cn(
                "relative flex w-full items-center gap-2.5 rounded-control py-2.5 pl-3.5 pr-3 text-left text-sm",
                "transition-[background-color,color]",
                springClasses("snappy"),
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                selected
                  ? "bg-flow-wash font-semibold text-flow-ink"
                  : "font-medium text-ink-soft hover:bg-card-sub hover:text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-full bg-grad-flow",
                  "transition-[height,box-shadow]",
                  springClasses("flow"),
                  selected ? "h-[60%] shadow-glow-flow" : "h-0",
                )}
              />
              {item.icon ? (
                <span aria-hidden="true" className="w-5 text-center text-sm">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </button>
            {dividerAfter.includes(item.id) && (
              <div aria-hidden="true" className="mx-1.5 my-2 h-px bg-stroke-soft" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
