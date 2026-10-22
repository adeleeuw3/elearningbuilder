/**
 * These tests encode Prism's rules as executable contracts. If someone later "helpfully" makes
 * toneShadow() return two glows, or gives locked a glow, CI fails instead of the canvas quietly
 * getting noisy.
 *
 * Prism §4: "Regel: max. één glowkleur per element."
 * Prism §1: locked → no glow, opacity .55.  Rest → flat elevation.
 */
import { describe, it, expect } from "vitest";
import { iconButtonClasses } from "../index";
import {
  isTone,
  springForState,
  toneBorder,
  toneGradient,
  toneInk,
  toneOn,
  toneShadow,
  toneWash,
  TONE_HEX,
  type Tone,
  type ToneState,
} from "../lib/tone";

const ALL_STATES: ToneState[] = ["flow", "glow", "bloom", "rest", "locked"];
const TONES: Tone[] = ["flow", "glow", "bloom"];
const GLOW_CLASSES = ["shadow-glow-flow", "shadow-glow-glow", "shadow-glow-bloom"];

describe("max one glow per element (Prism §4)", () => {
  it.each(ALL_STATES)("%s resolves to exactly one shadow class", (state) => {
    const shadow = toneShadow(state);
    expect(shadow.trim().split(/\s+/)).toHaveLength(1);
  });

  it.each(ALL_STATES)("%s never yields more than one glow colour", (state) => {
    const shadow = toneShadow(state);
    const glows = GLOW_CLASSES.filter((g) => shadow.includes(g));
    expect(glows.length).toBeLessThanOrEqual(1);
  });
});

describe("non-glow states (Prism §1)", () => {
  it("rest is a flat elevation, not a glow", () => {
    expect(toneShadow("rest")).toBe("shadow-elevation");
    expect(GLOW_CLASSES.some((g) => toneShadow("rest").includes(g))).toBe(false);
  });

  it("locked has no shadow at all", () => {
    expect(toneShadow("locked")).toBe("shadow-none");
  });

  it("only meaningful pairs drop the border for a glow", () => {
    for (const t of TONES) expect(toneBorder(t)).toBe("border-transparent");
    expect(toneBorder("rest")).toBe("border-stroke");
    expect(toneBorder("locked")).toBe("border-stroke");
  });
});

describe("tone plumbing is total and distinct", () => {
  it("isTone narrows correctly", () => {
    for (const t of TONES) expect(isTone(t)).toBe(true);
    expect(isTone("rest")).toBe(false);
    expect(isTone("locked")).toBe(false);
  });

  it("every state maps to ink and wash", () => {
    for (const s of ALL_STATES) {
      expect(toneInk(s)).toMatch(/^text-/);
      expect(toneWash(s)).toMatch(/^bg-/);
    }
  });

  it("each pair has a distinct gradient, on-colour and shadow", () => {
    const grads = new Set(TONES.map(toneGradient));
    const ons = new Set(TONES.map(toneOn));
    const shadows = new Set(TONES.map(toneShadow));
    expect(grads.size).toBe(3);
    expect(ons.size).toBe(3);
    expect(shadows.size).toBe(3);
  });

  it("hex values match the Prism token file exactly", () => {
    expect(TONE_HEX.flow).toEqual({ from: "#5AB8FF", to: "#7DE3FF", ink: "#0B6FBF" });
    expect(TONE_HEX.glow).toEqual({ from: "#FFD854", to: "#FFB07A", ink: "#B57A12" });
    expect(TONE_HEX.bloom).toEqual({ from: "#FF8AD8", to: "#C77DFF", ink: "#A5299B" });
  });
});

describe("motion coupling (motion.md)", () => {
  it("unlocks (→ Glow) celebrate with the Bloom spring", () => {
    expect(springForState("glow")).toBe("bloom");
  });

  it("becoming active uses the Flow spring", () => {
    expect(springForState("flow")).toBe("flow");
    expect(springForState("rest")).toBe("flow");
  });
});

/* ------------------------------------------------------------------ IconButton */

describe("IconButton", () => {
  const klassen = iconButtonClasses;

  it("zet de spring op transform, niet op kleur alleen", () => {
    // Een overshoot-curve op een kleur betekent niets; de indruk hoort op transform te zitten.
    const c = klassen();
    expect(c).toContain("transform_var(--spring-snappy)");
    expect(c).toContain("active:translate-y-px");
    expect(c).not.toContain("transition-colors");
  });

  it("gebruikt voor de indruk de snappy spring — dit is een directe control", () => {
    // motion.md: Snappy voor knop/toggle/chip. Bloom hoort bij vieringen, niet bij een klik.
    const c = klassen();
    expect(c).toContain("transform_var(--spring-snappy)");
    expect(c).not.toContain("transform_var(--spring-bloom)");
  });

  it("geeft bij hover een wash én een glow in de kleur van het paar", () => {
    // Eerder stond hier dat een icoonknop nooit een glow krijgt. Die regel is bewust omgedraaid:
    // iets aanwijzen ís een state, en `Card interactive` behandelt dat al zo (wash + Flow-glow).
    // Een knop die je aanwijst is het ding waar je op het punt staat te drukken.
    expect(klassen({ tone: "flow" })).toContain("hover:shadow-glow-flow");
    expect(klassen({ tone: "glow" })).toContain("hover:shadow-glow-glow");
    expect(klassen({ tone: "bloom" })).toContain("hover:shadow-glow-bloom");
    expect(klassen({ tone: "rest" })).toContain("hover:shadow-glow-flow");

    expect(klassen({ tone: "flow" })).toContain("hover:bg-flow-wash");
    expect(klassen({ tone: "glow" })).toContain("hover:bg-glow-wash");
    expect(klassen({ tone: "bloom" })).toContain("hover:bg-bloom-wash");
  });

  it("draagt nooit twee glowkleuren tegelijk", () => {
    // DESIGN_SYSTEM §4. De hover-glow is er één, en in rust is er geen.
    for (const tone of ["rest", "flow", "glow", "bloom"] as const) {
      const soorten = (klassen({ tone }).match(/shadow-glow-(flow|glow|bloom)/g) ?? [])
        .map((m) => m.replace("shadow-glow-", ""));
      expect(new Set(soorten).size, tone).toBeLessThanOrEqual(1);
    }
  });

  it("laat de kleur trager lopen dan de indruk, zodat je de overgang ziet", () => {
    // Eén duur voor alles betekent dat de kleurwissel voorbij is voor hij opvalt; de indruk moet
    // juist kort zijn. Vandaar twee springs op één element.
    const c = klassen();
    expect(c).toContain("transform_var(--spring-snappy)");
    expect(c).toContain("background-color_var(--spring-flow)");
    expect(c).toContain("box-shadow_var(--spring-flow)");
  });

  it("heeft een zichtbare focusring", () => {
    expect(klassen()).toContain("focus-visible:outline-flow-ink");
  });

  it("houdt de control-radius van 4px aan", () => {
    // DESIGN_SYSTEM §3: controls 4px, kaarten 8px. Een knop is een control.
    expect(klassen()).toContain("rounded-control");
    expect(klassen()).not.toContain("rounded-card");
  });

  it("neemt in uitgeschakelde staat de glow weg", () => {
    const c = klassen({ disabled: true });
    expect(c).toContain("opacity-55");
    expect(c).toContain("shadow-none");
  });
});
