/**
 * The tone system — Prism's "kleur = betekenis" rule, made enforceable by the type checker.
 *
 * Prism has three colour pairs, each with exactly ONE meaning, plus two non-glow states.
 * Rather than exposing decorative props (`variant="primary"`, `color="blue"`), every component
 * that can carry meaning takes a `tone`. You cannot ask for "a blue card" — you ask for an
 * ACTIVE card, and Prism decides what active looks like.
 *
 * Two invariants live here so they live in exactly one place:
 *   1. MAX ONE GLOW PER ELEMENT — `toneShadow()` returns a single shadow class, never a list.
 *   2. Rest = flat elevation; locked = dimmed with no glow at all.
 *
 * See design/prism/DESIGN_SYSTEM.md §1, §4 and the app mapping in CLAUDE.md.
 */

/** A meaningful colour pair. */
export type Tone = "flow" | "glow" | "bloom";

/**
 * Everything an element can be. `rest` = neutral (flat elevation), `locked` = unavailable.
 * In this app: flow = active/busy/selected · glow = completed/validated · bloom = AI/new.
 */
export type ToneState = Tone | "rest" | "locked";

/** True when the state is one of the three meaningful pairs. */
export function isTone(state: ToneState): state is Tone {
  return state === "flow" || state === "glow" || state === "bloom";
}

/**
 * The ONE shadow for a state. Returning a single string — not an array — is what makes
 * "max one glow per element" structurally impossible to violate through this helper.
 */
export function toneShadow(state: ToneState): string {
  switch (state) {
    case "flow":
      return "shadow-glow-flow";
    case "glow":
      return "shadow-glow-glow";
    case "bloom":
      return "shadow-glow-bloom";
    case "locked":
      return "shadow-none";
    case "rest":
      return "shadow-elevation";
  }
}

/** Border treatment: a glow replaces the border (Prism §4), rest/locked keep the stroke. */
export function toneBorder(state: ToneState): string {
  return isTone(state) ? "border-transparent" : "border-stroke";
}

/** Ink colour for text/icons sitting on a wash background. */
export function toneInk(state: ToneState): string {
  switch (state) {
    case "flow":
      return "text-flow-ink";
    case "glow":
      return "text-glow-ink";
    case "bloom":
      return "text-bloom-ink";
    case "locked":
      return "text-ink-faint";
    case "rest":
      return "text-ink-soft";
  }
}

/** Wash (tinted background) for chips, selected nav items, and soft containers. */
export function toneWash(state: ToneState): string {
  switch (state) {
    case "flow":
      return "bg-flow-wash";
    case "glow":
      return "bg-glow-wash";
    case "bloom":
      return "bg-bloom-wash";
    case "locked":
    case "rest":
      return "bg-card-sub";
  }
}

/** The 135° gradient for a filled surface (icon tiles, accent buttons, toggle tracks). */
export function toneGradient(tone: Tone): string {
  switch (tone) {
    case "flow":
      return "bg-grad-flow";
    case "glow":
      return "bg-grad-glow";
    case "bloom":
      return "bg-grad-bloom";
  }
}

/** Readable text colour ON a filled gradient (Prism §1: flow #04314F, glow #4A3200, bloom #3D0A38). */
export function toneOn(tone: Tone): string {
  switch (tone) {
    case "flow":
      return "text-flow-on";
    case "glow":
      return "text-glow-on";
    case "bloom":
      return "text-bloom-on";
  }
}

/** Raw hex for the pair's `from` stop — for canvas/SVG work that can't use classes. */
export const TONE_HEX: Record<Tone, { from: string; to: string; ink: string }> = {
  flow: { from: "#5AB8FF", to: "#7DE3FF", ink: "#0B6FBF" },
  glow: { from: "#FFD854", to: "#FFB07A", ink: "#B57A12" },
  bloom: { from: "#FF8AD8", to: "#C77DFF", ink: "#A5299B" },
};

/** Neutral stroke hex, for SVG edges representing an inactive/locked connection. */
export const REST_HEX = "#D5D9E2";

/**
 * Motion: pick the spring that matches the meaning (design/prism/motion.md).
 * Snappy = direct controls · Flow = selection/hover · Bloom = unlocks & celebration.
 */
export type Spring = "snappy" | "flow" | "bloom";

export function springClasses(spring: Spring): string {
  switch (spring) {
    case "snappy":
      return "duration-snappy ease-snappy";
    case "flow":
      return "duration-flow ease-flow";
    case "bloom":
      return "duration-bloom ease-bloom";
  }
}

/**
 * The spring a state change should play. A node going locked → active shifts to Flow AND plays
 * the Flow spring; an unlock (→ Glow) celebrates with the Bloom spring (motion.md coupling rule).
 */
export function springForState(state: ToneState): Spring {
  return state === "glow" ? "bloom" : "flow";
}


/**
 * Hoe een control beweegt en oplicht als je hem aanwijst en indrukt.
 *
 * Eén constante omdat dit anders in elke met de hand gemaakte knop opnieuw wordt overgetypt — en
 * dan loopt het uiteen: de helft kreeg een spring op `transition-colors`, wat een overshoot-curve
 * op een kleurwaarde is en dus niets doet.
 *
 * Twee snelheden met opzet. De indruk is kort en kwiek (Snappy), kleur en glow lopen op de langere
 * Flow-spring zodat je de overgang écht ziet gebeuren in plaats van dat hij voorbij is voor je hem
 * opmerkt. `prefers-reduced-motion` maakt beide 120ms lineair — dat zit in de tokens.
 */
export const CONTROL_MOTION =
  "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px";

/**
 * Wat een control doet bij hover: wash, ink en één glow uit hetzelfde paar.
 *
 * Iets aanwijzen ís een state — `Card interactive` behandelt het al zo. Een grijstint erbij
 * (`card-sub` op `card`) is vier procent helderheidsverschil; dat ziet niemand, en dan voelt de
 * app dood terwijl er wel degelijk iets gebeurt.
 */
export function hoverGlow(tone: "flow" | "glow" | "bloom" = "flow"): string {
  switch (tone) {
    case "glow":
      return "hover:bg-glow-wash hover:text-glow-ink hover:shadow-glow-glow";
    case "bloom":
      return "hover:bg-bloom-wash hover:text-bloom-ink hover:shadow-glow-bloom";
    default:
      return "hover:bg-flow-wash hover:text-flow-ink hover:shadow-glow-flow";
  }
}
