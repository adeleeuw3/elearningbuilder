/**
 * De exportroute van begin tot eind.
 *
 * Dit is de enige test die het hele pad aflegt: opslag → observatiedocument → publicatiepoort →
 * manifest → ZIP. De losse stukken hebben hun eigen tests; wat hier vastligt is dat ze samen een
 * pakket opleveren dat een LMS kan uitpakken, en dat de weigeringen vóór het bouwen komen.
 *
 * `process.cwd()` wordt op de app gezet omdat de route de gebouwde runtime relatief daaraan zoekt
 * — dat is hoe `next dev`/`next start` draait, maar vitest start in de repo-root.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import JSZip from "jszip";
import { alsUuid } from "../../../../lib/opslag";

const APP = path.resolve(__dirname, "..", "..", "..", "..");
const oudeCwd = process.cwd();

beforeAll(() => {
  process.chdir(APP);
  process.env.OB_IRI_BASE = "https://xapi.example.com/acme";
});

afterAll(() => {
  process.chdir(oudeCwd);
});

/** De namen in het pakket. */
async function inhoud(res: Response): Promise<Record<string, Uint8Array>> {
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const uit: Record<string, Uint8Array> = {};
  for (const [naam, bestand] of Object.entries(zip.files)) {
    if (!bestand.dir) uit[naam] = await bestand.async("uint8array");
  }
  return uit;
}

/** Een module die publiceerbaar is: tekst, één vraag, geen media zonder alt-tekst. */
async function moduleMetInhoud() {
  const { leerpadUitContent } = await import("../../../../lib/leerpad");
  const content = {
    titel: "Veilig werken op hoogte",
    intro: "Vallen van hoogte is de nummer één oorzaak van ongevallen in de bouw.",
    secties: [
      {
        type: "uitleg" as const,
        kop: "Wanneer geldt valgevaar?",
        tekst: "Vanaf 2,5 meter geldt valgevaar.",
      },
    ],
    vragen: [
      {
        vraagvorm: "Meerkeuze" as const,
        vorm: "keuze" as const,
        vraag: "Vanaf welke hoogte geldt valgevaar?",
        opties: ["1 meter", "2,5 meter", "5 meter"],
        correct: 1,
        feedback: "Vanaf 2,5 meter.",
      },
    ],
    samenvatting: "Controleer altijd je ankerpunt.",
  };
  return {
    id: crypto.randomUUID().replace(/-/g, ""),
    content,
    leerpad: leerpadUitContent(content),
  };
}

async function exporteer(body: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("http://localhost/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/export", () => {
  it("levert een ZIP met alles wat offline nodig is", async () => {
    const module = await moduleMetInhoud();
    const res = await exporteer({ module, profiel: "cmi5" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");

    const namen = Object.keys(await inhoud(res));

    for (const nodig of [
      "index.html",
      "app.js",
      "app.css",
      "observation.json",
      "xapi-bootstrap.js",
      "xapi_client_min.js",
      "cmi5.xml",
    ]) {
      expect(namen, `${nodig} hoort in het pakket te zitten`).toContain(nodig);
    }
  });

  it("zet het xAPI-manifest neer bij het xapi-profiel", async () => {
    const module = await moduleMetInhoud();
    const res = await exporteer({ module, profiel: "xapi" });
    const namen = Object.keys(await inhoud(res));
    expect(namen).toContain("tincan.xml");
    expect(namen).not.toContain("cmi5.xml");
  });

  it("draagt geen endpoint, sleutel of token mee — de LRS wordt bij het starten ontdekt", async () => {
    const module = await moduleMetInhoud();
    const res = await exporteer({ module, profiel: "cmi5" });
    const bestanden = await inhoud(res);
    const tekst = new TextDecoder().decode(bestanden["observation.json"]!);
    expect(tekst).not.toMatch(/Authorization|Basic [A-Za-z0-9+/=]{16,}|auth_token|api[_-]?key/i);
  });

  it("weigert zonder OB_IRI_BASE in plaats van een namespace te gokken", async () => {
    const module = await moduleMetInhoud();
    const oud = process.env.OB_IRI_BASE;
    delete process.env.OB_IRI_BASE;
    try {
      const res = await exporteer({ module, profiel: "xapi" });
      expect(res.status).toBe(500);
      expect(await res.text()).toContain("OB_IRI_BASE");
    } finally {
      process.env.OB_IRI_BASE = oud;
    }
  });

  it("weigert een module zonder geldige identiteit", async () => {
    const { content, leerpad } = await moduleMetInhoud();
    const res = await exporteer({ module: { id: "../../etc/passwd", content, leerpad }, profiel: "xapi" });
    expect(res.status).toBe(400);
  });

  it("weigert een module zonder graaf", async () => {
    const { id, content } = await moduleMetInhoud();
    const res = await exporteer({ module: { id, content }, profiel: "xapi" });
    expect(res.status).toBe(422);
  });

  it("exporteert zonder dat de module ooit bewaard is", async () => {
    // De identiteit komt van de module zelf, niet van de opslag; opslaan is dus geen voorwaarde.
    const module = await moduleMetInhoud();
    const res = await exporteer({ module, profiel: "xapi" });
    expect(res.status).toBe(200);
    const doc = JSON.parse(
      new TextDecoder().decode((await inhoud(res))["observation.json"]!),
    );
    expect(doc.artifactId).toBe(alsUuid(module.id));
  });
});

describe("keurIriBasis", () => {
  it("laat een gewone namespace door, ook met xapi in de hostnaam", async () => {
    const { keurIriBasis } = await import("../../../../lib/export");
    expect(keurIriBasis("https://xapi.example.com/acme")).toBeNull();
    expect(keurIriBasis("https://example.com/leerobjecten")).toBeNull();
  });

  it("benoemt een pad dat de secret-scan later zou laten struikelen", async () => {
    const { keurIriBasis } = await import("../../../../lib/export");
    expect(keurIriBasis("https://example.com/xapi/acme")).toContain("xapi");
    expect(keurIriBasis("https://example.com/statements")).toContain("statements");
  });

  it("weigert iets dat geen URL is", async () => {
    const { keurIriBasis } = await import("../../../../lib/export");
    expect(keurIriBasis("geen-url")).toContain("geldige URL");
  });

  it("weigert de export meteen, niet pas bij het zippen", async () => {
    const module = await moduleMetInhoud();
    const oud = process.env.OB_IRI_BASE;
    process.env.OB_IRI_BASE = "https://example.com/xapi/acme";
    try {
      const res = await exporteer({ module, profiel: "cmi5" });
      expect(res.status).toBe(500);
      const tekst = await res.text();
      expect(tekst).toContain("OB_IRI_BASE");
      // Niet de ondoorzichtige uitkomst waar dit voor bestaat: de scan komt pas ná het bouwen,
      // en meldt dan "Export blocked — potential secret(s)" zonder te zeggen wat je moet wijzigen.
      expect(tekst).not.toContain("Export blocked");
    } finally {
      process.env.OB_IRI_BASE = oud;
    }
  });
});

describe("een module uit het oude paginamodel", () => {
  /**
   * Een module die sinds de modelwijziging niet meer geopend is draagt nog Pagina- en Cursusknopen.
   * Zonder migratie hier zou de pagina de seed van haar eerste blok krijgen in plaats van die van
   * de oude paginaknoop: een andere IRI voor hetzelfde scherm, en dus een gebroken historie in de
   * LRS. De route migreert daarom zelf, ook al doet de authoring-app dat bij het openen al.
   */
  async function oudeModule() {
    const seeds: Record<string, string> = {
      a1: crypto.randomUUID(),
      P1: crypto.randomUUID(),
      C1: crypto.randomUUID(),
    };
    const blok = (id: string, soort: string, titel: string, extra: object = {}) => ({
      id,
      seed: seeds[id]!,
      soort,
      titel,
      fragment: "",
      index: null,
      eigen: true,
      minuten: 2,
      klaar: true,
      x: 0,
      y: 0,
      ...extra,
    });
    const content = {
      titel: "Oud project",
      intro: "Een intro die lang genoeg is om te tellen.",
      secties: [{ type: "uitleg" as const, kop: "Kop", tekst: "Wat tekst." }],
      vragen: [],
      samenvatting: "Slot.",
    };
    return {
      module: {
        id: crypto.randomUUID().replace(/-/g, ""),
        content,
        leerpad: {
          knopen: [
            blok("a1", "uitleg", "Valgevaar", { uitvoer: "Vanaf 2,5 meter geldt valgevaar." }),
            blok("P1", "pagina", "Introductie"),
            blok("C1", "cursus", "Cursus"),
          ],
          verbindingen: [
            { id: "k0", van: "a1", naar: "P1" },
            { id: "k1", van: "P1", naar: "C1" },
          ],
        },
      },
      paginaSeed: seeds.P1!,
    };
  }

  it("exporteert en houdt de pagina-IRI van de oude paginaknoop", async () => {
    const { module, paginaSeed } = await oudeModule();
    const res = await exporteer({ module, profiel: "xapi" });
    expect(res.status).toBe(200);

    const bestanden = await inhoud(res);
    const doc = JSON.parse(new TextDecoder().decode(bestanden["observation.json"]!));
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].id).toBe(paginaSeed);
    // En de titel van de oude paginaknoop is de paginatitel gebleven.
    expect(Object.values(doc.pages[0].title)[0]).toBe("Introductie");
  });
});
