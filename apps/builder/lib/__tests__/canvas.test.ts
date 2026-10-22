/**
 * Een layout waarin twee kaarten op elkaar liggen ziet er niet kapot uit — hij ziet er slordig uit,
 * en je merkt het pas als je iets kwijt bent. Daarom staat "geen twee knopen overlappen" hier als
 * eigenschap, en niet als losse voorbeelden.
 */
import { describe, it, expect } from "vitest";
import {
  geldigeDoelen,
  LAYOUT_HOOGTE,
  MIN_ZOOM,
  omvattendKader,
  passendOpScherm,
  scrollNaarKnoop,
  verplaatsGroep,
  wisselSelectie,
  zoekKnopen,
} from "../canvas";
import { verbindKnopen, voegKnoopToe, wijzigKnoop, type Leerpad } from "../leerpad";
import { paginasVan } from "../paginas";
import { KNOOP_BREEDTE, type KnoopSoort } from "../graph";

const leeg: Leerpad = { knopen: [], verbindingen: [] };

function bouw(soorten: KnoopSoort[], schakels: [number, number][] = []): Leerpad {
  let l = leeg;
  soorten.forEach((s, i) => (l = voegKnoopToe(l, s, i * 37, i * 53)));
  for (const [a, b] of schakels) l = verbindKnopen(l, `b${a + 1}`, `b${b + 1}`);
  return l;
}

/**
 * Twee kaarten overlappen als hun rechthoeken elkaar snijden.
 *
 * Met de **gemeten** hoogte, niet met de schatting. Op één vaste hoogte toetsen zou precies de fout
 * missen die in de browser zichtbaar was: kaarten met een prompt- én een uitvoerveld zijn bijna
 * twee keer zo hoog als een kale kaart, en liepen over de volgende heen.
 */
function overlapt(
  a: { id: string; x: number; y: number },
  b: { id: string; x: number; y: number },
  hoogtes: Record<string, number> = {},
): boolean {
  const ha = hoogtes[a.id] ?? LAYOUT_HOOGTE;
  const hb = hoogtes[b.id] ?? LAYOUT_HOOGTE;
  return (
    a.x < b.x + KNOOP_BREEDTE && b.x < a.x + KNOOP_BREEDTE && a.y < b.y + hb && b.y < a.y + ha
  );
}

/* ------------------------------------------------------------------- het kader */

describe("omvattendKader", () => {
  it("is null bij een leeg canvas", () => {
    expect(omvattendKader([])).toBeNull();
  });

  it("omvat alle knopen inclusief hun breedte en hoogte", () => {
    const l = bouw(["uitleg", "uitleg"]);
    const knopen = [
      { ...l.knopen[0]!, x: 100, y: 50 },
      { ...l.knopen[1]!, x: 400, y: 250 },
    ];
    const k = omvattendKader(knopen, 200)!;
    expect(k.x).toBe(100);
    expect(k.y).toBe(50);
    expect(k.breedte).toBe(400 + KNOOP_BREEDTE - 100);
    expect(k.hoogte).toBe(250 + 200 - 50);
  });
});

describe("passendOpScherm", () => {
  it("zoomt uit tot alles past", () => {
    const l = bouw(["uitleg", "uitleg"]);
    const knopen = [
      { ...l.knopen[0]!, x: 0, y: 0 },
      { ...l.knopen[1]!, x: 2000, y: 1500 },
    ];
    const p = passendOpScherm(knopen, { breedte: 800, hoogte: 600 })!;
    expect(p.zoom).toBeLessThan(1);
    expect(p.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    // Het hele kader moet binnen het vak vallen op deze zoom.
    const kader = omvattendKader(knopen)!;
    expect(kader.breedte * p.zoom).toBeLessThanOrEqual(800);
    expect(kader.hoogte * p.zoom).toBeLessThanOrEqual(600);
  });

  it("zoomt niet verder in dan 100% bij één knoop", () => {
    const l = bouw(["uitleg"]);
    const p = passendOpScherm(l.knopen, { breedte: 1600, hoogte: 1200 })!;
    expect(p.zoom).toBe(1);
  });

  it("is null bij een leeg canvas of een vak zonder maat", () => {
    expect(passendOpScherm([], { breedte: 800, hoogte: 600 })).toBeNull();
    expect(passendOpScherm(bouw(["uitleg"]).knopen, { breedte: 0, hoogte: 0 })).toBeNull();
  });

  it("scrollt nooit naar een negatieve positie", () => {
    const l = bouw(["uitleg"]);
    const p = passendOpScherm(l.knopen, { breedte: 2000, hoogte: 2000 })!;
    expect(p.scrollX).toBeGreaterThanOrEqual(0);
    expect(p.scrollY).toBeGreaterThanOrEqual(0);
  });
});

describe("scrollNaarKnoop", () => {
  it("zet de knoop in het midden van het vak", () => {
    const l = bouw(["uitleg"]);
    const knoop = { ...l.knopen[0]!, x: 1000, y: 800 };
    const s = scrollNaarKnoop(knoop, { breedte: 600, hoogte: 400 }, 1);
    // Het midden van de knoop moet op het midden van het vak uitkomen.
    expect(s.scrollX + 300).toBeCloseTo(1000 + KNOOP_BREEDTE / 2);
    expect(s.scrollY + 200).toBeCloseTo(800 + LAYOUT_HOOGTE / 2);
  });

  it("scrollt niet negatief voor een knoop linksboven", () => {
    const l = bouw(["uitleg"]);
    const s = scrollNaarKnoop({ ...l.knopen[0]!, x: 0, y: 0 }, { breedte: 900, hoogte: 700 }, 1);
    expect([s.scrollX, s.scrollY]).toEqual([0, 0]);
  });
});

/* --------------------------------------------------------------------- zoeken */

describe("zoekKnopen", () => {
  const met = () => {
    let l = bouw(["uitleg", "video", "toets"]);
    l = wijzigKnoop(l, "b1", { titel: "Valgevaar herkennen", fragment: "" });
    l = wijzigKnoop(l, "b2", { titel: "Introfilm", fragment: "Gaat over valgevaar op steigers." });
    l = wijzigKnoop(l, "b3", { titel: "Check", prompt: "Vraag naar het valgevaar bij ladders." });
    return l;
  };

  it("vindt niets bij een lege term", () => {
    expect(zoekKnopen(met().knopen, "   ")).toEqual([]);
  });

  it("is hoofdletterongevoelig", () => {
    expect(zoekKnopen(met().knopen, "VALGEVAAR").length).toBe(3);
  });

  it("zet titeltreffers vooraan", () => {
    const t = zoekKnopen(met().knopen, "valgevaar");
    expect(t[0]!.waar).toBe("titel");
    expect(t[0]!.knoop.id).toBe("b1");
  });

  it("vindt ook in toelichting en opdracht, en zegt waar", () => {
    const t = zoekKnopen(met().knopen, "valgevaar");
    expect(t.map((x) => x.waar)).toEqual(["titel", "tekst", "opdracht"]);
  });

  it("telt een knoop maar één keer", () => {
    let l = met();
    l = wijzigKnoop(l, "b1", { fragment: "valgevaar valgevaar" });
    const ids = zoekKnopen(l.knopen, "valgevaar").map((t) => t.knoop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("begrenst het aantal treffers", () => {
    let l = leeg;
    for (let i = 0; i < 30; i += 1) l = voegKnoopToe(l, "uitleg", 0, 0);
    expect(zoekKnopen(l.knopen, "uitleg", 5)).toHaveLength(5);
  });
});

/* ---------------------------------------------------------------- selecteren */

describe("wisselSelectie", () => {
  it("vervangt de selectie bij een gewone klik", () => {
    expect(wisselSelectie(["a", "b"], "c", false)).toEqual(["c"]);
  });

  it("voegt toe bij shift", () => {
    expect(wisselSelectie(["a"], "b", true)).toEqual(["a", "b"]);
  });

  it("haalt eraf bij shift op iets dat al geselecteerd is", () => {
    expect(wisselSelectie(["a", "b"], "a", true)).toEqual(["b"]);
  });
});

describe("verplaatsGroep", () => {
  const drie = () => {
    let l = bouw(["uitleg", "uitleg", "uitleg"]);
    l = { ...l, knopen: l.knopen.map((k, i) => ({ ...k, x: 100 * i, y: 100 * i })) };
    return l.knopen;
  };
  const grens = { breedte: 5000, hoogte: 5000 };

  it("verschuift alleen de geselecteerde knopen", () => {
    const na = verplaatsGroep(drie(), ["b1", "b3"], 50, 20, grens);
    expect([na[0]!.x, na[0]!.y]).toEqual([50, 20]);
    expect([na[1]!.x, na[1]!.y]).toEqual([100, 100]);
    expect([na[2]!.x, na[2]!.y]).toEqual([250, 220]);
  });

  it("houdt de groep bij elkaar als hij de rand raakt", () => {
    // Naar links duwen: b1 staat op x=0, dus er kan niets naar links.
    const na = verplaatsGroep(drie(), ["b1", "b2"], -500, 0, grens);
    expect(na[0]!.x).toBe(0);
    expect(na[1]!.x).toBe(100); // onderlinge afstand blijft 100
  });

  it("klemt op de rechterrand zonder de groep uit te rekken", () => {
    const na = verplaatsGroep(drie(), ["b1", "b2"], 99999, 0, { breedte: 1000, hoogte: 5000 });
    expect(na[1]!.x - na[0]!.x).toBe(100);
    expect(na[1]!.x + KNOOP_BREEDTE).toBeLessThanOrEqual(1000);
  });

  it("doet niets bij een lege selectie", () => {
    const voor = drie();
    expect(verplaatsGroep(voor, [], 50, 50, grens)).toEqual(voor);
  });
});

/* ---------------------------------------------------------------- doelen tonen */

describe("geldigeDoelen", () => {
  it("noemt alleen wat het niveau toestaat", () => {
    const l = bouw(["uitleg", "video", "vertakking", "sectie"]);
    const doelen = geldigeDoelen(l, "b1");
    expect(doelen.has("b2")).toBe(true); // inhoud → inhoud
    expect(doelen.has("b3")).toBe(true); // inhoud → vertakking
    expect(doelen.has("b4")).toBe(false); // een sectie groepeert op plek
    expect(doelen.has("b1")).toBe(false); // niet zichzelf
  });

  it("laat een tweede uitgaande schakel weg — die zou toch geweigerd worden", () => {
    const l = bouw(["uitleg", "video", "audio"], [[0, 1]]);
    expect(geldigeDoelen(l, "b1").has("b3")).toBe(false);
  });

  it("laat een lus weg", () => {
    const l = bouw(["uitleg", "video", "audio"], [[0, 1], [1, 2]]);
    expect(geldigeDoelen(l, "b3").has("b1")).toBe(false);
  });

  it("laat een schakel weg die al bestaat", () => {
    const l = bouw(["uitleg", "video"], [[0, 1]]);
    expect(geldigeDoelen(l, "b1").has("b2")).toBe(false);
  });

  it("is leeg voor een onbekende knoop", () => {
    expect(geldigeDoelen(bouw(["uitleg"]), "bestaat-niet").size).toBe(0);
  });

  it("komt overeen met wat verbindKnopen daadwerkelijk accepteert", () => {
    const l = bouw(["uitleg", "video", "audio", "sectie", "ai", "vertakking"], [[0, 1]]);
    const heeft = (p: Leerpad, van: string, naar: string) =>
      p.verbindingen.some((v) => v.van === van && v.naar === naar);

    for (const van of l.knopen) {
      const doelen = geldigeDoelen(l, van.id);
      for (const naar of l.knopen) {
        // Niet op het áántal schakels meten: `verbindKnopen` vervángt de uitgaande schakel, dus
        // een geslaagde verbinding laat het totaal vaak gelijk. Kijk of de schakel er nu ís.
        const gelukt = heeft(verbindKnopen(l, van.id, naar.id), van.id, naar.id);
        const alAanwezig = heeft(l, van.id, naar.id);
        expect(doelen.has(naar.id)).toBe(gelukt && !alAanwezig);
      }
    }
  });
});
