/**
 * Button — Prism §6. Three roles, and the role fixes the colour:
 *   neutral → card background + stroke (the default; most buttons)
 *   accent  → --grad-flow + --glow-flow  (the primary action)
 *   reward  → --grad-glow + --glow-glow  (celebrates: unlock, claim, start assessment)
 *   subtle  → no fill, no elevation (tertiary / cancel)
 *
 * There is deliberately NO `tone` prop and no Bloom button: Bloom means "AI / new content",
 * which is a property of content, not of a control. Keeping the roles closed stops colour
 * from drifting into decoration.
 */
import * as React from "react";
import { cn } from "./lib/cn";

export type ButtonRole = "neutral" | "accent" | "reward" | "subtle";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  role_?: ButtonRole;
  size?: ButtonSize;
  /** Render an icon before the label. */
  icon?: React.ReactNode;
  /** Stretch to the container and centre the label (common in side panels). */
  block?: boolean;
}

/**
 * Hover is een state, geen decoratie.
 *
 * Een knop die je aanwijst is het ding waar je op het punt staat te drukken — dat verdient dezelfde
 * behandeling als een kaart die je aanwijst, en `Card interactive` doet dat al: wash plus
 * Flow-glow. Een neutrale knop krijgt die glow er dus bij in plaats van alleen een grijstint, want
 * `bg-card-sub` op `bg-card` is een verschil van vier procent helderheid — dat ziet niemand.
 *
 * Nog steeds één glow per element: neutraal en subtiel hebben er in rust geen, accent en reward
 * houden die van hun eigen paar.
 */
const ROLE: Record<ButtonRole, string> = {
  neutral:
    "bg-card border-stroke text-ink shadow-elevation hover:bg-flow-wash hover:border-flow-from hover:text-flow-ink hover:shadow-glow-flow",
  accent: "bg-grad-flow border-transparent text-flow-on shadow-glow-flow hover:brightness-110",
  reward: "bg-grad-glow border-transparent text-glow-on shadow-glow-glow hover:brightness-110",
  subtle:
    "bg-transparent border-transparent text-ink-soft hover:bg-flow-wash hover:text-flow-ink hover:shadow-glow-flow",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "text-[12.5px] px-3 py-[7px] gap-1.5",
  md: "text-sm px-4 py-[9px] gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { role_ = "neutral", size = "md", icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center rounded-control border font-semibold",
        // Twee snelheden met opzet: de indruk is kort en kwiek (snappy), de kleur en de glow
        // krijgen de langere Flow-spring zodat je de overgang écht ziet gebeuren in plaats van
        // dat hij al voorbij is voor je hem opmerkt.
        "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow),filter_var(--spring-flow)]",
        "active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
        ROLE[role_],
        SIZE[size],
        block && "w-full justify-center",
        disabled && "opacity-55 pointer-events-none shadow-none",
        className,
      )}
      {...rest}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
});
