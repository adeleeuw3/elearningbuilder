/**
 * PrismApp — the root wrapper. Prism's tokens.css expects the class `prism-app` on the
 * highest wrapper (canvas colour, ambient corner gradients, font, ink).
 *
 * Also declares the two keyframes the components reference, so consumers don't have to
 * remember to add them: `prism-bloom-in` (InfoBar / celebratory entrances) and
 * `prism-breathe` (an unexplored hotspot inviting attention). Both are wrapped in
 * motion-safe at the point of use.
 */
import * as React from "react";
import { cn } from "./lib/cn";

export interface PrismAppProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PrismApp({ className, children, ...rest }: PrismAppProps) {
  return (
    <div className={cn("prism-app min-h-screen", className)} {...rest}>
      <style>{PRISM_KEYFRAMES}</style>
      {children}
    </div>
  );
}

export const PRISM_KEYFRAMES = `
@keyframes prism-bloom-in {
  from { opacity: 0; transform: translateY(12px) scale(.96); }
  to   { opacity: 1; transform: none; }
}
@keyframes prism-breathe {
  0%, 100% { opacity: .5; }
  50%      { opacity: 1; }
}
`;
