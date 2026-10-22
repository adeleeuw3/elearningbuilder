/**
 * IconButton — een vierkante control met alleen een teken erin.
 *
 * Bestond niet, en daardoor stonden er dertig met de hand gemaakte `<button>`-elementen in de app
 * die elk hun eigen hover, focus en indruk-gedrag kozen. De helft animeerde `transition-colors` met
 * een spring-easing: een overshoot-curve op een kleur, wat niets betekent en de indruk mist waar de
 * spring voor bedoeld is. Beweging hoort op `transform` (motion.md §Do/Don't).
 *
 * **Hover geeft een glow in de kleur van het paar.** Precies één, en alleen bij hover — in rust
 * draagt deze knop geen state. Dat volgt `Card interactive`, dat hetzelfde doet: iets aanwijzen is
 * een state, en in Prism is een state een glow.
 *
 * **`label` is verplicht.** Een knop met alleen een glyph erin heeft geen toegankelijke naam, en
 * dat is precies de fout die je niet ziet tot iemand met een schermlezer komt. Hier kan hij niet
 * vergeten worden: hij vult `aria-label` én `title`, zodat de muisgebruiker hem ook krijgt.
 */
import * as React from "react";
import { cn } from "./lib/cn";

export type IconButtonTone = "rest" | "flow" | "glow" | "bloom";
export type IconButtonSize = "sm" | "md";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> {
  /** Wat de knop doet. Wordt de toegankelijke naam én de tooltip. */
  label: string;
  tone?: IconButtonTone;
  size?: IconButtonSize;
  /** Zonder rand en achtergrond in rust — voor knoppen ín een kaart of balk. */
  stil?: boolean;
}

/**
 * De hover-behandeling per paar: wash, ink en één glow uit datzelfde paar.
 *
 * In rust draagt deze knop geen glow, bij hover precies één — dus "max één glow per element" blijft
 * staan. De kaart waar de knop óp ligt is een ander element en mag zijn eigen state houden.
 */
const TOON: Record<IconButtonTone, string> = {
  rest: "text-ink-soft hover:bg-flow-wash hover:text-flow-ink hover:shadow-glow-flow",
  flow: "text-flow-ink hover:bg-flow-wash hover:shadow-glow-flow",
  glow: "text-glow-ink hover:bg-glow-wash hover:shadow-glow-glow",
  bloom: "text-bloom-ink hover:bg-bloom-wash hover:shadow-glow-bloom",
};

const MAAT: Record<IconButtonSize, string> = {
  sm: "h-6 w-6 text-[12px]",
  md: "h-[34px] w-[34px] text-[15px]",
};

/**
 * De klassenlijst, als pure functie.
 *
 * Apart van de component zodat de regels in een test afgedwongen kunnen worden zonder een renderer
 * — net als `toneShadow()` en de rest van `lib/tone.ts`. Een `forwardRef`-component is geen
 * aanroepbare functie, en een regel die alleen in JSX bestaat is een regel die niemand bewaakt.
 */
// `| undefined` staat er expliciet bij omdat `exactOptionalPropertyTypes` aanstaat: een prop die
// weggelaten mág worden is dan nog niet hetzelfde als een prop die je `undefined` mag geven, en de
// component geeft ze door zoals hij ze binnenkreeg.
export function iconButtonClasses(opties: {
  tone?: IconButtonTone | undefined;
  size?: IconButtonSize | undefined;
  stil?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
} = {}): string {
  const { tone = "rest", size = "md", stil, disabled, className } = opties;
  return cn(
    "inline-grid shrink-0 place-items-center rounded-control border leading-none",
    // Twee snelheden: de indruk kort (snappy), de kleur en de glow op de langere Flow-spring
    // zodat de overgang zichtbaar is in plaats van voorbij voor je hem ziet.
    "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)]",
    "active:translate-y-px",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
    stil ? "border-transparent bg-transparent" : "border-stroke bg-card shadow-elevation",
    TOON[tone],
    MAAT[size],
    disabled && "pointer-events-none opacity-55 shadow-none",
    className,
  );
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, tone = "rest", size = "md", stil, className, disabled, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={iconButtonClasses({ tone, size, stil, disabled, className })}
        {...rest}
      >
        <span aria-hidden="true">{children}</span>
      </button>
    );
  },
);
