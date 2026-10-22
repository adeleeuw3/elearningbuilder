/**
 * De pagina-afleiding is het hart van het nieuwe model: alles wat de auteur in het rechterpaneel
 * ziet komt hier vandaan. Een fout hier is stil — een pagina die één blok mist ziet er niet kapot
 * uit, hij ziet er korter uit.
 *
 * De knopen worden hier met de hand gebouwd en niet via `nieuweKnoop`, zodat deze tests de
 * afleiding toetsen en niet de fabriek ernaast.
 */
import { describe, expect, it } from "vitest";
import { paginamodel, paginasPerSectie, paginasVan, plekVanBlok } from "../paginas";
import type { Knoop, KnoopSoort, Leerpad, Verbinding } from "../graph";

let teller = 0;
function blok(id: string, y: number, extra: Partial<Knoop> = {}): Knoop {
  teller += 1;
  return {
    id,
    seed: `seed-${id}`,
    soort: "uitleg" as KnoopSoort,
    titel: `Blok ${id}`,
    fragment: "",
    index: null,
    eigen: true,
    minuten: 2,
    klaar: true,
    x: 0,
    y,
    ...extra,
  };
}

function pad(knopen: Knoop[], schakels: [string, string][] = []): Leerpad {
  const verbindingen: Verbinding[] = schakels.map(([van, naar], i) => ({
    id: `k${i}`,
    van,
    naar,
  }));
  return { knopen, verbindingen };
}

const titels = (leerpad: Leerpad) =>
  paginasVan(leerpad).map((p) => p.onderdelen.map((k) => k.id));

/* ------------------------------------------------------------------ de basis */

describe("paginamodel", () => {
  it("maakt van één los blok een pagina met één onderdeel", () => {
    const { paginas, cyclisch } = paginamodel(pad([blok("a", 0)]));
    expect(paginas).toHaveLength(1);
    expect(paginas[0]!.onderdelen.map((k) => k.id)).toEqual(["a"]);
    expect(cyclisch).toEqual([]);
  });

  it("levert een leeg model bij een lege graaf, niet een lege pagina", () => {
    expect(paginamodel(pad([])).paginas).toEqual([]);
  });

  it("zet een keten van drie op linkvolgorde, kop eerst", () => {
    const leerpad = pad(
      [blok("a", 0), blok("b", 0), blok("c", 0)],
      [
        ["a", "b"],
        ["b", "c"],
      ],
    );
    expect(titels(leerpad)).toEqual([["a", "b", "c"]]);
  });

  it("leest de keten van kop naar staart, ook als de schakels in omgekeerde volgorde staan", () => {
    const leerpad = pad(
      [blok("a", 0), blok("b", 0), blok("c", 0)],
      [
        ["b", "c"],
        ["a", "b"],
      ],
    );
    expect(titels(leerpad)).toEqual([["a", "b", "c"]]);
  });

  it("laat een blok bij dezelfde pagina horen zodra het aan een ander gekoppeld wordt", () => {
    const los = pad([blok("a", 0), blok("b", 0)]);
    expect(titels(los)).toEqual([["a"], ["b"]]);

    const gekoppeld = pad([blok("a", 0), blok("b", 0)], [["a", "b"]]);
    expect(titels(gekoppeld)).toEqual([["a", "b"]]);
  });
});

/* --------------------------------------------------------------- de volgorde */

describe("paginavolgorde", () => {
  it("volgt de verticale positie van het eerste blok, niet de knoopvolgorde", () => {
    // De onderste keten in het document staat hóger op het canvas en komt dus eerst.
    const leerpad = pad(
      [blok("a", 400), blok("a2", 400), blok("b", 100), blok("b2", 100)],
      [
        ["a", "a2"],
        ["b", "b2"],
      ],
    );
    expect(titels(leerpad)).toEqual([
      ["b", "b2"],
      ["a", "a2"],
    ]);
  });

  it("kijkt alleen naar de kop; een staart die lager hangt verplaatst de pagina niet", () => {
    const leerpad = pad(
      [blok("a", 0), blok("a2", 900), blok("b", 100)],
      [["a", "a2"]],
    );
    expect(titels(leerpad)).toEqual([["a", "a2"], ["b"]]);
  });

  it("valt bij gelijke hoogte terug op x en daarna op de documentvolgorde", () => {
    const leerpad = pad([blok("a", 50, { x: 300 }), blok("b", 50, { x: 10 })]);
    expect(titels(leerpad)).toEqual([["b"], ["a"]]);

    const gelijk = pad([blok("a", 50, { x: 0 }), blok("b", 50, { x: 0 })]);
    expect(titels(gelijk)).toEqual([["a"], ["b"]]);
  });

  it("gebruikt de momentopname zolang die er is, zodat het paneel niet meespringt met de muis", () => {
    // Blok a is al naar boven gesleept, maar de drop is nog niet geweest.
    const leerpad = pad([blok("a", 10), blok("b", 100)]);
    expect(paginasVan(leerpad, { a: 900, b: 100 }).map((p) => p.kop.id)).toEqual(["b", "a"]);
  });

  it("laat een kop die nog niet in de momentopname staat op zijn echte plek vallen", () => {
    const leerpad = pad([blok("a", 500), blok("nieuw", 50)]);
    expect(paginasVan(leerpad, { a: 500 }).map((p) => p.kop.id)).toEqual(["nieuw", "a"]);
  });
});

/* ------------------------------------------------ wat géén keten mag vormen */

describe("alleen inhoud vormt een keten", () => {
  it("laat een vertakking aan het eind de pagina niet uitbreiden en de volgende niet opslokken", () => {
    const leerpad = pad(
      [
        blok("a", 0),
        blok("b", 0),
        blok("split", 0, { soort: "vertakking", titel: "Gehaald?" }),
        blok("c", 200),
        blok("d", 400),
      ],
      [
        ["a", "b"],
        ["b", "split"],
        ["split", "c"],
        ["split", "d"],
      ],
    );
    // Drie pagina's: de keten a→b, en de twee takken elk als eigen pagina.
    expect(titels(leerpad)).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("houdt een AI-knoop buiten de pagina — dat is gereedschap, geen scherm", () => {
    const leerpad = pad(
      [blok("ai", 0, { soort: "ai", titel: "Schrijf dit" }), blok("a", 0), blok("b", 0)],
      [
        ["ai", "a"],
        ["a", "b"],
      ],
    );
    expect(titels(leerpad)).toEqual([["a", "b"]]);
  });

  it("negeert een schakel naar een knoop die niet meer bestaat", () => {
    const leerpad = pad([blok("a", 0)], [["a", "weg"]]);
    expect(titels(leerpad)).toEqual([["a"]]);
  });

  it("houdt de eerste schakel aan als de data er twee uitgaande bevat", () => {
    // De UI blokkeert dit; gemigreerde of met de hand bewerkte data kan het wél bevatten.
    const leerpad = pad(
      [blok("a", 0), blok("b", 100), blok("c", 200)],
      [
        ["a", "b"],
        ["a", "c"],
      ],
    );
    expect(titels(leerpad)).toEqual([["a", "b"], ["c"]]);
  });
});

/* -------------------------------------------------------------------- cyclus */

describe("een cyclus", () => {
  const ring = () =>
    pad(
      [blok("a", 0), blok("b", 0), blok("c", 0)],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
    );

  it("loopt niet vast en laat de blokken niet verdwijnen", () => {
    const { paginas } = paginamodel(ring());
    expect(paginas).toHaveLength(1);
    expect(paginas[0]!.onderdelen.map((k) => k.id)).toEqual(["a", "b", "c"]);
  });

  it("wordt als foutgeval gemeld", () => {
    expect(paginamodel(ring()).cyclisch.map((k) => k.id)).toEqual(["a", "b", "c"]);
  });

  it("laat een gezonde keten ernaast met rust", () => {
    const leerpad = pad(
      [blok("a", 0), blok("b", 0), blok("x", 300), blok("y", 300)],
      [
        ["a", "b"],
        ["b", "a"],
        ["x", "y"],
      ],
    );
    const { paginas, cyclisch } = paginamodel(leerpad);
    expect(paginas.map((p) => p.onderdelen.map((k) => k.id))).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
    expect(cyclisch.map((k) => k.id)).toEqual(["a", "b"]);
  });
});

/* ------------------------------------------------------- identiteit en titel */

describe("identiteit en titel", () => {
  it("neemt standaard de titel van het eerste blok", () => {
    const p = paginasVan(pad([blok("a", 0, { titel: "Valgevaar" })]))[0]!;
    expect(p.titel).toBe("Valgevaar");
    expect(p.eigenTitel).toBe(false);
  });

  it("laat een overschreven titel voorgaan", () => {
    const p = paginasVan(
      pad([blok("a", 0, { titel: "Valgevaar", paginaTitel: "Introductie" })]),
    )[0]!;
    expect(p.titel).toBe("Introductie");
    expect(p.eigenTitel).toBe(true);
  });

  it("negeert een overschreven titel die alleen uit spaties bestaat", () => {
    const p = paginasVan(pad([blok("a", 0, { titel: "Valgevaar", paginaTitel: "   " })]))[0]!;
    expect(p.titel).toBe("Valgevaar");
    expect(p.eigenTitel).toBe(false);
  });

  it("leest titel en identiteit van de kop, niet van een blok verderop", () => {
    const leerpad = pad(
      [
        blok("a", 0, { titel: "Eerste", seed: "seed-kop" }),
        blok("b", 0, { titel: "Tweede", paginaTitel: "Slaapt" }),
      ],
      [["a", "b"]],
    );
    const p = paginasVan(leerpad)[0]!;
    expect(p.titel).toBe("Eerste");
    expect(p.seed).toBe("seed-kop");
  });

  it("gebruikt de eigen seed van de kop zolang er geen paginaSeed is", () => {
    expect(paginasVan(pad([blok("a", 0)]))[0]!.seed).toBe("seed-a");
  });

  it("gebruikt de paginaSeed zodra de kop er een draagt", () => {
    const p = paginasVan(pad([blok("a", 0, { paginaSeed: "van-de-oude-pagina" })]))[0]!;
    expect(p.seed).toBe("van-de-oude-pagina");
  });
});

/* ------------------------------------------------------------------ plekVan */

describe("plekVanBlok", () => {
  const leerpad = pad(
    [blok("a", 0), blok("b", 0), blok("c", 0)],
    [
      ["a", "b"],
      ["b", "c"],
    ],
  );

  it("wijst het blok zijn plek in de stapel", () => {
    const plek = plekVanBlok(paginasVan(leerpad), "b");
    expect(plek?.positie).toBe(2);
    expect(plek?.pagina.onderdelen).toHaveLength(3);
  });

  it("geeft null voor iets wat geen inhoudsblok is", () => {
    expect(plekVanBlok(paginasVan(leerpad), "bestaat-niet")).toBeNull();
  });
});

/* ------------------------------------------------------------------- secties */

describe("paginasPerSectie", () => {
  it("toont zonder secties alleen pagina's, zonder verzonnen groep", () => {
    const leerpad = pad([blok("a", 0), blok("b", 100)]);
    const groepen = paginasPerSectie(leerpad, paginasVan(leerpad));
    expect(groepen).toHaveLength(1);
    expect(groepen[0]!.sectie).toBeNull();
    expect(groepen[0]!.paginas).toHaveLength(2);
  });

  it("geeft niets terug bij een leeg canvas", () => {
    expect(paginasPerSectie(pad([]), [])).toEqual([]);
  });

  it("laat een sectie alles onder zich claimen tot de volgende", () => {
    const leerpad = pad([
      blok("s1", 100, { soort: "sectie", titel: "Deel 1" }),
      blok("a", 150),
      blok("b", 200),
      blok("s2", 400, { soort: "sectie", titel: "Deel 2" }),
      blok("c", 450),
    ]);
    const groepen = paginasPerSectie(leerpad, paginasVan(leerpad));
    expect(groepen.map((g) => g.sectie?.titel ?? null)).toEqual(["Deel 1", "Deel 2"]);
    expect(groepen[0]!.paginas.map((p) => p.kop.id)).toEqual(["a", "b"]);
    expect(groepen[1]!.paginas.map((p) => p.kop.id)).toEqual(["c"]);
  });

  it("zet pagina's bóven de eerste sectie in een groep zonder kop", () => {
    const leerpad = pad([
      blok("vroeg", 10),
      blok("s1", 100, { soort: "sectie", titel: "Deel 1" }),
      blok("a", 150),
    ]);
    const groepen = paginasPerSectie(leerpad, paginasVan(leerpad));
    expect(groepen.map((g) => g.sectie?.titel ?? null)).toEqual([null, "Deel 1"]);
    expect(groepen[0]!.paginas.map((p) => p.kop.id)).toEqual(["vroeg"]);
  });

  it("houdt een lege sectie staan — die heeft de auteur zelf neergezet", () => {
    const leerpad = pad([
      blok("s1", 100, { soort: "sectie", titel: "Nog leeg" }),
      blok("s2", 200, { soort: "sectie", titel: "Deel 2" }),
      blok("a", 250),
    ]);
    const groepen = paginasPerSectie(leerpad, paginasVan(leerpad));
    expect(groepen.map((g) => g.sectie?.titel)).toEqual(["Nog leeg", "Deel 2"]);
    expect(groepen[0]!.paginas).toEqual([]);
  });
});
