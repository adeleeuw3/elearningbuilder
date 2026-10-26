/**
 * Vraagvormen: wat het interview belooft moet het pakket ook leveren.
 *
 * Een doorloop van de app legde bloot dat het interview vijf vraagvormen aanbood — meerkeuze,
 * juist/onjuist, scenario, sleep- en sorteeropdrachten, open reflectie — en dat er altijd
 * meerkeuze uitkwam. De generator zette `vraagvorm` namelijk vast op "meerkeuze", wat de keuze
 * van de auteur ook was.
 *
 * Dat is erger dan alleen een teleurstelling. Zou de vorm wél doorgegeven worden zonder dat de
 * inhoud meeverandert, dan meldt de LRS `sequencing` over gegevens die een keuze zijn: een
 * rapportage die niet klopt. Daarom levert de normalisator alleen de twee vormen waarvan het hele
 * pad — content, speler én statement — klopt.
 */
import { describe, it, expect } from "vitest";
import { bouwLeerpad, normaliseerVraagvorm } from "../graph";
import { naarObservatieDocument, VRAAGVORM_INTERACTIE } from "../export";
import { leerpadUitContent } from "../leerpad";
import type { GeneratedContent, Vraag } from "../types";

const vraag = (extra: Partial<Vraag>): Vraag => ({
  vraagvorm: "Meerkeuzevragen",
  vorm: "keuze",
  vraag: "Is dit waar?",
  opties: ["Ja", "Nee"],
  correct: 0,
  feedback: "Toelichting.",
  ...extra,
});

const content = (vragen: Vraag[]): GeneratedContent => ({
  titel: "Veilig werken",
  intro: "Een inleiding.",
  secties: [{ type: "uitleg", kop: "Een sectie", tekst: "Wat tekst." }],
  vragen,
  samenvatting: "Een slot.",
});

describe("normaliseerVraagvorm", () => {
  it("herkent juist/onjuist in de vormen die het model schrijft", () => {
    for (const ruw of ["Juist/onjuist", "juist of onjuist", "Waar of niet waar", "True/false"]) {
      expect(normaliseerVraagvorm(ruw)).toBe("juist-onjuist");
    }
  });

  it("maakt van al het andere meerkeuze", () => {
    // Ook van vormen die níét gebouwd zijn. Terugvallen op meerkeuze is de veilige kant op: dat
    // is wat de inhoud werkelijk is.
    for (const ruw of ["Meerkeuzevragen", "Sleep- en sorteeropdrachten", "Matching", "", undefined]) {
      expect(normaliseerVraagvorm(ruw)).toBe("meerkeuze");
    }
  });
});

describe("de generator geeft de gekozen vorm door", () => {
  it("zet juist/onjuist op de knoop in plaats van altijd meerkeuze", () => {
    const knopen = bouwLeerpad(content([vraag({ vraagvorm: "Juist/onjuist" })])).knopen;
    expect(knopen.find((k) => k.soort === "toets")?.vraagvorm).toBe("juist-onjuist");
  });

  it("maakt van een niet-gebouwde vorm geen valse belofte", () => {
    const knopen = bouwLeerpad(
      content([vraag({ vraagvorm: "Sleep- en sorteeropdrachten" })]),
    ).knopen;
    expect(knopen.find((k) => k.soort === "toets")?.vraagvorm).toBe("meerkeuze");
  });
});

describe("het pakket", () => {
  const bouw = (v: Vraag) => {
    const c = content([v]);
    const uit = naarObservatieDocument({
      leerpad: leerpadUitContent(c),
      content: c,
      artifactId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      iriBase: "https://xapi.example.com/acme",
    });
    if (!uit.ok) throw new Error(uit.redenen.join(" | "));
    const blok = uit.doc.pages
      .flatMap((p) => (p.kind === "stack" ? p.blocks : []))
      .find((b) => b.kind === "question");
    if (blok?.kind !== "question") throw new Error("verwachtte een vraagblok");
    return blok.assessment;
  };

  it("antwoordt bij juist/onjuist met true of false, zoals xAPI voorschrijft", () => {
    // Een LRS die `c0` binnenkrijgt bij een true-false-interactie kan er niets mee: het rapport
    // toont dan een antwoord dat niet bij de vraag hoort.
    const a = bouw(vraag({ vraagvorm: "Juist/onjuist", opties: ["Waar", "Niet waar"], correct: 0 }));
    expect(a.interactionType).toBe(VRAAGVORM_INTERACTIE["juist-onjuist"]);
    expect(a.correctResponsesPattern).toEqual(["true"]);
    expect(a.choices?.map((c) => c.id)).toEqual(["true", "false"]);
  });

  it("wijst het tweede antwoord aan als dat het juiste is", () => {
    const a = bouw(vraag({ vraagvorm: "Juist/onjuist", opties: ["Waar", "Niet waar"], correct: 1 }));
    expect(a.correctResponsesPattern).toEqual(["false"]);
  });

  it("laat meerkeuze zijn eigen ids houden", () => {
    const a = bouw(vraag({ vraagvorm: "Meerkeuzevragen", opties: ["A", "B", "C"], correct: 2 }));
    expect(a.interactionType).toBe(VRAAGVORM_INTERACTIE.meerkeuze);
    expect(a.choices?.map((c) => c.id)).toEqual(["c0", "c1", "c2"]);
    expect(a.correctResponsesPattern).toEqual(["c2"]);
  });

  it("valt terug op gewone ids als juist/onjuist meer dan twee opties heeft", () => {
    // Het model kan zich vergissen. Drie opties met "true"/"false" eraan hangen zou een antwoord
    // opleveren dat nergens op slaat; dan liever de vorm volgen die de gegevens echt hebben.
    const a = bouw(
      vraag({ vraagvorm: "Juist/onjuist", opties: ["Waar", "Niet waar", "Weet niet"], correct: 2 }),
    );
    expect(a.correctResponsesPattern).toEqual(["c2"]);
  });
});
