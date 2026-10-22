/**
 * @ob/ui — the Prism component library.
 *
 * Import tokens once at your app entry:  import "@ob/ui/tokens.css";
 * Then wrap your tree in <PrismApp>.
 *
 * Rules that are enforced here rather than documented and hoped for:
 *   · colour is only reachable through `tone` / role props (no raw colour props),
 *   · `toneShadow()` returns exactly one glow class → max one glow per element,
 *   · rest = flat elevation, locked = .55 opacity with no glow.
 * See design/prism/DESIGN_SYSTEM.md and the app mapping in CLAUDE.md.
 */
export { PrismApp, PRISM_KEYFRAMES } from "./PrismApp";
export { Button, type ButtonProps, type ButtonRole, type ButtonSize } from "./Button";
export {
  IconButton,
  iconButtonClasses,
  type IconButtonProps,
  type IconButtonSize,
  type IconButtonTone,
} from "./IconButton";
export { Chip, type ChipProps } from "./Chip";
export { Bevestiging, type BevestigingProps } from "./Bevestiging";
export { Card, CardThumb, type CardProps } from "./Card";
export { NodeCard, NodePort, type NodeCardProps } from "./NodeCard";
export { NavigationView, type NavigationViewProps, type NavItem } from "./NavigationView";
export {
  ToggleSwitch,
  Slider,
  ProgressBar,
  ProgressRing,
  InfoBar,
  Expander,
  PipsPager,
  type ToggleSwitchProps,
  type SliderProps,
  type ProgressBarProps,
  type ProgressRingProps,
  type InfoBarProps,
  type ExpanderProps,
  type PipsPagerProps,
} from "./controls";

export {
  isTone,
  toneShadow,
  toneBorder,
  toneInk,
  toneWash,
  toneGradient,
  toneOn,
  springClasses,
  CONTROL_MOTION,
  hoverGlow,
  springForState,
  TONE_HEX,
  REST_HEX,
  type Tone,
  type ToneState,
  type Spring,
} from "./lib/tone";
export { cn, type ClassValue } from "./lib/cn";
