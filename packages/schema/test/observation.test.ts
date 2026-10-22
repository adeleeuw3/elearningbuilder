/**
 * The observation document is the contract between authoring, export and the runtime. It had no
 * tests at all, which is why the second page kind lands here together with them.
 *
 * The rule under test throughout: a page must say what kind it is, and `publishBlockers()` must
 * demand a text alternative exactly where a visual is actually shown — not everywhere (that buys
 * filler text) and not nowhere (that ships an inaccessible module).
 */
import { describe, it, expect } from "vitest";
import {
  ObservationDoc,
  Page,
  publishBlockers,
  safeParseObservation,
  toJsonSchema,
  type Doc,
} from "../src/index";

const EN = "en-US";
const uuid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

const scenePage = () => ({
  kind: "scene" as const,
  id: uuid(1),
  title: { [EN]: "Anatomy" },
  scene: {
    assetId: "asset-1",
    naturalWidth: 1000,
    naturalHeight: 700,
    altText: { [EN]: "A cutaway illustration of a volcano." },
  },
  components: [
    {
      id: uuid(2),
      name: "Magma chamber",
      label: { [EN]: "Magma chamber" },
      region: { kind: "circle" as const, cx: 0.5, cy: 0.6, r: 0.1 },
      altText: { [EN]: "The magma chamber, deep under the volcano." },
    },
  ],
});

const stackPage = () => ({
  kind: "stack" as const,
  id: uuid(3),
  title: { [EN]: "Working at height" },
  blocks: [
    { id: uuid(4), name: "Intro", label: { [EN]: "Why this matters" } },
  ],
});

const doc = (pages: unknown[]): unknown => ({
  schemaVersion: "1.0",
  artifactId: uuid(9),
  version: 1,
  iriBase: "https://xapi.example.com/acme",
  metadata: { title: { [EN]: "Module" }, language: EN },
  pages,
});

/* ------------------------------------------------------------------- de vormen */

describe("Page", () => {
  it("accepteert een scene-pagina", () => {
    expect(Page.safeParse(scenePage()).success).toBe(true);
  });

  it("accepteert een stapel-pagina", () => {
    expect(Page.safeParse(stackPage()).success).toBe(true);
  });

  it("weigert een pagina zonder soort — die zou geraden moeten worden", () => {
    const { kind: _weg, ...zonder } = scenePage();
    expect(Page.safeParse(zonder).success).toBe(false);
  });

  it("weigert velden van de andere vorm", () => {
    expect(Page.safeParse({ ...stackPage(), scene: scenePage().scene }).success).toBe(false);
    expect(Page.safeParse({ ...scenePage(), blocks: [] }).success).toBe(false);
  });

  it("weigert een verzonnen veld — de schema's zijn dicht", () => {
    expect(Page.safeParse({ ...stackPage(), verzonnen: 1 }).success).toBe(false);
  });

  it("weigert een hotspot zonder regio, en een stapelblok mét regio", () => {
    const zonderRegio = scenePage();
    delete (zonderRegio.components[0] as Record<string, unknown>).region;
    expect(Page.safeParse(zonderRegio).success).toBe(false);

    const metRegio = stackPage();
    (metRegio.blocks[0] as Record<string, unknown>).region = { kind: "rect", x: 0, y: 0, w: 1, h: 1 };
    expect(Page.safeParse(metRegio).success).toBe(false);
  });
});

describe("ObservationDoc", () => {
  it("accepteert beide vormen naast elkaar in één document", () => {
    expect(safeParseObservation(doc([scenePage(), stackPage()])).success).toBe(true);
  });

  it("eist minstens één pagina", () => {
    expect(safeParseObservation(doc([])).success).toBe(false);
  });

  it("eist een uuid als artifactId", () => {
    const kapot = doc([stackPage()]) as Record<string, unknown>;
    kapot.artifactId = "b1";
    expect(safeParseObservation(kapot).success).toBe(false);
  });
});

/* ------------------------------------------------------------- publishBlockers */

const parse = (pages: unknown[]): Doc => ObservationDoc.parse(doc(pages));

describe("publishBlockers", () => {
  it("laat een compleet document door", () => {
    expect(publishBlockers(parse([scenePage(), stackPage()]))).toEqual([]);
  });

  it("blokkeert een scene zonder altText", () => {
    const p = scenePage();
    p.scene.altText = { [EN]: "  " };
    expect(publishBlockers(parse([p])).join()).toContain("scene is missing altText");
  });

  it("blokkeert een hotspot zonder altText — die zit per definitie op een plaatje", () => {
    const p = scenePage();
    p.components[0]!.altText = { [EN]: "" };
    expect(publishBlockers(parse([p])).join()).toContain("component[0]");
  });

  it("blokkeert een tekstblok NIET om altText", () => {
    expect(publishBlockers(parse([stackPage()]))).toEqual([]);
  });

  it("blokkeert een stapelblok met een afbeelding wél", () => {
    const p = stackPage();
    p.blocks[0] = {
      ...p.blocks[0]!,
      content: { html: "", media: [{ assetId: "a1", kind: "image" as const }] },
    } as never;
    expect(publishBlockers(parse([p])).join()).toContain("block[0]");
  });

  it("blokkeert een stapelblok met video ook", () => {
    const p = stackPage();
    p.blocks[0] = {
      ...p.blocks[0]!,
      content: { html: "", media: [{ assetId: "a1", kind: "video" as const }] },
    } as never;
    expect(publishBlockers(parse([p])).join()).toContain("block[0]");
  });

  it("blokkeert audio niet om altText — geluid heeft geen tekstalternatief nodig maar een transcript", () => {
    const p = stackPage();
    p.blocks[0] = {
      ...p.blocks[0]!,
      content: { html: "", media: [{ assetId: "a1", kind: "audio" as const }] },
    } as never;
    expect(publishBlockers(parse([p]))).toEqual([]);
  });

  it("blokkeert een assessment zonder correctResponsesPattern, in beide vormen", () => {
    const s = scenePage();
    s.components[0] = {
      ...s.components[0]!,
      assessment: { interactionType: "choice" as const, prompt: { [EN]: "Welke?" } },
    } as never;
    expect(publishBlockers(parse([s])).join()).toContain("correctResponsesPattern");

    const t = stackPage();
    t.blocks[0] = {
      ...t.blocks[0]!,
      kind: "question" as const,
      assessment: { interactionType: "choice" as const, prompt: { [EN]: "Welke?" } },
    } as never;
    expect(publishBlockers(parse([t])).join()).toContain("correctResponsesPattern");
  });

  it("eist géén correctResponsesPattern bij een open vraag — die wordt niet beoordeeld", () => {
    const t = stackPage();
    t.blocks[0] = {
      ...t.blocks[0]!,
      kind: "open" as const,
      assessment: {
        interactionType: "long-fill-in" as const,
        prompt: { [EN]: "Wat vind jij de grootste uitdaging?" },
        score: { min: 0, max: 0, correct: 0 },
      },
    } as never;
    expect(publishBlockers(parse([t]))).toEqual([]);
  });

  it("blokkeert een verwijzing naar een onbekend rubricItem, in beide vormen", () => {
    const t = stackPage();
    t.blocks[0] = {
      ...t.blocks[0]!,
      kind: "question" as const,
      assessment: {
        interactionType: "choice" as const,
        prompt: { [EN]: "Welke?" },
        correctResponsesPattern: ["a"],
        rubricItemId: "bestaat-niet",
      },
    } as never;
    expect(publishBlockers(parse([t])).join()).toContain("unknown rubricItemId");
  });

  it("noemt de pagina en het blok waar het misgaat", () => {
    const p = stackPage();
    p.blocks[0] = {
      ...p.blocks[0]!,
      name: "Introfilm",
      content: { html: "", media: [{ assetId: "a1", kind: "image" as const }] },
    } as never;
    const melding = publishBlockers(parse([scenePage(), p]))[0]!;
    expect(melding).toContain("page[1].block[0]");
    expect(melding).toContain("Introfilm");
  });
});

/* ------------------------------------------------------------- de blokvormen */

describe("StackBlock", () => {
  /** Een blok van een gegeven soort, met alleen wat die soort verplicht stelt. */
  const blok = (extra: Record<string, unknown>) => ({
    ...stackPage(),
    blocks: [{ id: uuid(4), name: "Blok", label: { [EN]: "Blok" }, ...extra }],
  });

  it("leest een blok zonder soort als tekst — zo zagen alle blokken er hiervoor uit", () => {
    const uit = Page.safeParse(stackPage());
    expect(uit.success).toBe(true);
    expect(uit.success && uit.data.kind === "stack" && uit.data.blocks[0]!.kind).toBe("text");
  });

  it("accepteert elk van de zes soorten", () => {
    const soorten = [
      { kind: "text" },
      { kind: "media" },
      { kind: "quote", attribution: { [EN]: "Stephane Nappo" } },
      {
        kind: "question",
        assessment: { interactionType: "choice", prompt: { [EN]: "Welke?" } },
      },
      {
        kind: "open",
        assessment: { interactionType: "long-fill-in", prompt: { [EN]: "Waarom?" } },
      },
      { kind: "carousel", items: [{ id: "i1", heading: { [EN]: "Het signaal" } }] },
    ];
    for (const soort of soorten) {
      expect(Page.safeParse(blok(soort)).success, JSON.stringify(soort)).toBe(true);
    }
  });

  it("weigert velden van een andere soort — daar zit de hele union voor", () => {
    // Een tekstblok met carrousel-items zou zonder discriminator stil geaccepteerd worden en
    // vervolgens niets tonen: precies de fout die niemand opmerkt.
    expect(Page.safeParse(blok({ kind: "text", items: [] })).success).toBe(false);
    expect(Page.safeParse(blok({ kind: "media", attribution: { [EN]: "x" } })).success).toBe(false);
    expect(Page.safeParse(blok({ kind: "quote", maxLength: 500 })).success).toBe(false);
  });

  it("eist een vraag bij de soorten die er een belóven", () => {
    expect(Page.safeParse(blok({ kind: "question" })).success).toBe(false);
    expect(Page.safeParse(blok({ kind: "open" })).success).toBe(false);
    expect(Page.safeParse(blok({ kind: "carousel", items: [] })).success).toBe(false);
  });

  it("geeft de open vraag een tekenlimiet, ook als de auteur er geen koos", () => {
    const uit = Page.safeParse(
      blok({ kind: "open", assessment: { interactionType: "long-fill-in", prompt: { [EN]: "?" } } }),
    );
    expect(uit.success && uit.data.kind === "stack" && uit.data.blocks[0]).toMatchObject({
      kind: "open",
      maxLength: 500,
    });
  });

  it("laat presentatie weg zonder gat: de standaard is een gewone sectie in de leeskolom", () => {
    const uit = Page.safeParse(stackPage());
    expect(uit.success && uit.data.kind === "stack" && uit.data.blocks[0]!.presentation).toEqual({
      nadruk: "normaal",
      fullBleed: false,
      minHeight: 0,
    });
  });

  it("neemt een achtergrondbeeld, maar nooit een kleur", () => {
    // Een foto achter een citaat is inhoud: de auteur koos hem om wat erop staat. Een kleur is
    // vormgeving, en die hoort in het thema — anders draagt elk blok zijn eigen hex en ziet geen
    // twee modules er meer hetzelfde uit.
    const met = (background: unknown) => blok({ kind: "quote", presentation: { background } });
    expect(Page.safeParse(met({ assetId: "a1" })).success).toBe(true);
    expect(Page.safeParse(met({ assetId: "a1", filename: "a1.jpg" })).success).toBe(true);
    expect(Page.safeParse(met({ kind: "color", value: "#0b1f3a" })).success).toBe(false);
    // Geen URL: het pakket draait offline, dus alles wat het toont zit in de ZIP.
    expect(Page.safeParse(met({ url: "https://x/y.png" })).success).toBe(false);
  });

  it("kent alleen de drie nadrukken, niet een verzonnen vierde", () => {
    const met = (nadruk: string) => blok({ kind: "text", presentation: { nadruk } });
    for (const n of ["rustig", "normaal", "accent"]) {
      expect(Page.safeParse(met(n)).success, n).toBe(true);
    }
    expect(Page.safeParse(met("knalgeel")).success).toBe(false);
  });

  it("houdt minHeight een fractie van het scherm, geen pixelmaat", () => {
    const met = (minHeight: number) => blok({ kind: "quote", presentation: { minHeight } });
    expect(Page.safeParse(met(0.6)).success).toBe(true);
    expect(Page.safeParse(met(320)).success).toBe(false);
  });

  it("blokkeert een carrousel-item met een afbeelding zonder altText", () => {
    const p = blok({
      kind: "carousel",
      items: [
        {
          id: "i1",
          heading: { [EN]: "Het signaal" },
          content: { html: "", media: [{ assetId: "a1", kind: "image" }] },
        },
      ],
    });
    expect(publishBlockers(parse([p])).join()).toContain("item[0]");
  });
});

describe("toJsonSchema", () => {
  it("blijft werken met de union erin", () => {
    const js = JSON.stringify(toJsonSchema());
    expect(js).toContain("stack");
    expect(js).toContain("scene");
  });

  it("draagt de blokvormen mee — een `preprocess` mag ze niet uit het contract wissen", () => {
    // `z.preprocess` levert een ZodEffects op, en die kan in een JSON Schema als een leeg object
    // eindigen. Dan zou het externe contract nog kloppen maar niets meer beschrijven.
    const js = JSON.stringify(toJsonSchema());
    for (const soort of ["carousel", "question", "open", "quote", "media"]) {
      expect(js, `${soort} hoort in het contract te staan`).toContain(soort);
    }
  });
});
