/**
 * De rijlayout is de enige plek die `x` en `y` schrijft, en hij is de reden dat het canvas leesbaar
 * is: links naar rechts is de volgorde binnen een pagina, boven naar onder de volgorde van de
 * cursus. Twee dingen gaan hier stil fout — kaarten die elkaar overlappen zien er slordig uit maar
 * niet kapot, en een leesrichting die niet met het rechterpaneel overeenkomt merk je pas als je
 * exporteert.
 */
import { describe, expect, it } from "vitest";
import {
  metLayout,
  MIN_ZOOM,
  omvattendKader,
  onderRijen,
  passendOpScherm,
  overlapt,
  rijenVan,
  rijLayout,
  schuifInRij,
  snapPositie,
  vrijePositie,
} from "../canvas";
import {
  controleerLeerpad,
  leerpadUitContent,
  synchroniseerMetContent,
  verbindKnopen,
  voegKnoopToe,
} from "../leerpad";
import { legeContent } from "../content";
import { paginasVan } from "../paginas";
import {
  KANT_MARGE,
  KNOOP_BREEDTE,
  KOLOM_AFSTAND,
  RIJ_HOOGTE,
  type Knoop,
  type KnoopSoort,
  type Leerpad,
} from "../graph";

/** Een kale knoop op een plek — genoeg voor de plaatsingsfuncties, die alleen x/y/id lezen. */
function blokje(id: string, x = 0, y = 0): Knoop {
  return {
    id,
    seed: `seed-${id}`,
    soort: "uitleg",
    titel: id,
    fragment: "",
    index: null,
    eigen: true,
    minuten: 2,
    klaar: true,
    x,
    y,
  };
}

const leeg: Leerpad = { knopen: [], verbindingen: [] };

/** Bouwt een graaf op; de posities zijn met opzet rommelig, want de layout hoort ze te bepalen. */
function bouw(soorten: KnoopSoort[], schakels: [number, number][] = []): Leerpad {
  let l = leeg;
  soorten.forEach((s, i) => (l = voegKnoopToe(l, s, i * 17, i * 91)));
  for (const [a, b] of schakels) l = verbindKnopen(l, `b${a + 1}`, `b${b + 1}`);
  return l;
}

/** Overlappen twee kaarten? Met de gemeten hoogte, want dáár ging het eerder mis. */
function kaartenOverlappen(
  a: { id: string; x: number; y: number },
  b: { id: string; x: number; y: number },
  hoogtes: Record<string, number>,
  standaard = 210,
): boolean {
  const h = (id: string) => hoogtes[id] ?? standaard;
  return (
    a.x < b.x + KNOOP_BREEDTE &&
    b.x < a.x + KNOOP_BREEDTE &&
    a.y < b.y + h(b.id) &&
    b.y < a.y + h(a.id)
  );
}

function geenOverlap(knopen: { id: string; x: number; y: number }[], hoogtes: Record<string, number> = {}) {
  for (let i = 0; i < knopen.length; i += 1) {
    for (let j = i + 1; j < knopen.length; j += 1) {
      expect(
        kaartenOverlappen(knopen[i]!, knopen[j]!, hoogtes),
        `${knopen[i]!.id} overlapt ${knopen[j]!.id}`,
      ).toBe(false);
    }
  }
}

/* ------------------------------------------------------------------- de rijen */

describe("rijenVan", () => {
  it("maakt van elke pagina één rij", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1]]);
    const rijen = rijenVan(l);
    expect(rijen.map((r) => r.ids)).toEqual([["b1", "b2"], ["b3"]]);
  });

  it("stapelt de rijen zonder gat of overlap", () => {
    const rijen = rijenVan(bouw(["uitleg", "video", "audio"]));
    expect(rijen[0]!.y).toBe(KANT_MARGE);
    for (let i = 1; i < rijen.length; i += 1) {
      expect(rijen[i]!.y).toBe(rijen[i - 1]!.y + rijen[i - 1]!.hoogte);
    }
  });

  it("houdt de vaste rijhoogte aan zolang de kaarten passen", () => {
    expect(rijenVan(bouw(["uitleg"]))[0]!.hoogte).toBe(RIJ_HOOGTE);
  });

  it("laat een rij meegroeien met zijn hoogste kaart", () => {
    // Een tekstblok met prompt- én uitvoerveld meet in de browser ruim 320px; een vaste steek zou
    // hem over de rij eronder laten lopen.
    const rijen = rijenVan(bouw(["uitleg", "video"]), { b1: 520 });
    expect(rijen[0]!.hoogte).toBeGreaterThan(520);
    expect(rijen[1]!.hoogte).toBe(RIJ_HOOGTE);
  });

  it("zet een sectie op een eigen rij boven de pagina's die eronder vallen", () => {
    // Posities hier expliciet: een sectie claimt wat ónder hem ligt, dus de proef staat of valt
    // met waar hij staat ten opzichte van de koppen.
    let l = bouw(["uitleg", "video"]);
    l = voegKnoopToe(l, "sectie", 0, 0);
    l = { ...l, knopen: l.knopen.map((k) => ({ ...k, y: k.id === "b3" ? 100 : 300 })) };
    const rijen = rijenVan(l);
    expect(rijen[0]!.ids).toEqual(["b3"]);
    expect(rijen[0]!.paginaKop).toBeNull();
    expect(rijen.slice(1).map((r) => r.ids)).toEqual([["b1"], ["b2"]]);
  });

  it("plakt een vertakking achter de rij die hem voedt, zodat de schakel kort blijft", () => {
    const l = bouw(["uitleg", "toets", "vertakking"], [[0, 1], [1, 2]]);
    expect(rijenVan(l)[0]!.ids).toEqual(["b1", "b2", "b3"]);
  });

  it("zet een AI-knoop op een rij onderaan — gereedschap staat niet in de leesrichting", () => {
    const l = bouw(["uitleg", "ai"], [[1, 0]]);
    const rijen = rijenVan(l);
    expect(rijen[rijen.length - 1]!.ids).toEqual(["b2"]);
  });
});

/* ------------------------------------------------------------------ de layout */

describe("rijLayout", () => {
  it("zet de onderdelen van een pagina op één baan, links naar rechts in linkvolgorde", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1], [1, 2]]);
    const na = rijLayout(l);
    const [a, b, c] = ["b1", "b2", "b3"].map((id) => na.find((k) => k.id === id)!);
    expect(a!.y).toBe(b!.y);
    expect(b!.y).toBe(c!.y);
    expect(a!.x).toBeLessThan(b!.x);
    expect(b!.x).toBeLessThan(c!.x);
  });

  it("lijnt elke rij links uit op dezelfde marge", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1]]);
    const na = rijLayout(l);
    expect(na.find((k) => k.id === "b1")!.x).toBe(KANT_MARGE);
    expect(na.find((k) => k.id === "b3")!.x).toBe(KANT_MARGE);
  });

  it("laat nooit twee blokken overlappen — ook niet bij wisselende hoogtes", () => {
    let l = bouw(["uitleg", "toets", "video", "audio", "reflectie"], [[0, 1], [2, 3]]);
    l = voegKnoopToe(l, "sectie", 0, 10);
    const hoogtes = { b1: 520, b2: 130, b3: 410, b4: 300, b5: 170, b6: 90 };
    geenOverlap(rijLayout(l, hoogtes), hoogtes);
  });

  it("verandert de graaf niet, alleen de plekken", () => {
    const l = bouw(["uitleg", "toets"], [[0, 1]]);
    const na = rijLayout(l);
    expect(na.map((k) => k.id)).toEqual(l.knopen.map((k) => k.id));
    expect(na.map((k) => k.soort)).toEqual(l.knopen.map((k) => k.soort));
  });

  it("is idempotent: nog een keer draaien verandert niets", () => {
    const l = bouw(["uitleg", "toets", "video"], [[0, 1]]);
    const een = metLayout(l);
    expect(metLayout(een).knopen).toEqual(een.knopen);
  });

  it("houdt de leesrichting gelijk aan de volgorde in het rechterpaneel", () => {
    // Dit is de belofte van de hele weergave: wat je op het canvas van boven naar onder en van
    // links naar rechts leest, is wat er in het paneel staat.
    const l = bouw(["uitleg", "toets", "video", "audio"], [[0, 1], [2, 3]]);
    const na = metLayout(l);
    const uitPaneel = paginasVan(na).flatMap((p) => p.onderdelen.map((k) => k.id));
    const vanCanvas = [...na.knopen].sort((a, b) => a.y - b.y || a.x - b.x).map((k) => k.id);
    expect(vanCanvas).toEqual(uitPaneel);
  });
});

describe("onderRijen", () => {
  it("wijst de plek onder de laagste rij aan", () => {
    const l = bouw(["uitleg", "video"]);
    const rijen = rijenVan(l);
    const laatste = rijen[rijen.length - 1]!;
    expect(onderRijen(l)).toBe(laatste.y + laatste.hoogte);
  });

  it("begint bij de marge op een leeg canvas", () => {
    expect(onderRijen(leeg)).toBe(KANT_MARGE);
  });
});

/* ------------------------------------------------------------- de lege module */

describe("een lege module", () => {
  it("opent met precies één blok linksboven en niets anders", () => {
    // De belofte van eis 2: geen voorgeschakelde tweede knoop en geen alvast gelegde schakel.
    const l = leerpadUitContent(legeContent("Naamloze module"));
    expect(l.knopen).toHaveLength(1);
    expect(l.knopen[0]!.soort).toBe("uitleg");
    expect(l.verbindingen).toEqual([]);
    expect([l.knopen[0]!.x, l.knopen[0]!.y]).toEqual([KANT_MARGE, KANT_MARGE]);
  });

  it("toont één pagina met één onderdeel en nul meldingen", () => {
    const l = leerpadUitContent(legeContent());
    const paginas = paginasVan(l);
    expect(paginas).toHaveLength(1);
    expect(paginas[0]!.onderdelen).toHaveLength(1);
    expect(controleerLeerpad(l)).toEqual([]);
  });

  it("krijgt er geen intro of samenvatting bij zodra de content synchroniseert", () => {
    // Hier ging het mis: `bouwLeerpad` maakte die twee ook voor lege content, en dan schoof
    // `synchroniseerMetContent` ze er meteen weer in — drie blokken op een verse module.
    const content = legeContent();
    const l = synchroniseerMetContent(leerpadUitContent(content), content);
    expect(l.knopen).toHaveLength(1);
  });
});

/* -------------------------------------------------- de drie-blokken-proef */

describe("drie blokken, twee gelinkt", () => {
  const opzet = () => {
    let l = leerpadUitContent(legeContent());
    l = voegKnoopToe(l, "video", 0, 400);
    l = voegKnoopToe(l, "audio", 0, 800);
    return metLayout(verbindKnopen(l, "b1", "b2"));
  };

  it("levert drie rijen op — twee onderdelen op de eerste", () => {
    const rijen = rijenVan(opzet());
    expect(rijen.map((r) => r.ids)).toEqual([["b1", "b2"], ["b3"]]);
  });

  it("is als tabel te lezen: gelijke y per rij, gelijke x per kolom", () => {
    const na = opzet().knopen;
    const [b1, b2, b3] = ["b1", "b2", "b3"].map((id) => na.find((k) => k.id === id)!);
    expect(b1!.y).toBe(b2!.y);
    expect(b1!.x).toBe(b3!.x);
    expect(b3!.y).toBeGreaterThan(b1!.y);
  });

  it("laat niets overlappen", () => {
    geenOverlap(opzet().knopen);
  });
});

/* ---------------------------------------------------------------- snappen */

describe("snapPositie", () => {
  const drie = () =>
    [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 440, y: 100 },
      { id: "c", x: 100, y: 500 },
    ].map((p) => ({ ...blokje(p.id), ...p }));

  it("klikt vast op de x van een blok in een andere rij", () => {
    const uit = snapPositie(drie(), "z", 446, 900);
    expect(uit.x).toBe(440);
    expect(uit.hulplijnX).toBe(440);
  });

  it("klikt vast op de y-baan van zijn eigen rij", () => {
    const uit = snapPositie(drie(), "z", 900, 106);
    expect(uit.y).toBe(100);
    expect(uit.hulplijnY).toBe(100);
  });

  it("laat los zodra je ver genoeg weg bent", () => {
    const uit = snapPositie(drie(), "z", 500, 900);
    expect(uit.x).toBe(500);
    expect(uit.hulplijnX).toBeNull();
  });

  it("neemt de linkermarge mee als baan, zodat kolom 1 vanzelf uitlijnt", () => {
    const uit = snapPositie(drie(), "z", KANT_MARGE + 5, 900);
    expect(uit.x).toBe(KANT_MARGE);
  });

  it("kiest de dichtstbijzijnde baan als er twee in bereik liggen", () => {
    const knopen = [blokje("a", 100, 0), blokje("b", 120, 0)];
    expect(snapPositie(knopen, "z", 118, 900).x).toBe(120);
  });

  it("snapt nooit aan zichzelf", () => {
    const knopen = [blokje("a", 100, 100)];
    const uit = snapPositie(knopen, "a", 105, 105);
    expect([uit.hulplijnX, uit.hulplijnY]).toEqual([null, null]);
  });
});

/* -------------------------------------------------------------- overlappen */

describe("vrijePositie", () => {
  const bezet = () => [blokje("a", 100, 100), blokje("b", 440, 100)];

  it("laat een vrije plek met rust", () => {
    expect(vrijePositie(bezet(), "z", 900, 900)).toEqual({ x: 900, y: 900 });
  });

  it("schuift naar rechts als de plek bezet is", () => {
    const uit = vrijePositie(bezet(), "z", 110, 100);
    expect(uit.y).toBe(100);
    expect(uit.x).toBeGreaterThanOrEqual(100 + KNOOP_BREEDTE);
  });

  it("schuift door tot voorbij een hele rij bezette blokken", () => {
    const uit = vrijePositie(bezet(), "z", 100, 100, {});
    const nieuw = { x: uit.x, y: uit.y, hoogte: 210 };
    for (const k of bezet()) {
      expect(overlapt(nieuw, { x: k.x, y: k.y, hoogte: 210 })).toBe(false);
    }
  });

  it("botst niet met zichzelf", () => {
    const knopen = [blokje("a", 100, 100)];
    expect(vrijePositie(knopen, "a", 100, 100)).toEqual({ x: 100, y: 100 });
  });

  it("houdt rekening met de gemeten hoogte van het gesleepte blok", () => {
    // Een hoge kaart botst met een rij eronder waar een lage kaart nog langs zou passen.
    const knopen = [blokje("a", 100, 400)];
    const laag = vrijePositie(knopen, "z", 100, 100, { z: 100, a: 210 });
    const hoog = vrijePositie(knopen, "z", 100, 100, { z: 500, a: 210 });
    expect(laag.x).toBe(100);
    expect(hoog.x).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------ in een rij */

describe("schuifInRij", () => {
  it("zet een aangehaakt blok op de eerstvolgende kolompositie", () => {
    let l = bouw(["uitleg", "video"]);
    l = { ...l, knopen: l.knopen.map((k) => (k.id === "b1" ? { ...k, x: 500, y: 300 } : k)) };
    l = verbindKnopen(l, "b1", "b2");
    const na = schuifInRij(l, "b2");
    const b2 = na.knopen.find((k) => k.id === "b2")!;
    expect(b2.y).toBe(300);
    expect(b2.x).toBe(500 + KOLOM_AFSTAND);
  });

  it("laat de kop van een rij met rust", () => {
    const l = bouw(["uitleg", "video"], [[0, 1]]);
    expect(schuifInRij(l, "b1")).toBe(l);
  });

  it("doet niets bij een blok dat nergens in loopt", () => {
    const l = bouw(["uitleg"]);
    expect(schuifInRij(l, "bestaat-niet")).toBe(l);
  });
});

/* ------------------------------------------------------------- zoom-to-fit */

describe("passendOpScherm", () => {
  /** Twintig pagina's, netjes opgeruimd — de maat waarop dit moet blijven werken. */
  const twintig = () => {
    let l = leeg;
    for (let i = 0; i < 20; i += 1) l = voegKnoopToe(l, "uitleg", 0, i * RIJ_HOOGTE);
    return metLayout(l);
  };

  it("brengt een module van twintig pagina's in één keer in beeld", () => {
    const p = passendOpScherm(twintig().knopen, { breedte: 900, hoogte: 700 });
    expect(p).not.toBeNull();
    expect(p!.zoom).toBeGreaterThan(MIN_ZOOM);
    // En hij past er ook echt in, niet alleen "hij heeft een zoom gekozen".
    const kader = omvattendKader(twintig().knopen)!;
    expect(kader.hoogte * p!.zoom).toBeLessThanOrEqual(700);
  });

  it("zoomt nooit verder in dan 100% — één kaart mag het scherm niet vullen", () => {
    const een = metLayout(voegKnoopToe(leeg, "uitleg", 0, 0));
    expect(passendOpScherm(een.knopen, { breedte: 1600, hoogte: 1200 })!.zoom).toBe(1);
  });
});
