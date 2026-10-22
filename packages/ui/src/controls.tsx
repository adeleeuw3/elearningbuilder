/**
 * The remaining Fluent controls from Prism §6. Each one's colour is fixed by its role, so a
 * developer can't accidentally build a Bloom toggle or a Flow reward bar:
 *
 *   ToggleSwitch → 44×22 pill, ON = --grad-flow + --glow-flow, white thumb
 *   Slider       → 4px track, filled part --grad-bloom, white thumb with --glow-bloom
 *   ProgressBar  → 4px, flow-from → glow-from (busy → nearly done)
 *   ProgressRing → conic gradient in Flow
 *   InfoBar      → rewards/unlocks: --glow-wash + --glow-glow, icon tile in --grad-glow
 *   Expander     → 8px card, chevron rotates 90°
 *   PipsPager    → 8px dots, active dot --grad-glow with glow
 */
import * as React from "react";
import { cn } from "./lib/cn";
import { springClasses } from "./lib/tone";

/* ---------------------------------- ToggleSwitch --------------------------------- */

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({ checked, onChange, label, disabled, className }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-11 shrink-0 rounded-full border transition-colors",
        springClasses("snappy"),
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
        checked ? "border-transparent bg-grad-flow shadow-glow-flow" : "border-stroke bg-card-sub",
        disabled && "pointer-events-none opacity-55",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(27,30,40,.3)]",
          "transition-transform",
          springClasses("flow"),
          checked && "translate-x-[22px]",
        )}
      />
    </button>
  );
}

/* -------------------------------------- Slider ----------------------------------- */

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}

export function Slider({ value, min = 0, max = 100, onChange, label, className }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("relative py-3", className)}>
      <div aria-hidden="true" className="h-1 rounded-full bg-card-sub">
        <div className="h-full rounded-full bg-grad-bloom" style={{ width: `${pct}%` }} />
      </div>
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-glow-bloom"
        style={{ left: `${pct}%` }}
      />
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

/* ------------------------------------ ProgressBar -------------------------------- */

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1 overflow-hidden rounded-full bg-card-sub", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-[linear-gradient(90deg,#5AB8FF,#FFD854)] transition-[width]",
          springClasses("flow"),
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ----------------------------------- ProgressRing -------------------------------- */

export interface ProgressRingProps {
  /** 0..1. Ignored when `indeterminate` is set. */
  value?: number;
  label?: string;
  /** Show the rounded percentage in the middle. */
  showValue?: boolean;
  /**
   * Spinning, no known progress — for waits whose length you can't predict.
   * Prism describes the ProgressRing as "draaiend" (§6), and inventing a percentage for an
   * unknown wait misinforms the reader, so this is the honest mode for that case. Omits
   * `aria-valuenow`, which is what tells assistive tech the value is indeterminate.
   */
  indeterminate?: boolean;
  /** Diameter in px. Defaults to the 30px control size. */
  size?: number;
  className?: string;
}

export function ProgressRing({
  value = 0,
  label,
  showValue = true,
  indeterminate,
  size = 30,
  className,
}: ProgressRingProps) {
  const frac = indeterminate ? 0.25 : Math.min(1, Math.max(0, value));
  const pct = Math.round(frac * 100);
  const inner = Math.max(8, Math.round(size * 0.73));

  return (
    <span
      role="progressbar"
      {...(indeterminate ? {} : { "aria-valuenow": pct })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        indeterminate && "shadow-glow-flow motion-safe:animate-spin",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#5AB8FF 0turn, #7DE3FF ${frac}turn, #F1F3F7 ${frac}turn)`,
      }}
    >
      <span
        className="grid place-items-center rounded-full bg-card font-bold text-flow-ink"
        style={{ width: inner, height: inner, fontSize: Math.max(9, Math.round(size * 0.32)) }}
      >
        {!indeterminate && showValue ? `${pct}%` : null}
      </span>
    </span>
  );
}

/* -------------------------------------- InfoBar ---------------------------------- */

export interface InfoBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon?: React.ReactNode;
  /** Pass false to skip the celebratory Bloom entrance (e.g. in a static gallery). */
  animate?: boolean;
}

export function InfoBar({ title, icon = "★", animate = true, className, children, ...rest }: InfoBarProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-card border border-transparent bg-glow-wash p-3.5 shadow-glow-glow",
        animate && "motion-safe:animate-[prism-bloom-in_420ms_both]",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-grad-glow text-[15px] text-glow-on"
      >
        {icon}
      </span>
      <span className="text-[13.5px] text-glow-on">
        <b className="block">{title}</b>
        {children}
      </span>
    </div>
  );
}

/* ------------------------------------- Expander ---------------------------------- */

export interface ExpanderProps {
  summary: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Expander({ summary, defaultOpen, className, children }: ExpanderProps) {
  return (
    <details
      open={defaultOpen}
      className={cn("group overflow-hidden rounded-card border border-stroke bg-card", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-[13.5px] font-semibold [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={cn(
            "text-ink-faint transition-transform group-open:rotate-90",
            springClasses("snappy"),
          )}
        >
          ›
        </span>
        {summary}
      </summary>
      <div className="px-3.5 pb-3.5 text-[13px] text-ink-soft">{children}</div>
    </details>
  );
}

/* ------------------------------------ PipsPager ---------------------------------- */

export interface PipsPagerProps {
  count: number;
  activeIndex: number;
  onSelect?: (index: number) => void;
  className?: string;
}

export function PipsPager({ count, activeIndex, onSelect, className }: PipsPagerProps) {
  return (
    <div className={cn("flex gap-[7px]", className)}>
      {Array.from({ length: count }, (_, i) => {
        const active = i === activeIndex;
        const cls = cn(
          "h-2 w-2 rounded-full transition-[background,box-shadow]",
          springClasses("flow"),
          active ? "bg-grad-glow shadow-glow-glow" : "bg-card-sub",
        );
        return onSelect ? (
          <button key={i} aria-label={`Go to ${i + 1}`} aria-current={active} onClick={() => onSelect(i)} className={cls} />
        ) : (
          <span key={i} aria-hidden="true" className={cls} />
        );
      })}
    </div>
  );
}
