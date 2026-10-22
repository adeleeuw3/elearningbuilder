/**
 * De migratie draait één keer per bestaand project en is daarna niet meer te herhalen: wat hij
 * verliest is weg. Vandaar dat hier niet alleen staat dát er pagina's uitkomen, maar ook dat de
 * cursusvolgorde, de xAPI-identiteit en de routes erdoorheen komen.
 */
import { describe, expect, it } from "vitest";
import { heeftOudModel, migreerLeerpad, type OudLeerpad } from "../migratie";
import { paginasVan } from "../paginas";
import { NIVEAU, type KnoopSoort } from "../graph";

let n = 0;
function knoop(id: string, soort: string, extra: Record<string, unknown> = {}) {
  n += 1;
  return {
    id,
    seed: `seed-${id}`,
    soort,
    titel: `Titel ${id}`,
    fragment: "",
    index: null,
    eigen: true,
    minuten: 2,
    klaar: true,
    x: 0,
    y: 0,
    ...extra,
  } as OudLeerpad["knopen"][number];
}

function schakels(paren: [string, string][]): OudLeerpad["verbindingen"] {
  return paren.map(([van, naar], i) => ({ id: `k${i}`, van, naar }));
}

/**
 * Een module met twee pagina's, zoals het oude model die opleverde:
 *
 *   a1 → a2 → P1 → P2 → C
 *             b1 → b2 ↗
 */
function tweePaginas(): OudLeerpad {
  return {
    knopen: [
      knoop("a1", "uitleg", { titel: "Valgevaar" }),
      knoop("a2", "toets", { titel: "Vraag 1" }),
      knoop("b1", "uitleg", { titel: "Ankerpunt" }),
      knoop("b2", "samenvatting", { titel: "Samenvatting" }),
      knoop("P1", "pagina", { titel: "Introductie" }),
      knoop("P2", "pagina", { titel: "Verdieping" }),
      knoop("C", "cursus", { titel: "Cursus" }),
    ],
    verbindingen: schakels([
      ["a1", "a2"],
      ["a2", "P1"],
      ["b1", "b2"],
      ["b2", "P2"],
      ["P1", "P2"],
      ["P2", "C"],
    ]),
  };
}

describe("heeftOudModel", () => {
  it("herkent een pagina- of cursusknoop", () => {
    expect(heeftOudModel(tweePaginas())).toBe(true);
  });

  it("laat een leerpad dat al om is met rust", () => {
    const nieuw: OudLeerpad = {
      knopen: [knoop("a", "uitleg")],
      verbindingen: [],
    };
    expect(heeftOudModel(nieuw)).toBe(false);
    expect(migreerLeerpad(nieuw)).toBe(nieuw as never);
  });

  it("is idempotent: nog een keer draaien verandert niets", () => {
    const een = migreerLeerpad(tweePaginas());
    const twee = migreerLeerpad(een as OudLeerpad);
    expect(twee).toEqual(een);
  });
});

describe("migreerLeerpad", () => {
  it("haalt de pagina- en cursusknopen weg", () => {
    const uit = migreerLeerpad(tweePaginas());
    expect(uit.knopen.map((k) => k.soort)).not.toContain("pagina");
    expect(uit.knopen.map((k) => k.soort)).not.toContain("cursus");
    expect(uit.knopen).toHaveLength(4);
  });

  it("levert twee pagina's op met hun blokken in dezelfde volgorde", () => {
    const paginas = paginasVan(migreerLeerpad(tweePaginas()));
    expect(paginas.map((p) => p.onderdelen.map((k) => k.id))).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
  });

  it("behoudt de cursusvolgorde door de ketens op positie te zetten", () => {
    // De schakels die de volgorde droegen verdwijnen; alleen de y-positie houdt hem nog vast.
    const uit = migreerLeerpad(tweePaginas());
    const y = (id: string) => uit.knopen.find((k) => k.id === id)!.y;
    expect(y("a1")).toBeLessThan(y("b1"));
    expect(y("a1")).toBe(y("a2"));
  });

  it("keert de volgorde niet om als de tweede pagina in het document eerst komt", () => {
    const oud = tweePaginas();
    // P2 gaat vooraan in het pad staan; documentvolgorde blijft P1 eerst.
    oud.verbindingen = schakels([
      ["a1", "a2"],
      ["a2", "P1"],
      ["b1", "b2"],
      ["b2", "P2"],
      ["P2", "P1"],
      ["P1", "C"],
    ]);
    const paginas = paginasVan(migreerLeerpad(oud));
    expect(paginas.map((p) => p.kop.id)).toEqual(["b1", "a1"]);
  });

  it("neemt de titel van de paginaknoop over als overschreven paginatitel", () => {
    const paginas = paginasVan(migreerLeerpad(tweePaginas()));
    expect(paginas.map((p) => p.titel)).toEqual(["Introductie", "Verdieping"]);
    expect(paginas.every((p) => p.eigenTitel)).toBe(true);
    // En het blok zelf houdt zijn eigen naam.
    expect(paginas[0]!.kop.titel).toBe("Valgevaar");
  });

  it("houdt de xAPI-identiteit van de pagina vast", () => {
    // Hier hangt de IRI in de export aan; verandert die, dan valt de historie in de LRS in tweeën.
    const paginas = paginasVan(migreerLeerpad(tweePaginas()));
    expect(paginas.map((p) => p.seed)).toEqual(["seed-P1", "seed-P2"]);
  });

  it("maakt van een blok dat in geen pagina uitkwam gewoon een eigen pagina", () => {
    const oud = tweePaginas();
    oud.knopen.push(knoop("los", "uitleg", { titel: "Vergeten blok" }));
    const paginas = paginasVan(migreerLeerpad(oud));
    expect(paginas.map((p) => p.kop.id)).toEqual(["a1", "b1", "los"]);
    expect(paginas[2]!.onderdelen).toHaveLength(1);
  });

  it("laat een lege pagina geen spookpagina worden", () => {
    const oud = tweePaginas();
    oud.knopen.push(knoop("P3", "pagina", { titel: "Nog leeg" }));
    oud.verbindingen.push({ id: "kx", van: "P2", naar: "P3" });
    const paginas = paginasVan(migreerLeerpad(oud));
    expect(paginas).toHaveLength(2);
  });
});

describe("migratie van routes", () => {
  /**
   *   a1 → P1 → V ─(geslaagd)→ P2 → b1
   *                └(gezakt)──→ P3 → c1
   */
  function metVertakking(): OudLeerpad {
    return {
      knopen: [
        knoop("a1", "uitleg"),
        knoop("b1", "uitleg"),
        knoop("c1", "uitleg"),
        knoop("P1", "pagina"),
        knoop("P2", "pagina"),
        knoop("P3", "pagina"),
        knoop("V", "vertakking", { titel: "Gehaald?" }),
        knoop("C", "cursus"),
      ],
      verbindingen: [
        { id: "k0", van: "a1", naar: "P1" },
        { id: "k1", van: "b1", naar: "P2" },
        { id: "k2", van: "c1", naar: "P3" },
        { id: "k3", van: "P1", naar: "V" },
        { id: "k4", van: "V", naar: "P2", voorwaarde: { soort: "geslaagd" } },
        { id: "k5", van: "V", naar: "P3", voorwaarde: { soort: "gezakt" } },
        { id: "k6", van: "P2", naar: "C" },
      ],
    };
  }

  it("hangt de vertakking om naar de staart en de kop van de ketens", () => {
    const uit = migreerLeerpad(metVertakking());
    const uitV = uit.verbindingen.filter((v) => v.van === "V");
    expect(uitV.map((v) => v.naar).sort()).toEqual(["b1", "c1"]);
    expect(uit.verbindingen.some((v) => v.van === "a1" && v.naar === "V")).toBe(true);
  });

  it("houdt de voorwaarden op de takken", () => {
    const uit = migreerLeerpad(metVertakking());
    const naarB = uit.verbindingen.find((v) => v.van === "V" && v.naar === "b1");
    expect(naarB?.voorwaarde).toEqual({ soort: "geslaagd" });
  });

  it("laat de takken aparte pagina's blijven — een route voegt geen schermen samen", () => {
    const paginas = paginasVan(migreerLeerpad(metVertakking()));
    expect(paginas.map((p) => p.onderdelen.map((k) => k.id))).toEqual([["a1"], ["b1"], ["c1"]]);
  });
});

describe("migratie van secties", () => {
  it("gooit de sectieschakels weg en houdt de sectieknoop", () => {
    const oud: OudLeerpad = {
      knopen: [
        knoop("a1", "uitleg"),
        knoop("P1", "pagina"),
        knoop("S", "sectie", { titel: "Deel 1" }),
        knoop("C", "cursus"),
      ],
      verbindingen: schakels([
        ["a1", "P1"],
        ["P1", "S"],
        ["S", "C"],
      ]),
    };
    const uit = migreerLeerpad(oud);
    expect(uit.knopen.map((k) => k.id)).toEqual(["a1", "S"]);
    expect(uit.verbindingen).toEqual([]);
  });
});

describe("de inhoudslijst van de migratie", () => {
  it("kent elke soort die vandaag inhoud is", () => {
    // Deze lijst stond ooit overgetypt naast `NIVEAU`. Dat gaat stil mis: een nieuwe blokvorm valt
    // dan bij het migreren buiten de rijen en staat ineens los op het canvas.
    const inhoudsoorten = (Object.keys(NIVEAU) as KnoopSoort[]).filter(
      (s) => NIVEAU[s] === "inhoud",
    );
    let l: OudLeerpad = { knopen: [], verbindingen: [] };
    const blok = (id: string, soort: string) => ({
      id,
      seed: `0000000${id}-0000-4000-8000-000000000000`.slice(-36),
      soort,
      titel: id,
      fragment: "",
      index: null,
      eigen: true,
      minuten: 1,
      klaar: true,
      x: 0,
      y: 0,
    });
    l = {
      knopen: [
        ...inhoudsoorten.map((s, i) => blok(`b${i}`, s)),
        // Eén oude paginaknoop, zodat de migratie daadwerkelijk aan het werk gaat.
        blok("P1", "pagina"),
      ],
      verbindingen: [{ id: "k0", van: "b0", naar: "P1" }],
    } as OudLeerpad;

    const na = migreerLeerpad(l);

    // Elk blok staat los, dus elk blok hoort zijn eigen rij te krijgen. Een soort die de migratie
    // niet als inhoud herkent wordt overgeslagen en blijft op y=0 liggen — dan vallen er twee of
    // meer blokken op elkaar, en dát is wat hier gemeten wordt. Alleen kijken of de knopen er nog
    // zijn zegt niets: de migratie verwijdert nooit iets, hij slaat alleen het uitleggen over.
    const y = na.knopen.map((k) => k.y);
    const dubbel = y.filter((w, i) => y.indexOf(w) !== i);
    expect(
      new Set(y).size,
      `deze blokken kregen geen eigen rij: ${na.knopen
        .filter((k) => dubbel.includes(k.y))
        .map((k) => k.soort)
        .join(", ")}`,
    ).toBe(na.knopen.length);
    expect(na.knopen).toHaveLength(inhoudsoorten.length);
  });
});
