/**
 * Scenario's: het enige blok waarin de cursist iets dóét.
 *
 * De blokvariatie maakte de bladspiegel beter maar het leren niet: lezen, lezen, lezen, toets. Een
 * scenario zet daar een beslissing tegenover — situatie, keuze, gevolg, nabespreking.
 *
 * Twee dingen gaan hier stil fout. Een scenario zonder voorkeursantwoord levert geen `success` op
 * en wordt daarmee onzichtbaar in elke LRS-rapportage; en een scenario leest zijn inhoud uit
 * `secties[i].extra` terwijl een gewone vraag uit `vragen[i]` komt — kijkt de export in de
 * verkeerde lijst, dan komt er een lege vraag uit.
 */
import { describe, it, expect } from "vitest";
import { bouwLeerpad, bruikbareExtra } from "../graph";
import { leerpadUitContent } from "../leerpad";
import { naarObservatieDocument } from "../export";
import type { Extra, GeneratedContent, Vraag } from "../types";

const SCENARIO: Extra = {
  vorm: "scenario",
  situatie: "Een bezoeker verheft zijn stem omdat zijn aanvraag is afgewezen.",
  opties: [
    { tekst: "Je legt nog eens uit waarom de regel zo is.", gevolg: "Hij wordt bozer: hij voelt zich niet gehoord.", voorkeur: false },
    { tekst: "Je benoemt wat je ziet en vraagt wat hij nodig heeft.", gevolg: "Hij zakt iets terug; er is weer contact.", voorkeur: true },
    { tekst: "Je roept meteen een collega erbij.", gevolg: "Hij voelt zich niet serieus genomen.", voorkeur: false },
  ],
  nabespreking: "Contact gaat voor inhoud: erkenning is geen toegeven.",
};

const sectie = (kop: string, extra?: Extra) => ({
  type: "uitleg" as const,
  kop,
  tekst: `De uitleg bij ${kop}.`,
  ...(extra ? { extra } : {}),
});

const VRAAG: Vraag = {
  vraagvorm: "Meerkeuze",
  vorm: "keuze",
  vraag: "Wat doe je eerst?",
  opties: ["Uitleggen", "Benoemen", "Weglopen"],
  correct: 1,
  feedback: "Benoemen werkt.",
  uitlegPerOptie: [
    "Uitleggen lijkt logisch, maar bij spanning landt inhoud niet.",
    "Benoemen maakt contact; daarna kan de inhoud weer.",
    "Weglopen laat de situatie onopgelost achter.",
  ],
};

const content = (secties: ReturnType<typeof sectie>[], vragen: Vraag[] = []): GeneratedContent => ({
  titel: "Agressie aan de balie",
  intro: "Een inleiding.",
  secties,
  vragen,
  samenvatting: "Een slot.",
});

const document = (c: GeneratedContent) => {
  const uit = naarObservatieDocument({
    leerpad: leerpadUitContent(c),
    content: c,
    artifactId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    iriBase: "https://xapi.example.com/acme",
  });
  if (!uit.ok) throw new Error(uit.redenen.join(" | "));
  return uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
};

describe("wat een bruikbaar scenario is", () => {
  it("accepteert een volledig scenario", () => {
    expect(bruikbareExtra(SCENARIO)).toBeDefined();
  });

  it("weigert er een zonder situatie", () => {
    expect(bruikbareExtra({ ...SCENARIO, situatie: "   " })).toBeUndefined();
  });

  it("weigert er een met minder dan twee keuzes", () => {
    expect(bruikbareExtra({ ...SCENARIO, opties: [SCENARIO.opties![1]!] })).toBeUndefined();
  });

  it("weigert er een zonder of met meer dan één voorkeur", () => {
    // Zonder voorkeur valt er geen `success` te melden en is de uitkomst onzichtbaar in de LRS.
    const geen = SCENARIO.opties!.map((o) => ({ ...o, voorkeur: false }));
    expect(bruikbareExtra({ ...SCENARIO, opties: geen })).toBeUndefined();
    const twee = SCENARIO.opties!.map((o) => ({ ...o, voorkeur: true }));
    expect(bruikbareExtra({ ...SCENARIO, opties: twee })).toBeUndefined();
  });
});

describe("de generator", () => {
  it("zet een scenario neer als kennischeck, gemarkeerd op zijn bron", () => {
    // De markering is nodig omdat een scenario zijn inhoud uit `secties[i].extra` leest terwijl
    // een gewone vraag uit `vragen[i]` komt. Zonder markering kijkt de export in de verkeerde lijst.
    const knoop = bouwLeerpad(content([sectie("Contact", SCENARIO)])).knopen.find(
      (k) => k.id === "e0",
    )!;
    expect(knoop.soort).toBe("toets");
    expect(knoop.bron).toBe("scenario");
    expect(knoop.xapiWerkwoord).toContain("answered");
  });

  it("laat de sectie staan: eerst het principe, dan toepassen", () => {
    const knopen = bouwLeerpad(content([sectie("Contact", SCENARIO)])).knopen;
    expect(knopen.findIndex((k) => k.id === "s0")).toBeLessThan(
      knopen.findIndex((k) => k.id === "e0"),
    );
  });
});

describe("het pakket", () => {
  it("maakt er een keuze-interactie van met het voorkeursantwoord erin", () => {
    const blok = document(content([sectie("Contact", SCENARIO)])).find(
      (b) => b.kind === "question",
    );
    if (blok?.kind !== "question") throw new Error("verwachtte een vraagblok");
    expect(blok.assessment.interactionType).toBe("choice");
    expect(Object.values(blok.assessment.prompt)[0]).toBe(SCENARIO.situatie);
    expect(blok.assessment.correctResponsesPattern).toEqual(["c1"]);
  });

  it("hangt het gevolg aan de keuze zelf, niet aan de uitkomst", () => {
    // Eén tekst voor elk fout antwoord bevestigt alleen het oordeel; per optie leert de cursist
    // wat er van zíjn keuze komt.
    const blok = document(content([sectie("Contact", SCENARIO)])).find(
      (b) => b.kind === "question",
    );
    if (blok?.kind !== "question") throw new Error("verwachtte een vraagblok");
    const gevolgen = blok.assessment.choices!.map((c) => Object.values(c.feedback ?? {})[0]);
    expect(gevolgen).toEqual(SCENARIO.opties!.map((o) => o.gevolg));
  });

  it("neemt de nabespreking mee", () => {
    const blok = document(content([sectie("Contact", SCENARIO)])).find(
      (b) => b.kind === "question",
    );
    if (blok?.kind !== "question") throw new Error("verwachtte een vraagblok");
    expect(Object.values(blok.assessment.debrief!)[0]).toBe(SCENARIO.nabespreking);
  });

  it("geeft een gewone vraag uitleg per optie, zonder nabespreking", () => {
    const blokken = document(content([sectie("Contact")], [VRAAG]));
    const vraag = blokken.find((b) => b.kind === "question");
    if (vraag?.kind !== "question") throw new Error("verwachtte een vraagblok");
    expect(vraag.assessment.choices!.map((c) => Object.values(c.feedback ?? {})[0])).toEqual(
      VRAAG.uitlegPerOptie,
    );
    // Een nabespreking hoort bij een casus; bij een vraag is de uitleg per optie de les.
    expect(vraag.assessment.debrief).toBeUndefined();
  });

  it("laat een vraag zonder uitleg per optie gewoon werken", () => {
    const zonder: Vraag = { ...VRAAG };
    delete (zonder as { uitlegPerOptie?: string[] }).uitlegPerOptie;
    const vraag = document(content([sectie("Contact")], [zonder])).find(
      (b) => b.kind === "question",
    );
    if (vraag?.kind !== "question") throw new Error("verwachtte een vraagblok");
    expect(vraag.assessment.choices!.every((c) => c.feedback === undefined)).toBe(true);
  });
});
