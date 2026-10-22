/**
 * Het leerpad op het whiteboard. Puur, dus hier te testen — en dit is precies het deel waar een
 * fout stil is: een knoop die naar zichzelf verwijst tekent een oneindige lus, een pad dat een
 * blok overslaat laat de auteur content missen die er wél is, en een knoop die buiten het canvas
 * valt is onbereikbaar zonder dat iets faalt.
 */
import { describe, it, expect } from "vitest";
import { VERBS } from "@ob/schema";
import {
  bouwLeerpad,
  schatMinuten,
  SECONDEN_PER_VRAAG,
  totaleMinuten,
  vraagIsKlaar,
  type Knoop,
  canvasBreedte,
  canvasHoogte,
  herstelLayout,
  KANT_MARGE,
  KNOOP_BREEDTE,
  verbindKetting,
  verplaatsKnoop,
} from "../graph";
import type { GeneratedContent, Vraag } from "../types";

function maakContent(secties: number, vragen: number): GeneratedContent {
  return {
    titel: "Veilig werken op hoogte",
    intro: "In deze module leer je de basis van veilig werken op hoogte.",
    secties: Array.from({ length: secties }, (_, i) => ({
      kop: `Sectie ${i + 1}`,
      tekst: `Tekst van sectie ${i + 1}.`,
      type: "uitleg" as const,
    })),
    vragen: Array.from({ length: vragen }, (_, i) => ({
      vraagvorm: "Meerkeuze",
      vorm: "keuze" as const,
      vraag: `Vraag ${i + 1}?`,
      opties: ["A", "B"],
      correct: 0,
      feedback: "Uitleg.",
    })),
    samenvatting: "Kort samengevat.",
  };
}

const content = maakContent(3, 6);

/* ------------------------------------------------------------------ knopen */

describe("bouwLeerpad — welke knopen", () => {
  it("maakt intro + elke sectie + elke vraag + samenvatting", () => {
    const { knopen } = bouwLeerpad(content);
    expect(knopen).toHaveLength(1 + 3 + 6 + 1);
  });

  it("zet ze in leesvolgorde: inleiding, de stof met de samenvatting, dan de toets", () => {
    // De volgorde veranderde toen de bouwer drie pagina's ging maken in plaats van één. De
    // samenvatting staat nu vóór de vragen, want hij sluit de stof af: eerst samenvatten, dan
    // toetsen. Dit is ook de volgorde waarin de cursist ze krijgt.
    const { knopen } = bouwLeerpad(content);
    expect(knopen.map((k) => k.id)).toEqual([
      "intro",
      "s0",
      "s1",
      "s2",
      "samenvatting",
      "v0",
      "v1",
      "v2",
      "v3",
      "v4",
      "v5",
    ]);
  });

  it("geeft elke knoop een unieke id", () => {
    const ids = bouwLeerpad(content).knopen.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("bewaart de index zodat een knoop naar zijn blok terugwijst", () => {
    const { knopen } = bouwLeerpad(content);
    expect(knopen.find((k) => k.id === "s2")?.index).toBe(2);
    expect(knopen.find((k) => k.id === "v5")?.index).toBe(5);
    expect(knopen.find((k) => k.id === "intro")?.index).toBeNull();
  });

  it("gebruikt de sectiekop als titel en de tekst als fragment", () => {
    const k = bouwLeerpad(content).knopen.find((x) => x.id === "s0");
    expect(k?.titel).toBe("Sectie 1");
    expect(k?.fragment).toBe("Tekst van sectie 1.");
  });

  it("kort een lang fragment af met een ellips", () => {
    const lang = maakContent(1, 0);
    lang.secties[0]!.tekst = "x".repeat(300);
    const k = bouwLeerpad(lang).knopen.find((x) => x.id === "s0");
    expect(k?.fragment.length).toBeLessThanOrEqual(90);
    expect(k?.fragment.endsWith("…")).toBe(true);
  });

  it("vouwt witruimte in het fragment samen", () => {
    const rommelig = maakContent(1, 0);
    rommelig.secties[0]!.tekst = "regel een\n\n  regel twee";
    expect(bouwLeerpad(rommelig).knopen.find((x) => x.id === "s0")?.fragment).toBe(
      "regel een regel twee",
    );
  });
});

/* ------------------------------------------------------------------ layout */

describe("bouwLeerpad — layout", () => {
  it("laat geen twee knopen op dezelfde plek staan", () => {
    const { knopen } = bouwLeerpad(content);
    const plekken = knopen.map((k) => `${k.x},${k.y}`);
    expect(new Set(plekken).size).toBe(plekken.length);
  });

  it("houdt elke knoop binnen het canvas", () => {
    const { knopen, breedte, hoogte } = bouwLeerpad(content);
    for (const k of knopen) {
      expect(k.x).toBeGreaterThanOrEqual(0);
      expect(k.y).toBeGreaterThanOrEqual(0);
      expect(k.x + KNOOP_BREEDTE).toBeLessThanOrEqual(breedte);
      expect(k.y).toBeLessThan(hoogte);
    }
  });

  it("zet elke pagina op een eigen baan, en houdt een pagina één rij", () => {
    // Een pagina is één rij die naar rechts doorloopt; de drie pagina's liggen onder elkaar.
    // Binnen een baan mag geen x tweemaal voorkomen, anders staan er twee blokken op elkaar.
    const veel = maakContent(0, 6);
    const { knopen } = bouwLeerpad(veel);
    const banen = new Map<number, number[]>();
    for (const k of knopen) banen.set(k.y, [...(banen.get(k.y) ?? []), k.x]);

    // Inleiding, inhoud en toets: drie banen.
    expect(banen.size).toBe(3);
    for (const xen of banen.values()) expect(new Set(xen).size).toBe(xen.length);
  });

  it("zet de samenvatting achteraan de inhoudsbaan, niet achter de vragen", () => {
    const { knopen } = bouwLeerpad(content);
    const sam = knopen.find((k) => k.bron === "samenvatting")!;
    // Op `index` en niet op de id: `startsWith("s")` pakt "samenvatting" ook mee, en dan
    // vergelijkt dit blok zichzelf.
    const secties = knopen.filter((k) => k.soort === "uitleg" && k.index !== null);
    const vragen = knopen.filter((k) => k.soort === "toets");

    // Hij sluit de stof af: zelfde baan als de secties, verder naar rechts dan alle.
    for (const s of secties) {
      expect(sam.y).toBe(s.y);
      expect(sam.x).toBeGreaterThan(s.x);
    }
    // En de vragen liggen op een eigen baan eronder.
    for (const v of vragen) expect(v.y).toBeGreaterThan(sam.y);
  });

  it("geeft een gegenereerde vraag hetzelfde werkwoord als een handgemaakte", () => {
    // Dit ontbrak, en het faalde stil: zonder werkwoord valt de export terug op `experienced`.
    // De LRS hoorde dan dat de cursist de vraag gezíén had, niet dat hij antwoordde — precies de
    // gegevens waar dit product voor bestaat. De controlelijst klaagde er bij élke gegenereerde
    // module over, over blokken die de auteur niet zelf had neergezet.
    const vragen = bouwLeerpad(content).knopen.filter((k) => k.soort === "toets");
    expect(vragen.length).toBeGreaterThan(0);
    for (const v of vragen) {
      expect(v.xapiWerkwoord).toBe(VERBS.answered);
      expect(v.vraagvorm).toBe("meerkeuze");
    }
  });

  it("geeft elke pagina een naam die in het menu bruikbaar is", () => {
    // Zonder deze namen heet de toetspagina "Vraag 1" — de titel van zijn eerste blok.
    const { knopen } = bouwLeerpad(content);
    expect(knopen.find((k) => k.id === "intro")?.paginaTitel).toBe("Inleiding");
    expect(knopen.find((k) => k.id === "s0")?.paginaTitel).toBe("Inhoud");
    expect(knopen.find((k) => k.id === "v0")?.paginaTitel).toBe("Toets");
    // Alleen de kop draagt hem: anders zou elk blok een pagina willen beginnen.
    expect(knopen.find((k) => k.id === "s1")?.paginaTitel).toBeUndefined();
  });

  it("begint linksboven op de marge", () => {
    const intro = bouwLeerpad(content).knopen[0]!;
    expect(intro.x).toBe(KANT_MARGE);
    expect(intro.y).toBe(KANT_MARGE);
  });
});

/* -------------------------------------------------------------- verbindingen */

describe("verbindKetting", () => {
  it("verbindt elke pagina tot een eigen doorlopend pad", () => {
    // Drie ketens, dus drie schakels minder dan bij één lange ketting. Zou dit weer één pad
    // worden, dan smelten de drie pagina's terug tot één — dat is precies wat hier misging.
    const { knopen, verbindingen } = bouwLeerpad(content);
    expect(verbindingen).toHaveLength(knopen.length - 3);
  });

  it("geeft elke schakel een unieke id, ook over de drie ketens heen", () => {
    // Drie ketens die allemaal bij `k0` beginnen leveren drie schakels met dezelfde id op, en dan
    // verwijdert het wissen van één schakel er stilletjes drie.
    const ids = bouwLeerpad(content).verbindingen.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("laat geen knoop naar zichzelf wijzen", () => {
    for (const v of bouwLeerpad(content).verbindingen) {
      expect(v.van).not.toBe(v.naar);
    }
  });

  it("verwijst alleen naar bestaande knopen", () => {
    const { knopen, verbindingen } = bouwLeerpad(content);
    const ids = new Set(knopen.map((k) => k.id));
    for (const v of verbindingen) {
      expect(ids.has(v.van)).toBe(true);
      expect(ids.has(v.naar)).toBe(true);
    }
  });

  it("maakt van elke baan één doorlopende keten — geen blok valt eruit", () => {
    // Niet meer "elke knoop wordt geraakt": een baan met één blok heeft geen schakels, en dat
    // blok is gewoon een pagina met één onderdeel. Wat wél moet gelden is dat een baan van n
    // blokken n-1 schakels heeft; één ontbrekende schakel splitst een pagina stilzwijgend in twee.
    const { knopen, verbindingen } = bouwLeerpad(content);
    const banen = new Map<number, string[]>();
    for (const k of knopen) banen.set(k.y, [...(banen.get(k.y) ?? []), k.id]);

    for (const ids of banen.values()) {
      const binnen = verbindingen.filter((v) => ids.includes(v.van) && ids.includes(v.naar));
      expect(binnen).toHaveLength(ids.length - 1);
    }
    // En geen enkele schakel springt tussen twee banen: dat zou de pagina's samenvoegen.
    const baanVan = new Map(knopen.map((k) => [k.id, k.y]));
    for (const v of verbindingen) expect(baanVan.get(v.van)).toBe(baanVan.get(v.naar));
  });

  it("levert geen verbindingen bij één knoop", () => {
    const een: Knoop = {
      id: "a",
      seed: "11111111-1111-4111-8111-111111111111",
      soort: "uitleg",
      titel: "",
      fragment: "",
      index: null,
      eigen: false,
      minuten: 1,
      klaar: true,
      x: 0,
      y: 0,
    };
    expect(verbindKetting([een])).toEqual([]);
  });

  it("levert niets bij een leeg pad", () => {
    expect(verbindKetting([])).toEqual([]);
  });
});

/* ----------------------------------------------------- randgevallen in content */

describe("lege of minimale content", () => {
  it("werkt zonder secties en zonder vragen", () => {
    const { knopen, verbindingen } = bouwLeerpad(maakContent(0, 0));
    // Twee gewone uitleg-blokken; de markering zegt welk contentveld ze tonen.
    expect(knopen.map((k) => k.soort)).toEqual(["uitleg", "uitleg"]);
    expect(knopen.map((k) => k.bron)).toEqual(["intro", "samenvatting"]);
    // Elk op een eigen baan, dus ieder een eigen pagina en geen schakel ertussen.
    expect(verbindingen).toEqual([]);
  });

  it("werkt met alleen vragen", () => {
    const { knopen } = bouwLeerpad(maakContent(0, 2));
    expect(knopen.map((k) => k.id)).toEqual(["intro", "samenvatting", "v0", "v1"]);
  });

  it("zet de samenvatting op de inhoudsbaan, onder de inleiding", () => {
    const { knopen } = bouwLeerpad(maakContent(0, 0));
    const intro = knopen.find((k) => k.bron === "intro")!;
    const sam = knopen.find((k) => k.bron === "samenvatting")!;
    expect(sam.y).toBeGreaterThan(intro.y);
    // Hij is de kop van zijn eigen baan en begint dus weer links.
    expect(sam.x).toBe(intro.x);
  });
});

/* ------------------------------------------------------------ verplaatsKnoop */

describe("verplaatsKnoop", () => {
  const { knopen } = bouwLeerpad(content);
  // Ruime grens: deze tests gaan over het verplaatsen zelf, niet over het klemmen.
  const grens = { breedte: 9999, hoogte: 9999 };

  it("verplaatst de bedoelde knoop", () => {
    const na = verplaatsKnoop(knopen, "s1", 100, 200, grens);
    const k = na.find((x) => x.id === "s1")!;
    expect(k.x).toBe(100);
    expect(k.y).toBe(200);
  });

  it("laat de andere knopen staan", () => {
    const na = verplaatsKnoop(knopen, "s1", 100, 200, grens);
    for (const k of na.filter((x) => x.id !== "s1")) {
      const voor = knopen.find((v) => v.id === k.id)!;
      expect([k.x, k.y]).toEqual([voor.x, voor.y]);
    }
  });

  it("klemt binnen het canvas, ook bij absurde waarden", () => {
    const ver = verplaatsKnoop(knopen, "s0", 99999, 99999, grens);
    const k = ver.find((x) => x.id === "s0")!;
    expect(k.x + KNOOP_BREEDTE).toBeLessThanOrEqual(grens.breedte);
    expect(k.y).toBeLessThanOrEqual(grens.hoogte);
  });

  it("klemt ook negatieve waarden op nul", () => {
    const k = verplaatsKnoop(knopen, "s0", -500, -500, grens).find((x) => x.id === "s0")!;
    expect(k.x).toBe(0);
    expect(k.y).toBe(0);
  });

  it("negeert een onbekende id", () => {
    expect(verplaatsKnoop(knopen, "bestaat-niet", 10, 10, grens)).toEqual(knopen);
  });

  it("muteert de invoer niet", () => {
    const voor = knopen.find((k) => k.id === "s0")!.x;
    verplaatsKnoop(knopen, "s0", 1, 1, grens);
    expect(knopen.find((k) => k.id === "s0")!.x).toBe(voor);
  });
});

/* --------------------------------------------------------- canvas & herstel */

describe("canvasBreedte / canvasHoogte", () => {
  it("laat rechts en onder marge over", () => {
    const { knopen, breedte, hoogte } = bouwLeerpad(content);
    const meestRechts = Math.max(...knopen.map((k) => k.x + KNOOP_BREEDTE));
    expect(breedte).toBeGreaterThan(meestRechts);
    expect(hoogte).toBeGreaterThan(Math.max(...knopen.map((k) => k.y)));
  });

  it("geeft ook bij nul knopen een bruikbare maat", () => {
    expect(canvasBreedte([])).toBeGreaterThan(0);
    expect(canvasHoogte([])).toBeGreaterThan(0);
  });
});

describe("herstelLayout", () => {
  it("zet verplaatste knopen terug op hun automatische plek", () => {
    const start = bouwLeerpad(content).knopen;
    const verplaatst = verplaatsKnoop(start, "s0", 500, 500, { breedte: 9999, hoogte: 9999 });
    expect(verplaatst.find((k) => k.id === "s0")!.x).toBe(500);

    const hersteld = herstelLayout(content);
    // Terug op zijn eigen baan: s0 is de kop van de inhoudspagina en staat dus weer links,
    // één rij onder de inleiding.
    expect(hersteld.find((k) => k.id === "intro")!.x).toBe(KANT_MARGE);
    expect(hersteld.find((k) => k.id === "intro")!.y).toBe(KANT_MARGE);
    expect(hersteld.find((k) => k.id === "s0")!.x).toBe(KANT_MARGE);
    expect(hersteld.find((k) => k.id === "s0")!.y).toBeGreaterThan(KANT_MARGE);
  });
});

/* ------------------------------------------------- duur en status op de kaart */

describe("schatMinuten", () => {
  it("rekent met het leestempo", () => {
    // 200 woorden ≈ 1 minuut
    expect(schatMinuten(Array(200).fill("woord").join(" "))).toBe(1);
    expect(schatMinuten(Array(600).fill("woord").join(" "))).toBe(3);
  });

  it("telt extra seconden mee (antwoordtijd bij een vraag)", () => {
    const zonder = schatMinuten("korte vraag");
    const met = schatMinuten("korte vraag", SECONDEN_PER_VRAAG);
    expect(met).toBeGreaterThanOrEqual(zonder);
  });

  it("is nooit 0 — dat zou niets zeggen", () => {
    expect(schatMinuten("")).toBe(1);
    expect(schatMinuten("   ")).toBe(1);
    expect(schatMinuten("één woord")).toBe(1);
  });

  it("negeert dubbele witruimte bij het tellen", () => {
    expect(schatMinuten("a   b     c")).toBe(schatMinuten("a b c"));
  });
});

describe("totaleMinuten", () => {
  it("telt de knopen op", () => {
    const { knopen } = bouwLeerpad(content);
    expect(totaleMinuten(knopen)).toBe(knopen.reduce((s, k) => s + k.minuten, 0));
    expect(totaleMinuten(knopen)).toBeGreaterThan(0);
  });

  it("is 0 bij geen knopen", () => {
    expect(totaleMinuten([])).toBe(0);
  });
});

describe("vraagIsKlaar — het vinkje moet iets betekenen", () => {
  const goed: Vraag = {
    vraagvorm: "Meerkeuze",
    vorm: "keuze",
    vraag: "Wat doe je eerst?",
    opties: ["Harnas checken", "Meteen klimmen"],
    correct: 0,
    feedback: "Je controleert eerst je harnas.",
  };

  it("keurt een volledige vraag goed", () => {
    expect(vraagIsKlaar(goed)).toBe(true);
  });

  it("keurt een lege vraagtekst af", () => {
    expect(vraagIsKlaar({ ...goed, vraag: "  " })).toBe(false);
  });

  it("keurt minder dan twee gevulde opties af", () => {
    expect(vraagIsKlaar({ ...goed, opties: ["Alleen deze", ""] })).toBe(false);
  });

  it("keurt een correct-index buiten bereik af", () => {
    expect(vraagIsKlaar({ ...goed, correct: 5 })).toBe(false);
    expect(vraagIsKlaar({ ...goed, correct: -1 })).toBe(false);
  });

  it("keurt af als het aangewezen juiste antwoord leeg is", () => {
    expect(vraagIsKlaar({ ...goed, opties: ["", "Wel gevuld"], correct: 0 })).toBe(false);
  });

  it("keurt ontbrekende feedback af", () => {
    expect(vraagIsKlaar({ ...goed, feedback: "" })).toBe(false);
  });
});

describe("klaar-status op de knopen", () => {
  it("staat op true bij volledige content", () => {
    const { knopen } = bouwLeerpad(content);
    expect(knopen.every((k) => k.klaar)).toBe(true);
  });

  it("markeert een sectie zonder tekst als niet-af", () => {
    const kaal = maakContent(1, 0);
    kaal.secties[0]!.tekst = "";
    expect(bouwLeerpad(kaal).knopen.find((k) => k.id === "s0")?.klaar).toBe(false);
  });

  it("markeert een vraag met een kapotte correct-index als niet-af", () => {
    const kaal = maakContent(0, 1);
    kaal.vragen[0]!.correct = 9;
    expect(bouwLeerpad(kaal).knopen.find((k) => k.id === "v0")?.klaar).toBe(false);
  });

  it("markeert een lege samenvatting als niet-af", () => {
    const kaal = maakContent(1, 0);
    kaal.samenvatting = "   ";
    expect(bouwLeerpad(kaal).knopen.find((k) => k.bron === "samenvatting")?.klaar).toBe(false);
  });
});
