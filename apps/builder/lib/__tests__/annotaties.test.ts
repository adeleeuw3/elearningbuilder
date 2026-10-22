/**
 * De zoomcorrectie is hier het gevaar: vergeet je te delen door de zoomfactor, dan tekent de
 * stift naast de cursor en verschuift alles zodra je zoomt — zonder dat er iets faalt. Daarom
 * staat die omrekening als pure functie apart, met tests op precies dat gedrag.
 */
import { describe, it, expect } from "vitest";
import {
  isBruikbaar,
  MIN_PUNT_AFSTAND,
  naarCanvas,
  raaktStreek,
  startStreek,
  streekPad,
  verwijderStreek,
  verwijderVerbinding,
  voegVerbindingToe,
  volgendAnnotatieId,
  vulAan,
  type EigenVerbinding,
} from "../annotaties";

const rect = { left: 100, top: 50 };

/* -------------------------------------------------------------- naarCanvas */

describe("naarCanvas", () => {
  it("trekt de canvaspositie eraf op 100%", () => {
    expect(naarCanvas({ x: 150, y: 90 }, rect, 1)).toEqual({ x: 50, y: 40 });
  });

  it("deelt door de zoomfactor bij inzoomen", () => {
    // Op 200% ligt een punt 100px van de rand op 50 canvas-eenheden.
    expect(naarCanvas({ x: 200, y: 50 }, rect, 2)).toEqual({ x: 50, y: 0 });
  });

  it("deelt ook bij uitzoomen", () => {
    expect(naarCanvas({ x: 150, y: 50 }, rect, 0.5)).toEqual({ x: 100, y: 0 });
  });

  it("is het omgekeerde van schalen — heen en terug levert hetzelfde punt", () => {
    for (const zoom of [0.5, 0.75, 1, 1.25, 2]) {
      const canvasPunt = { x: 137, y: 42 };
      const client = { x: canvasPunt.x * zoom + rect.left, y: canvasPunt.y * zoom + rect.top };
      const terug = naarCanvas(client, rect, zoom);
      expect(terug.x).toBeCloseTo(canvasPunt.x);
      expect(terug.y).toBeCloseTo(canvasPunt.y);
    }
  });

  it("valt terug op 1 bij een onzinnige zoomfactor in plaats van te delen door nul", () => {
    expect(naarCanvas({ x: 150, y: 90 }, rect, 0)).toEqual({ x: 50, y: 40 });
  });
});

/* ----------------------------------------------------------------- streken */

describe("startStreek / vulAan", () => {
  it("begint met één punt", () => {
    expect(startStreek("a", { x: 1, y: 2 }).punten).toEqual([{ x: 1, y: 2 }]);
  });

  it("voegt een punt toe dat ver genoeg ligt", () => {
    const s = vulAan(startStreek("a", { x: 0, y: 0 }), { x: 10, y: 0 });
    expect(s.punten).toHaveLength(2);
  });

  it("slaat punten over die te dicht op het vorige liggen", () => {
    const s = vulAan(startStreek("a", { x: 0, y: 0 }), { x: MIN_PUNT_AFSTAND / 2, y: 0 });
    expect(s.punten).toHaveLength(1);
  });

  it("laat een haal niet ongelimiteerd groeien bij minieme bewegingen", () => {
    let s = startStreek("a", { x: 0, y: 0 });
    for (let i = 0; i < 200; i += 1) s = vulAan(s, { x: 0.1 * i, y: 0 });
    expect(s.punten.length).toBeLessThan(30);
  });

  it("muteert de streek niet", () => {
    const s = startStreek("a", { x: 0, y: 0 });
    vulAan(s, { x: 50, y: 50 });
    expect(s.punten).toHaveLength(1);
  });
});

describe("isBruikbaar", () => {
  it("verwerpt een streek van één punt — dat is een klik, geen lijn", () => {
    expect(isBruikbaar(startStreek("a", { x: 0, y: 0 }))).toBe(false);
  });

  it("accepteert twee punten of meer", () => {
    expect(isBruikbaar(vulAan(startStreek("a", { x: 0, y: 0 }), { x: 20, y: 0 }))).toBe(true);
  });
});

describe("streekPad", () => {
  it("begint met M en gebruikt L voor de rest", () => {
    const s = vulAan(vulAan(startStreek("a", { x: 0, y: 0 }), { x: 10, y: 5 }), { x: 20, y: 10 });
    const pad = streekPad(s);
    expect(pad.startsWith("M0.0 0.0")).toBe(true);
    expect((pad.match(/L/g) ?? []).length).toBe(2);
  });

  it("levert een lege string bij geen punten", () => {
    expect(streekPad({ id: "a", punten: [] })).toBe("");
  });
});

describe("raaktStreek", () => {
  const s = vulAan(startStreek("a", { x: 0, y: 0 }), { x: 50, y: 0 });

  it("raakt binnen de marge", () => {
    expect(raaktStreek(s, { x: 2, y: 2 })).toBe(true);
  });

  it("raakt niet ver ernaast", () => {
    expect(raaktStreek(s, { x: 500, y: 500 })).toBe(false);
  });
});

/* ------------------------------------------------------------ verbindingen */

describe("voegVerbindingToe", () => {
  const leeg: EigenVerbinding[] = [];

  it("voegt een verbinding toe", () => {
    expect(voegVerbindingToe(leeg, "1", "a", "b")).toEqual([{ id: "1", van: "a", naar: "b" }]);
  });

  it("weigert een knoop aan zichzelf", () => {
    expect(voegVerbindingToe(leeg, "1", "a", "a")).toEqual([]);
  });

  it("weigert een duplicaat in dezelfde richting", () => {
    const een = voegVerbindingToe(leeg, "1", "a", "b");
    expect(voegVerbindingToe(een, "2", "a", "b")).toHaveLength(1);
  });

  it("staat de omgekeerde richting wél toe", () => {
    const een = voegVerbindingToe(leeg, "1", "a", "b");
    expect(voegVerbindingToe(een, "2", "b", "a")).toHaveLength(2);
  });

  it("muteert de bestaande lijst niet", () => {
    const een = voegVerbindingToe(leeg, "1", "a", "b");
    voegVerbindingToe(een, "2", "b", "c");
    expect(een).toHaveLength(1);
  });
});

describe("verwijderen", () => {
  it("verwijdert de verbinding met dat id", () => {
    const twee = voegVerbindingToe(voegVerbindingToe([], "1", "a", "b"), "2", "b", "c");
    expect(verwijderVerbinding(twee, "1").map((v) => v.id)).toEqual(["2"]);
  });

  it("laat een onbekend id de lijst ongemoeid", () => {
    const een = voegVerbindingToe([], "1", "a", "b");
    expect(verwijderVerbinding(een, "9")).toHaveLength(1);
  });

  it("verwijdert de streek met dat id", () => {
    const streken = [startStreek("a", { x: 0, y: 0 }), startStreek("b", { x: 1, y: 1 })];
    expect(verwijderStreek(streken, "a").map((s) => s.id)).toEqual(["b"]);
  });
});

/* ---------------------------------------------------------------------- ids */

describe("volgendAnnotatieId", () => {
  it("begint bij a1", () => {
    expect(volgendAnnotatieId([], [])).toBe("a1");
  });

  it("telt door over streken en verbindingen samen", () => {
    const streken = [startStreek("a1", { x: 0, y: 0 })];
    const verbindingen = voegVerbindingToe([], "a4", "x", "y");
    expect(volgendAnnotatieId(streken, verbindingen)).toBe("a5");
  });

  it("hergebruikt geen id nadat er iets tussenuit gewist is", () => {
    // Wis a1 uit [a1, a2] en het volgende id moet a3 zijn, niet a2.
    const streken = [startStreek("a1", { x: 0, y: 0 }), startStreek("a2", { x: 1, y: 1 })];
    expect(volgendAnnotatieId(verwijderStreek(streken, "a1"), [])).toBe("a3");
  });

  it("negeert een id dat niet op een nummer eindigt", () => {
    expect(volgendAnnotatieId([startStreek("oud", { x: 0, y: 0 })], [])).toBe("a1");
  });
});
