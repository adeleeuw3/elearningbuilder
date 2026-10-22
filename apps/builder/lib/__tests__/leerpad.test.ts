/**
 * Wat je met de graaf mág doen, en wat er gebeurt als je het doet.
 *
 * De afleiding van pagina's staat in `paginas.test.ts`; hier gaat het om de regels eromheen: welke
 * schakels mogen bestaan, wat een geweigerde schakel de auteur vertelt, en of de identiteit van een
 * pagina blijft staan als de keten verandert. Dat laatste is de stilste van de drie — een pagina
 * die van IRI wisselt ziet er precies zo uit als een pagina die dat niet doet.
 */
import { describe, it, expect } from "vitest";
import {
  aiDoel,
  assessmentChecks,
  bereikbaar,
  controleerLeerpad,
  contentMetTekst,
  dupliceerKeten,
  leesTekst,
  leerpadUitContent,
  magVerbinden,
  nieuweKnoop,
  niveauVan,
  synchroniseerMetContent,
  tekstbron,
  totaleMinuten,
  verbindingsBezwaar,
  verbindKnopen,
  verbreekVerbinding,
  verwijderKnoop,
  voegKnoopToe,
  voorwaardeSleutel,
  voorzieVanSeeds,
  voorwaardeTekst,
  wijzigKnoop,
  XAPI_WERKWOORDEN,
  zetPaginaTitel,
  zetVoorwaarde,
  metGewijzigdItem,
  metNieuwItem,
  metVerplaatstItem,
  vrijItemId,
  zonderItem,
  ontbrekendeAlt,
  zoekvoorstel,
} from "../leerpad";
import { paginasVan } from "../paginas";
import type { CarrouselItem, KnoopSoort, Leerpad } from "../graph";
import type { GeneratedContent } from "../types";

/* ------------------------------------------------------------------- fixtures */

const content: GeneratedContent = {
  titel: "Veilig werken op hoogte",
  intro: "Vallen van hoogte is de nummer één oorzaak van ongevallen in de bouw.",
  secties: [
    { type: "uitleg", kop: "Wanneer geldt valgevaar?", tekst: "Vanaf 2,5 meter." },
    { type: "uitleg", kop: "Valbeveiliging", tekst: "Een harnas werkt met een ankerpunt." },
  ],
  vragen: [
    {
      vraagvorm: "Meerkeuze",
      vorm: "keuze" as const,
      vraag: "Vanaf welke hoogte geldt valgevaar?",
      opties: ["1 meter", "2,5 meter", "5 meter"],
      correct: 1,
      feedback: "Vanaf 2,5 meter.",
    },
  ],
  samenvatting: "Controleer altijd je ankerpunt.",
};

const leeg: Leerpad = { knopen: [], verbindingen: [] };

/** Bouwt een graaf op uit een lijst soorten en verbindt ze in volgorde. */
function bouw(soorten: KnoopSoort[], schakels: [number, number][] = []): Leerpad {
  let l = leeg;
  soorten.forEach((s, i) => (l = voegKnoopToe(l, s, 0, i * 120)));
  for (const [a, b] of schakels) l = verbindKnopen(l, `b${a + 1}`, `b${b + 1}`);
  return l;
}

const ketens = (l: Leerpad) => paginasVan(l).map((p) => p.onderdelen.map((k) => k.id));

/* -------------------------------------------------------------------- niveaus */

describe("magVerbinden", () => {
  const k = (soort: KnoopSoort) => nieuweKnoop(soort, 0, 0, soort);

  it("laat inhoud op inhoud stapelen — dat is de pagina", () => {
    expect(magVerbinden(k("uitleg"), k("toets"))).toBe(true);
    expect(magVerbinden(k("video"), k("audio"))).toBe(true);
  });

  it("laat inhoud op een vertakking uitkomen", () => {
    expect(magVerbinden(k("toets"), k("vertakking"))).toBe(true);
  });

  it("laat een vertakking naar de kop van een andere keten wijzen", () => {
    expect(magVerbinden(k("vertakking"), k("uitleg"))).toBe(true);
  });

  it("laat een AI-knoop een blok aanwijzen, en niets andersom", () => {
    expect(magVerbinden(k("ai"), k("uitleg"))).toBe(true);
    expect(magVerbinden(k("uitleg"), k("ai"))).toBe(false);
  });

  it("laat een sectie nergens aan hangen — die groepeert op plek", () => {
    for (const soort of ["uitleg", "toets", "vertakking", "ai"] as KnoopSoort[]) {
      expect(magVerbinden(k("sectie"), k(soort))).toBe(false);
      expect(magVerbinden(k(soort), k("sectie"))).toBe(false);
    }
  });

  it("laat geen vertakking aan een vertakking hangen", () => {
    expect(magVerbinden(k("vertakking"), k("vertakking"))).toBe(false);
  });
});

describe("niveauVan", () => {
  it("noemt de AI-knoop gereedschap en niet inhoud", () => {
    expect(niveauVan(nieuweKnoop("ai", 0, 0, "x"))).toBe("gereedschap");
    expect(niveauVan(nieuweKnoop("uitleg", 0, 0, "y"))).toBe("inhoud");
  });
});

/* ------------------------------------------------------------------- bezwaren */

describe("verbindingsBezwaar", () => {
  it("zegt niets als de schakel gewoon mag", () => {
    const l = bouw(["uitleg", "toets"]);
    const [a, b] = l.knopen;
    expect(verbindingsBezwaar(a!, b!, l)).toBeNull();
  });

  it("weigert een blok aan zichzelf", () => {
    const l = bouw(["uitleg"]);
    expect(verbindingsBezwaar(l.knopen[0]!, l.knopen[0]!, l)).toMatch(/zichzelf/);
  });

  it("weigert een tweede uitgaande schakel en wijst de vertakking aan", () => {
    // Dit is de kern van het model: met twee uitgangen is de stapelvolgorde niet meer bepaald.
    const l = bouw(["uitleg", "toets", "video"], [[0, 1]]);
    const reden = verbindingsBezwaar(l.knopen[0]!, l.knopen[2]!, l);
    expect(reden).toMatch(/al een blok eronder/);
    expect(reden).toMatch(/vertakking/i);
  });

  it("weigert een tweede inkomende schakel", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1]]);
    const reden = verbindingsBezwaar(l.knopen[2]!, l.knopen[1]!, l);
    expect(reden).toMatch(/staat al onder een ander blok/);
  });

  it("weigert een kring", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1], [1, 2]]);
    expect(verbindingsBezwaar(l.knopen[2]!, l.knopen[0]!, l)).toMatch(/kring/);
  });

  it("laat een vertakking wél twee uitgangen houden", () => {
    const l = bouw(["vertakking", "uitleg", "toets"], [[0, 1]]);
    expect(verbindingsBezwaar(l.knopen[0]!, l.knopen[2]!, l)).toBeNull();
  });

  it("noemt bij een sectie wat de auteur dan wél moet doen", () => {
    const l = bouw(["sectie", "uitleg"]);
    expect(verbindingsBezwaar(l.knopen[0]!, l.knopen[1]!, l)).toMatch(/sleep hem boven/);
  });
});

/* ------------------------------------------------------------------ verbinden */

describe("verbindKnopen", () => {
  it("koppelt twee blokken tot één pagina", () => {
    const l = bouw(["uitleg", "toets"], [[0, 1]]);
    expect(ketens(l)).toEqual([["b1", "b2"]]);
  });

  it("weigert een tweede uitgaande schakel in plaats van de eerste stil te vervangen", () => {
    // Stil vervangen zou de vorige schakel weggooien terwijl de auteur denkt te splitsen.
    const l = bouw(["uitleg", "toets", "video"], [[0, 1], [0, 2]]);
    expect(l.verbindingen).toHaveLength(1);
    expect(ketens(l)).toEqual([["b1", "b2"], ["b3"]]);
  });

  it("laat een vertakking wél splitsen", () => {
    const l = bouw(["vertakking", "uitleg", "toets"], [[0, 1], [0, 2]]);
    expect(l.verbindingen).toHaveLength(2);
  });

  it("geeft de takken van een vertakking meteen een voorwaarde", () => {
    const l = bouw(["vertakking", "uitleg", "toets"], [[0, 1], [0, 2]]);
    const takken = l.verbindingen.filter((v) => v.van === "b1");
    expect(takken.map((v) => v.voorwaarde?.soort)).toEqual(["geslaagd", "gezakt"]);
  });

  it("laat een AI-knoop zijn doel wél verleggen", () => {
    const l = bouw(["ai", "uitleg", "toets"], [[0, 1], [0, 2]]);
    expect(l.verbindingen).toHaveLength(1);
    expect(aiDoel(l, "b1")!.id).toBe("b3");
  });

  it("weigert een kring", () => {
    const l = bouw(["uitleg", "toets"], [[0, 1], [1, 0]]);
    expect(l.verbindingen).toHaveLength(1);
  });

  it("maakt geen dubbele schakel", () => {
    const l = bouw(["uitleg", "toets"], [[0, 1], [0, 1]]);
    expect(l.verbindingen).toHaveLength(1);
  });
});

describe("bereikbaar", () => {
  it("volgt alle takken, niet alleen de eerste", () => {
    const l = bouw(["vertakking", "uitleg", "toets"], [[0, 1], [0, 2]]);
    expect(bereikbaar(l.verbindingen, "b1", "b3")).toBe(true);
    expect(bereikbaar(l.verbindingen, "b2", "b3")).toBe(false);
  });
});

/* ------------------------------------------------------- pagina-identiteit */

/**
 * De pagina-identiteit is de stilste belofte in dit model: hij bepaalt de IRI in de export, en of
 * die verschuift zie je pas als een rapportage maanden later in tweeën blijkt te vallen.
 */
describe("pagina-identiteit", () => {
  it("laat de identiteit meereizen als er een blok vóór de kop komt", () => {
    let l = bouw(["uitleg", "toets"], [[0, 1]]);
    l = zetPaginaTitel(l, "b1", "Introductie");
    const voor = paginasVan(l)[0]!;

    l = voegKnoopToe(l, "video", 0, 0);
    l = verbindKnopen(l, "b3", "b1");

    const na = paginasVan(l)[0]!;
    expect(na.kop.id).toBe("b3");
    expect(na.seed).toBe(voor.seed);
    expect(na.titel).toBe("Introductie");
  });

  it("laat bij het samenvoegen van twee gevulde pagina's de voorste kop winnen", () => {
    // Anders zou het aan elkaar knopen van twee schermen de identiteit van het tweede overnemen.
    let l = bouw(["uitleg", "toets", "video", "audio"], [[0, 1], [2, 3]]);
    const eerste = paginasVan(l)[0]!;
    l = verbindKnopen(l, "b2", "b3");
    const samen = paginasVan(l)[0]!;
    expect(samen.kop.id).toBe("b1");
    expect(samen.seed).toBe(eerste.seed);
  });

  it("geeft de identiteit door als de kop verwijderd wordt", () => {
    let l = bouw(["uitleg", "toets"], [[0, 1]]);
    l = zetPaginaTitel(l, "b1", "Introductie");
    const voor = paginasVan(l)[0]!;

    l = verwijderKnoop(l, "b1");
    const na = paginasVan(l)[0]!;
    expect(na.kop.id).toBe("b2");
    expect(na.seed).toBe(voor.seed);
    expect(na.titel).toBe("Introductie");
  });

  it("laat een keten die losgeknipt wordt zijn eigen identiteit houden", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1], [1, 2]]);
    const los = verbreekVerbinding(l, l.verbindingen.find((v) => v.van === "b2")!.id);
    const paginas = paginasVan(los);
    expect(paginas.map((p) => p.kop.id)).toEqual(["b1", "b3"]);
    expect(paginas[1]!.seed).toBe(los.knopen.find((k) => k.id === "b3")!.seed);
  });
});

describe("zetPaginaTitel", () => {
  it("zet de titel op de kop, ook als je een blok verderop selecteert", () => {
    let l = bouw(["uitleg", "toets"], [[0, 1]]);
    l = zetPaginaTitel(l, "b2", "Van onderaf gezet");
    expect(paginasVan(l)[0]!.titel).toBe("Van onderaf gezet");
    expect(l.knopen.find((k) => k.id === "b1")!.paginaTitel).toBe("Van onderaf gezet");
  });

  it("zet hem terug op de blokttitel bij een lege invoer", () => {
    let l = bouw(["uitleg"]);
    l = wijzigKnoop(l, "b1", { titel: "Valgevaar" });
    l = zetPaginaTitel(l, "b1", "Eigen naam");
    expect(paginasVan(l)[0]!.eigenTitel).toBe(true);
    l = zetPaginaTitel(l, "b1", "  ");
    expect(paginasVan(l)[0]!.titel).toBe("Valgevaar");
    expect(paginasVan(l)[0]!.eigenTitel).toBe(false);
  });
});

/* ------------------------------------------------------------------ verwijderen */

describe("verwijderKnoop", () => {
  it("heelt de keten zodat de pagina niet in tweeën valt", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1], [1, 2]]);
    expect(ketens(verwijderKnoop(l, "b2"))).toEqual([["b1", "b3"]]);
  });

  it("laat een verwijderde staart de rest met rust", () => {
    const l = bouw(["uitleg", "toets"], [[0, 1]]);
    expect(ketens(verwijderKnoop(l, "b2"))).toEqual([["b1"]]);
  });
});

/* ------------------------------------------------------------------ dupliceren */

describe("dupliceerKeten", () => {
  const basis = () => bouw(["uitleg", "toets"], [[0, 1]]);

  it("kopieert de hele keten inclusief onderdelen", () => {
    const na = dupliceerKeten(basis(), "b1");
    expect(paginasVan(na)).toHaveLength(2);
    expect(paginasVan(na)[1]!.onderdelen).toHaveLength(2);
  });

  it("werkt ook als je een blok verderop in de keten aanwijst", () => {
    const na = dupliceerKeten(basis(), "b2");
    expect(paginasVan(na)).toHaveLength(2);
  });

  it("legt de kopie als nieuwe rij eronder", () => {
    const na = dupliceerKeten(basis(), "b1");
    const [eerste, tweede] = paginasVan(na);
    expect(tweede!.kop.y).toBeGreaterThan(eerste!.kop.y);
    // en de onderdelen van de kopie liggen op één rij
    expect(new Set(tweede!.onderdelen.map((k) => k.y)).size).toBe(1);
  });

  it("geeft de kopie nieuwe seeds — het zijn andere blokken", () => {
    const na = dupliceerKeten(basis(), "b1");
    const seeds = na.knopen.map((k) => k.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    const [eerste, tweede] = paginasVan(na);
    expect(tweede!.seed).not.toBe(eerste!.seed);
  });

  it("erft de pagina-identiteit niet — een kopie is een andere pagina", () => {
    let l = basis();
    l = zetPaginaTitel(l, "b1", "Introductie");
    const na = dupliceerKeten(l, "b1");
    const [eerste, tweede] = paginasVan(na);
    expect(tweede!.seed).not.toBe(eerste!.seed);
    expect(tweede!.titel).toBe("Introductie (kopie)");
  });

  it("hangt de kopie aan niets — dat bepaalt de auteur zelf", () => {
    const na = dupliceerKeten(basis(), "b1");
    const kopieKop = paginasVan(na)[1]!.kop.id;
    expect(na.verbindingen.some((v) => v.naar === kopieKop)).toBe(false);
  });
});

/* ------------------------------------------------------------------- controle */

describe("controleerLeerpad", () => {
  it("meldt niets over een verse module met één blok", () => {
    // Dit is de belofte van het nieuwe model: één Uitleg-blok is meteen één pagina, zonder gezeur.
    let l = voegKnoopToe(leeg, "uitleg", 0, 0);
    l = wijzigKnoop(l, "b1", { titel: "Valgevaar", fragment: "Vanaf 2,5 meter." });
    expect(controleerLeerpad(l)).toEqual([]);
  });

  it("klaagt niet meer over een ontbrekende cursus- of paginaknoop", () => {
    const l = leerpadUitContent(content);
    const codes = controleerLeerpad(l).map((p) => p.code);
    expect(codes).not.toContain("geen-cursus");
    expect(codes).not.toContain("geen-paginas");
    expect(codes).not.toContain("los-blok");
  });

  it("meldt een blok dat de auteur begonnen maar niet afgemaakt heeft", () => {
    let l = voegKnoopToe(leeg, "uitleg", 0, 0);
    l = wijzigKnoop(l, "b1", { titel: "Valgevaar" });
    expect(controleerLeerpad(l).map((p) => p.code)).toContain("leeg-blok");
  });

  it("zwijgt over een blok dat nog precies uit het palet komt", () => {
    // Een verse module bestaat uit één leeg blok; die begroeten met "is nog niet af" is het
    // gereedschap dat klaagt over zijn eigen beginsituatie.
    const l = voegKnoopToe(leeg, "uitleg", 0, 0);
    expect(controleerLeerpad(l)).toEqual([]);
  });

  it("meldt een vertakking met te weinig uitgangen", () => {
    const l = bouw(["vertakking", "uitleg"], [[0, 1]]);
    const p = controleerLeerpad(l).find((x) => x.code === "vertakking-te-smal")!;
    expect(p.ernst).toBe("blokkeert");
  });

  it("meldt twee takken met dezelfde voorwaarde", () => {
    let l = bouw(["vertakking", "uitleg", "toets"], [[0, 1], [0, 2]]);
    const tweede = l.verbindingen.filter((v) => v.van === "b1")[1]!;
    l = zetVoorwaarde(l, tweede.id, { soort: "geslaagd" });
    expect(controleerLeerpad(l).map((p) => p.code)).toContain("dubbele-voorwaarde");
  });

  it("meldt een AI-knoop zonder doel", () => {
    const l = bouw(["ai"]);
    expect(controleerLeerpad(l).map((p) => p.code)).toContain("ai-zonder-doel");
  });

  it("meldt een kring, ook al kan de UI er geen maken", () => {
    // Gemigreerde of met de hand bewerkte data kan er wél een bevatten.
    const l = bouw(["uitleg", "toets"], [[0, 1]]);
    const kring: Leerpad = {
      ...l,
      verbindingen: [...l.verbindingen, { id: "kx", van: "b2", naar: "b1" }],
    };
    const p = controleerLeerpad(kring).filter((x) => x.code === "cyclus");
    expect(p).toHaveLength(2);
    expect(p[0]!.ernst).toBe("blokkeert");
  });
});

/* ------------------------------------------------------------------ assessment */

describe("assessmentChecks", () => {
  it("pakt de checks die er op dezelfde pagina vóór staan", () => {
    const l = bouw(
      ["toets", "reflectie", "assessment"],
      [[0, 1], [1, 2]],
    );
    expect(assessmentChecks(l, "b3").map((k) => k.id)).toEqual(["b1", "b2"]);
  });

  it("stopt bij een eerder assessment", () => {
    const l = bouw(
      ["toets", "assessment", "reflectie", "assessment"],
      [[0, 1], [1, 2], [2, 3]],
    );
    expect(assessmentChecks(l, "b4").map((k) => k.id)).toEqual(["b3"]);
  });

  it("kijkt niet over de paginagrens heen", () => {
    const l = bouw(["toets", "assessment"], []);
    expect(assessmentChecks(l, "b2")).toEqual([]);
  });
});

describe("totaleMinuten", () => {
  it("telt alle pagina's op", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1]]);
    expect(totaleMinuten(l)).toBe(l.knopen.reduce((s, k) => s + k.minuten, 0));
  });
});

/* ------------------------------------------------------------- uit de content */

describe("leerpadUitContent", () => {
  it("levert drie ketens op — inleiding, inhoud, toets — zonder container eromheen", () => {
    // Hiervóór was dit één keten van alles. Dat gaf de cursist een menu met één item en een
    // pagina van elf blokken; de verdeling zit nu in de bouwer.
    const l = leerpadUitContent(content);
    expect(l.knopen.map((k) => k.soort)).not.toContain("sectie");
    expect(ketens(l)).toEqual([["intro"], ["s0", "s1", "samenvatting"], ["v0"]]);
  });

  it("levert meteen drie pagina's zonder waarschuwing", () => {
    const l = leerpadUitContent(content);
    expect(paginasVan(l)).toHaveLength(3);
    expect(controleerLeerpad(l).filter((p) => p.ernst === "blokkeert")).toEqual([]);
  });

  it("geeft de pagina's een naam die in het menu bruikbaar is", () => {
    // Zonder eigen naam zou de toetspagina "Vraag 1" heten — de titel van zijn eerste blok.
    expect(paginasVan(leerpadUitContent(content)).map((p) => p.titel)).toEqual([
      "Inleiding",
      "Inhoud",
      "Toets",
    ]);
  });
});

describe("synchroniseerMetContent", () => {
  it("werkt de tekst bij en laat de structuur staan", () => {
    let l = leerpadUitContent(content);
    l = { ...l, knopen: l.knopen.map((k) => (k.id === "s0" ? { ...k, x: 777 } : k)) };
    const gewijzigd: GeneratedContent = {
      ...content,
      secties: [{ type: "uitleg", kop: "Nieuwe kop", tekst: "Nieuw." }, content.secties[1]!],
    };
    const na = synchroniseerMetContent(l, gewijzigd);
    const s0 = na.knopen.find((k) => k.id === "s0")!;
    expect(s0.titel).toBe("Nieuwe kop");
    expect(s0.x).toBe(777);
    // De inleiding is nu een eigen pagina met alleen het introblok erop.
    expect(paginasVan(na)[0]!.onderdelen.map((k) => k.id)).toEqual(["intro"]);
    expect(paginasVan(na)[1]!.onderdelen.map((k) => k.id)).toEqual(["s0", "s1", "samenvatting"]);
  });

  it("laat een zelf geplaatste knoop met rust", () => {
    let l = leerpadUitContent(content);
    l = voegKnoopToe(l, "video", 400, 400);
    l = wijzigKnoop(l, "b1", { titel: "Introfilm", fragment: "Twee minuten." });
    const na = synchroniseerMetContent(l, content);
    expect(na.knopen.find((k) => k.id === "b1")!.titel).toBe("Introfilm");
  });

  it("zet een nieuw contentblok als eigen pagina neer, niet stil in een bestaande", () => {
    const l = leerpadUitContent(content);
    const meer: GeneratedContent = {
      ...content,
      secties: [...content.secties, { type: "uitleg", kop: "Derde", tekst: "Nog iets." }],
    };
    const na = synchroniseerMetContent(l, meer);
    const paginas = paginasVan(na);
    // Drie vaste pagina's plus de nieuwe sectie die als eigen pagina landt.
    expect(paginas).toHaveLength(4);
    expect(paginas.some((p) => p.onderdelen.some((k) => k.id === "s2"))).toBe(true);
  });

  it("een verdwenen blok wordt verwijderd en de keten geheeld", () => {
    const l = leerpadUitContent(content);
    const minder: GeneratedContent = { ...content, secties: [content.secties[0]!] };
    const na = synchroniseerMetContent(l, minder);
    expect(na.knopen.some((k) => k.id === "s1")).toBe(false);
    expect(ketens(na)).toEqual([["intro"], ["s0", "samenvatting"], ["v0"]]);
  });
});

describe("verbreekVerbinding", () => {
  it("maakt van de rest een eigen pagina", () => {
    const l = bouw(["uitleg", "video"], [[0, 1]]);
    const eerste = l.verbindingen.find((v) => v.van === "b1")!;
    expect(ketens(verbreekVerbinding(l, eerste.id))).toEqual([["b1"], ["b2"]]);
  });
});

/* ------------------------------------------------------- waar de tekst staat */

describe("tekstbron / leesTekst / contentMetTekst", () => {
  it("wijst een contentblok naar de content, niet naar de knoop", () => {
    const l = leerpadUitContent(content);
    const intro = l.knopen.find((k) => k.id === "intro")!;
    const s0 = l.knopen.find((k) => k.id === "s0")!;
    expect(tekstbron(intro)).toEqual({ soort: "intro" });
    expect(tekstbron(s0)).toEqual({ soort: "sectie", index: 0 });
    expect(leesTekst(intro, content)).toBe(content.intro);
    expect(leesTekst(s0, content)).toBe(content.secties[0]!.tekst);
  });

  it("wijst een zelf geplaatst blok naar de knoop", () => {
    let l = voegKnoopToe(leeg, "uitleg", 0, 0);
    l = wijzigKnoop(l, "b1", { uitvoer: "Zelf getypt." });
    const k = l.knopen[0]!;
    expect(tekstbron(k)).toEqual({ soort: "knoop" });
    expect(leesTekst(k, content)).toBe("Zelf getypt.");
    expect(contentMetTekst(k, content, "iets")).toBeNull();
  });

  it("schrijft naar de plek waar de cursist het leest", () => {
    const l = leerpadUitContent(content);
    const s1 = l.knopen.find((k) => k.id === "s1")!;
    const na = contentMetTekst(s1, content, "Herschreven.")!;
    expect(na.secties[1]!.tekst).toBe("Herschreven.");
    expect(na.secties[0]!.tekst).toBe(content.secties[0]!.tekst);
    expect(na.intro).toBe(content.intro);
  });

  it("laat lezen en schrijven op elkaar aansluiten", () => {
    const l = leerpadUitContent(content);
    for (const id of ["intro", "s0", "s1", "samenvatting"]) {
      const k = l.knopen.find((x) => x.id === id)!;
      const na = contentMetTekst(k, content, "X")!;
      expect(leesTekst(k, na)).toBe("X");
    }
  });

  it("geeft null voor knopen die geen tekst dragen", () => {
    const l = bouw(["sectie", "vertakking"]);
    for (const k of l.knopen) {
      expect(tekstbron(k)).toBeNull();
      expect(leesTekst(k, content)).toBeNull();
    }
  });

  it("valt niet om bij een index die niet meer bestaat", () => {
    const l = leerpadUitContent(content);
    const s1 = l.knopen.find((k) => k.id === "s1")!;
    const korter: GeneratedContent = { ...content, secties: [content.secties[0]!] };
    expect(leesTekst(s1, korter)).toBe("");
    expect(contentMetTekst(s1, korter, "X")).toBeNull();
  });
});

/* ------------------------------------------------------------------ voorwaarden */

describe("voorwaarden", () => {
  it("onderscheidt een keuze op zijn label", () => {
    expect(voorwaardeSleutel({ soort: "keuze", label: "Ja" })).not.toBe(
      voorwaardeSleutel({ soort: "keuze", label: "Nee" }),
    );
    expect(voorwaardeSleutel(undefined)).toBe("altijd");
  });

  it("schrijft een voorwaarde leesbaar op", () => {
    expect(voorwaardeTekst({ soort: "gezakt" })).toBe("gezakt");
    expect(voorwaardeTekst({ soort: "keuze", label: "  " })).toBe("keuze zonder naam");
  });
});

describe("XAPI_WERKWOORDEN", () => {
  it("komen uit @ob/schema en zijn geldige IRI's", () => {
    for (const w of XAPI_WERKWOORDEN) expect(w.iri).toMatch(/^https?:\/\//);
  });
});

/* ------------------------------------------------------- stabiele identiteit */

/**
 * De seed is waar de xAPI-identiteit aan hangt. Verschuift hij, dan wijst de historie in de LRS
 * na een herbouw naar een ander blok — en dat merk je pas als iemand maanden later een rapportage
 * opvraagt.
 */
describe("seeds", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("geeft elke knoop een geldige UUID", () => {
    const l = leerpadUitContent(content);
    for (const k of l.knopen) expect(k.seed).toMatch(UUID);
  });

  it("deelt nooit dezelfde seed uit aan twee knopen", () => {
    let l = leerpadUitContent(content);
    for (const soort of ["uitleg", "video", "toets", "sectie"] as const) {
      l = voegKnoopToe(l, soort, 0, 0);
    }
    const seeds = l.knopen.map((k) => k.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("laat de seed met rust bij synchroniseren met gewijzigde content", () => {
    const l = leerpadUitContent(content);
    const voor = new Map(l.knopen.map((k) => [k.id, k.seed]));
    const gewijzigd: GeneratedContent = {
      ...content,
      intro: "Heel andere intro.",
      secties: [{ type: "uitleg", kop: "Andere kop", tekst: "Andere tekst." }, content.secties[1]!],
    };
    const na = synchroniseerMetContent(l, gewijzigd);
    for (const k of na.knopen) {
      if (voor.has(k.id)) expect(k.seed).toBe(voor.get(k.id));
    }
  });

  it("blijft stabiel over herhaald synchroniseren", () => {
    let l = leerpadUitContent(content);
    const eerste = l.knopen.find((k) => k.id === "s0")!.seed;
    for (let i = 0; i < 5; i += 1) l = synchroniseerMetContent(l, content);
    expect(l.knopen.find((k) => k.id === "s0")!.seed).toBe(eerste);
  });

  it("overleeft verplaatsen, wijzigen en verbinden", () => {
    let l = leerpadUitContent(content);
    const voor = l.knopen.find((k) => k.id === "s0")!.seed;
    l = wijzigKnoop(l, "s0", { titel: "Anders" });
    l = { ...l, knopen: l.knopen.map((k) => (k.id === "s0" ? { ...k, x: 999 } : k)) };
    expect(l.knopen.find((k) => k.id === "s0")!.seed).toBe(voor);
  });
});

describe("voorzieVanSeeds", () => {
  it("vult aan wat ontbreekt bij een project van vóór de seeds", () => {
    const oud = leerpadUitContent(content);
    const zonder: Leerpad = {
      ...oud,
      knopen: oud.knopen.map(({ seed: _weg, ...rest }) => rest as never),
    };
    const na = voorzieVanSeeds(zonder);
    for (const k of na.knopen) expect(k.seed).toBeTruthy();
    expect(new Set(na.knopen.map((k) => k.seed)).size).toBe(na.knopen.length);
  });

  it("laat bestaande seeds ongemoeid — anders verschuift de identiteit bij elke keer openen", () => {
    const l = leerpadUitContent(content);
    expect(voorzieVanSeeds(l)).toBe(l);
    const twee = voorzieVanSeeds(voorzieVanSeeds(l));
    expect(twee.knopen.map((k) => k.seed)).toEqual(l.knopen.map((k) => k.seed));
  });

  it("vult alleen de ontbrekende aan, niet allemaal", () => {
    const l = leerpadUitContent(content);
    const behouden = l.knopen[0]!.seed;
    const half: Leerpad = {
      ...l,
      knopen: l.knopen.map((k, i) => (i === 1 ? { ...k, seed: "" } : k)),
    };
    const na = voorzieVanSeeds(half);
    expect(na.knopen[0]!.seed).toBe(behouden);
    expect(na.knopen[1]!.seed).toBeTruthy();
  });
});

/* ------------------------------------------------------- carrousel-stappen */

describe("de stappen van een carrousel", () => {
  const drie: CarrouselItem[] = [
    { id: "i1", kop: "Een", tekst: "a" },
    { id: "i2", kop: "Twee", tekst: "b" },
    { id: "i3", kop: "Drie", tekst: "c" },
  ];

  it("geeft een nieuwe stap het eerste vrije id", () => {
    expect(vrijItemId(drie)).toBe("i4");
    // Een gat wordt opgevuld: anders lopen de ids op tot in het oneindige terwijl er drie staan.
    expect(vrijItemId([drie[0]!, drie[2]!])).toBe("i2");
  });

  it("zet een nieuwe stap achteraan", () => {
    const uit = metNieuwItem(drie);
    expect(uit).toHaveLength(4);
    expect(uit.at(-1)).toEqual({ id: "i4", kop: "", tekst: "" });
  });

  it("wijzigt alleen de stap die je aanwijst", () => {
    const uit = metGewijzigdItem(drie, "i2", { kop: "Anders" });
    expect(uit.map((i) => i.kop)).toEqual(["Een", "Anders", "Drie"]);
  });

  it("verplaatst een stap zonder hem te verdubbelen", () => {
    const omhoog = metVerplaatstItem(drie, "i3", -1);
    expect(omhoog.map((i) => i.id)).toEqual(["i1", "i3", "i2"]);
    expect(new Set(omhoog.map((i) => i.id)).size).toBe(3);
  });

  it("doet niets aan de randen van de lijst", () => {
    expect(metVerplaatstItem(drie, "i1", -1)).toEqual(drie);
    expect(metVerplaatstItem(drie, "i3", 1)).toEqual(drie);
    expect(metVerplaatstItem(drie, "bestaat-niet", 1)).toEqual(drie);
  });

  it("verwijdert een stap, maar houdt er minstens twee over", () => {
    const twee = zonderItem(drie, "i2");
    expect(twee.map((i) => i.id)).toEqual(["i1", "i3"]);
    // Onder de twee valt er niets door te klikken; de export weigert zo'n blok toch.
    expect(zonderItem(twee, "i1")).toEqual(twee);
  });

  it("begint met twee lege stappen en telt daarmee nog niet als af", () => {
    const l = voegKnoopToe(leerpadUitContent(content), "carrousel", 0, 0);
    const knoop = l.knopen.at(-1)!;
    expect(knoop.items).toHaveLength(2);
    expect(knoop.klaar).toBe(false);
    // En zodra er inhoud in een stap staat, is hij wel af.
    const gevuld = wijzigKnoop(l, knoop.id, {
      items: metGewijzigdItem(knoop.items!, "i1", { kop: "Het signaal" }),
    });
    expect(gevuld.knopen.at(-1)!.klaar).toBe(true);
  });
});

/* ------------------------------------------------------------------ alt-tekst */

describe("beeld zonder alt-tekst", () => {
  const plaatje = (alt?: string) => ({
    naam: "steiger.png",
    mime: "image/png",
    grootte: 1234,
    url: "/api/bestand/0123456789abcdef0123456789abcdef",
    hercodeerd: true,
    ...(alt === undefined ? {} : { alt }),
  });

  const metBeeld = (alt?: string) => {
    let l = voegKnoopToe(leerpadUitContent(content), "afbeelding", 0, 0);
    const id = l.knopen.at(-1)!.id;
    l = wijzigKnoop(l, id, { titel: "Steigerfoto", fragment: "Een steiger.", bestand: plaatje(alt) });
    return { l, id };
  };

  it("houdt het blok niet-af tot de beschrijving er staat", () => {
    const { l, id } = metBeeld();
    expect(l.knopen.find((k) => k.id === id)!.klaar).toBe(false);
    const na = wijzigKnoop(l, id, { bestand: plaatje("Een steiger met leuning en kantplank.") });
    expect(na.knopen.find((k) => k.id === id)!.klaar).toBe(true);
  });

  it("blokkeert in de controlelijst en zegt waarom", () => {
    const { l } = metBeeld();
    const p = controleerLeerpad(l).find((x) => x.code === "beeld-zonder-alt")!;
    expect(p).toBeDefined();
    expect(p.ernst).toBe("blokkeert");
    expect(p.bericht).toContain("Steigerfoto");
    expect(p.bericht).toContain("gepubliceerd");
  });

  it("meldt niet óók dat het blok nog niet af is — dat is hetzelfde probleem", () => {
    const { l } = metBeeld();
    const codes = controleerLeerpad(l).map((p) => p.code);
    expect(codes).toContain("beeld-zonder-alt");
    expect(codes).not.toContain("leeg-blok");
  });

  it("noemt de stap van een carrousel waar het beeld zonder beschrijving staat", () => {
    let l = voegKnoopToe(leerpadUitContent(content), "carrousel", 0, 0);
    const id = l.knopen.at(-1)!.id;
    l = wijzigKnoop(l, id, {
      titel: "De keten",
      items: [
        { id: "i1", kop: "Het signaal", tekst: "a", bestand: plaatje() },
        { id: "i2", kop: "Het onderzoek", tekst: "b" },
      ],
    });
    expect(ontbrekendeAlt(l.knopen.find((k) => k.id === id)!)).toEqual(["Het signaal"]);
    const p = controleerLeerpad(l).find((x) => x.code === "beeld-zonder-alt")!;
    expect(p.bericht).toContain("Het signaal");
  });

  it("vraagt geen alt-tekst bij geluid — daar helpt een transcript, geen beschrijving", () => {
    let l = voegKnoopToe(leerpadUitContent(content), "audio", 0, 0);
    const id = l.knopen.at(-1)!.id;
    l = wijzigKnoop(l, id, {
      titel: "Intro",
      fragment: "Welkom",
      bestand: { ...plaatje(), naam: "intro.mp3", mime: "audio/mpeg" },
    });
    expect(ontbrekendeAlt(l.knopen.find((k) => k.id === id)!)).toEqual([]);
    expect(l.knopen.find((k) => k.id === id)!.klaar).toBe(true);
  });
});

describe("het zoekvoorstel voor de mediazoeker", () => {
  const beeld = (velden: Record<string, unknown>) => {
    let l = voegKnoopToe(leerpadUitContent(content), "afbeelding", 0, 0);
    const id = l.knopen.at(-1)!.id;
    if (Object.keys(velden).length > 0) l = wijzigKnoop(l, id, velden);
    return l.knopen.find((k) => k.id === id)!;
  };

  it("stelt niets voor bij een verse knoop", () => {
    // Anders opent het venster met "Nieuwe afbeelding" en zoekt het meteen naar iets wat
    // gegarandeerd niets oplevert.
    expect(zoekvoorstel(beeld({}))).toBe("");
  });

  it("neemt de prompt boven de toelichting en de titel", () => {
    const k = beeld({ titel: "Steiger", fragment: "Een steiger", prompt: "foto van een steiger" });
    expect(zoekvoorstel(k)).toBe("foto van een steiger");
  });

  it("valt terug op de toelichting en dan op een zelfgekozen titel", () => {
    expect(zoekvoorstel(beeld({ fragment: "Een steiger op de bouw" }))).toBe("Een steiger op de bouw");
    expect(zoekvoorstel(beeld({ titel: "Steigerfoto" }))).toBe("Steigerfoto");
  });
});
