/**
 * Contract-tests. Structured outputs zouden ongeldige antwoorden onmogelijk moeten maken, maar
 * het contract en het JSON-vangnet zijn pure logica — dus testbaar zonder API-key. Dit is precies
 * het deel dat stil kan breken: een schema dat te veel toestaat merkt niemand tot productie.
 */
import { describe, it, expect } from "vitest";
import { repareerJson } from "../json-repair";
import {
  CompleteModuleSpecSchema,
  GeneratedContentSchema,
  InterviewAntwoordSchema,
  InterviewRequestSchema,
  LEGE_MODULE_SPEC,
  ModuleSpecSchema,
  VERPLICHTE_VELDEN,
} from "../types";

/* --------------------------------------------------------------- repareerJson */

describe("repareerJson", () => {
  it("laat schone JSON ongemoeid", () => {
    expect(repareerJson('{"a":1}')).toBe('{"a":1}');
  });

  it("verwijdert ```json fences", () => {
    expect(repareerJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("verwijdert fences zonder taal", () => {
    expect(repareerJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("pelt tekst voor en na het object weg", () => {
    expect(repareerJson('Natuurlijk! {"a":1} Laat me weten...')).toBe('{"a":1}');
  });

  it("houdt geneste objecten heel", () => {
    const json = '{"a":{"b":[1,2]},"c":"}"}';
    expect(JSON.parse(repareerJson(`prefix ${json}`))).toEqual(JSON.parse(json));
  });

  it("laat onbruikbare invoer onbruikbaar (geen stille onzin)", () => {
    expect(() => JSON.parse(repareerJson("helemaal geen json"))).toThrow();
  });
});

/* ------------------------------------------------------------ de drie vormen */

describe("InterviewAntwoord — de drie vormen", () => {
  it("accepteert vraag met keuzes", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "vraag",
      veld: "vraagvormen",
      bericht: "Welke vraagvormen wil je gebruiken?",
      invoer: { type: "multi_select", opties: ["Meerkeuze", "Waar/niet waar"] },
    });
    expect(r.success).toBe(true);
  });

  it("accepteert vraag van type text zonder opties", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "vraag",
      veld: "onderwerp",
      bericht: "Waar gaat de module over?",
      invoer: { type: "text" },
    });
    expect(r.success).toBe(true);
  });

  it("accepteert bevestig", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "bevestig",
      bericht: "Klopt dit?",
      invoer: {
        type: "single_select",
        opties: ["Klopt, bouw de module", "Ik wil iets aanpassen"],
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepteert genereer met een volledige spec", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "genereer",
      moduleSpec: {
        onderwerp: "Veilig werken op hoogte",
        doelgroep: "Nieuwe monteurs",
        leerdoelen: ["Valgevaren herkennen"],
        toon: "professioneel-toegankelijk",
        vraagvormen: ["Meerkeuze"],
        lengte: "~10 min",
        context: null,
      },
    });
    expect(r.success).toBe(true);
  });

  it("wijst een onbekende status af", () => {
    expect(InterviewAntwoordSchema.safeParse({ status: "klaar" }).success).toBe(false);
  });

  it("wijst een onbekend invoertype af", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "vraag",
      veld: "onderwerp",
      bericht: "?",
      invoer: { type: "dropdown", opties: ["a"] },
    });
    expect(r.success).toBe(false);
  });

  it("wijst een veld af dat niet in de moduleSpec bestaat", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "vraag",
      veld: "kleurenschema",
      bericht: "?",
      invoer: { type: "text" },
    });
    expect(r.success).toBe(false);
  });

  it("wijst extra velden af — het contract is dicht", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "vraag",
      veld: "onderwerp",
      bericht: "?",
      invoer: { type: "text" },
      volgendeStap: "iets verzonnen",
    });
    expect(r.success).toBe(false);
  });

  it("wijst genereer met een half ingevulde spec af", () => {
    const r = InterviewAntwoordSchema.safeParse({
      status: "genereer",
      moduleSpec: { ...LEGE_MODULE_SPEC, onderwerp: "Iets" },
    });
    expect(r.success).toBe(false);
  });
});

/* ---------------------------------------------------------------- moduleSpec */

describe("ModuleSpec", () => {
  it("accepteert de lege startspec", () => {
    expect(ModuleSpecSchema.safeParse(LEGE_MODULE_SPEC).success).toBe(true);
  });

  it("noemt de vier verplichte velden in uitvraagvolgorde", () => {
    expect(VERPLICHTE_VELDEN).toEqual(["onderwerp", "doelgroep", "leerdoelen", "vraagvormen"]);
  });

  it("staat null toe voor optionele velden, maar niet voor de lijsten", () => {
    expect(ModuleSpecSchema.safeParse({ ...LEGE_MODULE_SPEC, toon: null }).success).toBe(true);
    expect(
      ModuleSpecSchema.safeParse({ ...LEGE_MODULE_SPEC, leerdoelen: null }).success,
    ).toBe(false);
  });

  it("eist bij een volledige spec dat de verplichte velden gevuld zijn", () => {
    const bijna = {
      onderwerp: "X",
      doelgroep: null,
      leerdoelen: ["Y"],
      toon: "t",
      vraagvormen: ["Meerkeuze"],
      lengte: "~10 min",
      context: null,
    };
    expect(CompleteModuleSpecSchema.safeParse(bijna).success).toBe(false);
  });
});

/* --------------------------------------------------------- request & content */

describe("InterviewRequest", () => {
  it("accepteert een eerste beurt met leeg gesprek", () => {
    const r = InterviewRequestSchema.safeParse({ moduleSpec: LEGE_MODULE_SPEC, gesprek: [] });
    expect(r.success).toBe(true);
  });

  it("wijst een onbekende rol in het gesprek af", () => {
    const r = InterviewRequestSchema.safeParse({
      moduleSpec: LEGE_MODULE_SPEC,
      gesprek: [{ rol: "systeem", bericht: "hoi" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("GeneratedContent", () => {
  const geldig = {
    titel: "Veilig werken op hoogte",
    intro: "In deze module leer je...",
    secties: [{ kop: "Valgevaren", tekst: "...", type: "uitleg" }],
    vragen: [
      {
        vraagvorm: "Meerkeuze",
        vraag: "Wat doe je eerst?",
        opties: ["Harnas checken", "Meteen klimmen"],
        correct: 0,
        feedback: "Je controleert altijd eerst je harnas.",
      },
    ],
    samenvatting: "Kort samengevat...",
  };

  it("accepteert geldige content", () => {
    expect(GeneratedContentSchema.safeParse(geldig).success).toBe(true);
  });

  it("eist dat correct een geheel getal is (het is een index)", () => {
    const r = GeneratedContentSchema.safeParse({
      ...geldig,
      vragen: [{ ...geldig.vragen[0], correct: 1.5 }],
    });
    expect(r.success).toBe(false);
  });

  it("wijst een sectie zonder kop af", () => {
    const r = GeneratedContentSchema.safeParse({
      ...geldig,
      secties: [{ tekst: "...", type: "uitleg" }],
    });
    expect(r.success).toBe(false);
  });
});
