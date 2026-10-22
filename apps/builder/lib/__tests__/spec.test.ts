/**
 * De interview-lus draait op deze functies. Ze zijn puur, dus hier te testen zonder API-key —
 * en dit is precies het deel waar een fout stil is: een antwoord dat het verkeerde veld raakt,
 * of leerdoelen die bij een verdiepingsvraag verdwijnen, ziet niemand tot een gebruiker het meldt.
 */
import { describe, it, expect } from "vitest";
import {
  aanpasbareVelden,
  aantalGevuld,
  antwoordAlsTekst,
  isCompleet,
  isGevuld,
  metDefaults,
  ontbrekendeVelden,
  pasAntwoordToe,
  pipStatussen,
  wisVeld,
} from "../spec";
import { DEFAULT_LENGTE, DEFAULT_TOON, LEGE_MODULE_SPEC, type ModuleSpec } from "../types";

const VOLLEDIG: ModuleSpec = {
  onderwerp: "Veilig werken op hoogte",
  doelgroep: "Nieuwe monteurs",
  leerdoelen: ["Valgevaren herkennen"],
  toon: null,
  vraagvormen: ["Meerkeuze"],
  lengte: null,
  context: null,
  thema: null,
  beeldgebruik: null,
  video: null,
};

/* -------------------------------------------------------------- pasAntwoordToe */

describe("pasAntwoordToe — scalaire velden", () => {
  it("schrijft vrije tekst in het veld", () => {
    const s = pasAntwoordToe(LEGE_MODULE_SPEC, "onderwerp", ["Brandveiligheid"], "text");
    expect(s.onderwerp).toBe("Brandveiligheid");
  });

  it("trimt witruimte", () => {
    const s = pasAntwoordToe(LEGE_MODULE_SPEC, "onderwerp", ["  Brandveiligheid  "], "text");
    expect(s.onderwerp).toBe("Brandveiligheid");
  });

  it("zet een leeg antwoord terug op null in plaats van een lege string", () => {
    const s = pasAntwoordToe(VOLLEDIG, "onderwerp", ["   "], "text");
    expect(s.onderwerp).toBeNull();
  });

  it("overschrijft bij een tweede antwoord", () => {
    const een = pasAntwoordToe(LEGE_MODULE_SPEC, "doelgroep", ["Monteurs"], "text");
    const twee = pasAntwoordToe(een, "doelgroep", ["Leidinggevenden"], "text");
    expect(twee.doelgroep).toBe("Leidinggevenden");
  });

  it("raakt andere velden niet aan", () => {
    const s = pasAntwoordToe(VOLLEDIG, "doelgroep", ["Anderen"], "text");
    expect(s.onderwerp).toBe(VOLLEDIG.onderwerp);
    expect(s.leerdoelen).toEqual(VOLLEDIG.leerdoelen);
  });

  it("muteert de oorspronkelijke spec niet", () => {
    const origineel = { ...LEGE_MODULE_SPEC };
    pasAntwoordToe(origineel, "onderwerp", ["X"], "text");
    expect(origineel.onderwerp).toBeNull();
  });
});

describe("pasAntwoordToe — lijstvelden", () => {
  it("vervangt de lijst bij een multi_select (het antwoord ís de hele set)", () => {
    const een = pasAntwoordToe(LEGE_MODULE_SPEC, "vraagvormen", ["Meerkeuze"], "multi_select");
    const twee = pasAntwoordToe(een, "vraagvormen", ["Waar/niet waar", "Sleep"], "multi_select");
    expect(twee.vraagvormen).toEqual(["Waar/niet waar", "Sleep"]);
  });

  it("vult aan bij vrije tekst — een verdiepingsvraag wist niets", () => {
    const een = pasAntwoordToe(LEGE_MODULE_SPEC, "leerdoelen", ["Valgevaren herkennen"], "text");
    const twee = pasAntwoordToe(een, "leerdoelen", ["Harnas aanleggen"], "text");
    expect(twee.leerdoelen).toEqual(["Valgevaren herkennen", "Harnas aanleggen"]);
  });

  it("vult ook aan bij text_of_keuze", () => {
    const een = pasAntwoordToe(LEGE_MODULE_SPEC, "leerdoelen", ["A"], "text");
    const twee = pasAntwoordToe(een, "leerdoelen", ["B"], "text_of_keuze");
    expect(twee.leerdoelen).toEqual(["A", "B"]);
  });

  it("ontdubbelt bij aanvullen", () => {
    const een = pasAntwoordToe(LEGE_MODULE_SPEC, "leerdoelen", ["A"], "text");
    const twee = pasAntwoordToe(een, "leerdoelen", ["A"], "text");
    expect(twee.leerdoelen).toEqual(["A"]);
  });

  it("laat lege waarden vallen", () => {
    const s = pasAntwoordToe(LEGE_MODULE_SPEC, "leerdoelen", ["A", "  ", ""], "multi_select");
    expect(s.leerdoelen).toEqual(["A"]);
  });

  it("maakt van een single_select op een lijstveld een lijst van één", () => {
    const s = pasAntwoordToe(LEGE_MODULE_SPEC, "vraagvormen", ["Meerkeuze"], "single_select");
    expect(s.vraagvormen).toEqual(["Meerkeuze"]);
  });
});

/* --------------------------------------------------------------------- wisVeld */

describe("wisVeld", () => {
  it("zet een scalair veld op null", () => {
    expect(wisVeld(VOLLEDIG, "onderwerp").onderwerp).toBeNull();
  });

  it("zet een lijstveld op een lege lijst, niet op null", () => {
    expect(wisVeld(VOLLEDIG, "leerdoelen").leerdoelen).toEqual([]);
  });

  it("maakt de spec daarmee weer incompleet", () => {
    expect(isCompleet(VOLLEDIG)).toBe(true);
    expect(isCompleet(wisVeld(VOLLEDIG, "doelgroep"))).toBe(false);
  });
});

/* ------------------------------------------------------- gevuld / ontbrekend */

describe("isGevuld", () => {
  it("noemt een lege lijst niet gevuld", () => {
    expect(isGevuld(LEGE_MODULE_SPEC, "leerdoelen")).toBe(false);
  });

  it("noemt witruimte niet gevuld", () => {
    expect(isGevuld({ ...LEGE_MODULE_SPEC, onderwerp: "   " }, "onderwerp")).toBe(false);
  });

  it("noemt een gevulde lijst gevuld", () => {
    expect(isGevuld(VOLLEDIG, "vraagvormen")).toBe(true);
  });
});

describe("ontbrekendeVelden", () => {
  it("geeft alle vier terug bij een lege spec, in uitvraagvolgorde", () => {
    expect(ontbrekendeVelden(LEGE_MODULE_SPEC)).toEqual([
      "onderwerp",
      "doelgroep",
      "leerdoelen",
      "vraagvormen",
    ]);
  });

  it("negeert optionele velden", () => {
    expect(ontbrekendeVelden(VOLLEDIG)).toEqual([]);
    expect(VOLLEDIG.toon).toBeNull(); // toon is leeg, maar blokkeert niet
  });
});

/* ------------------------------------------------------------------- pips */

describe("pipStatussen", () => {
  it("is alles leeg bij de start", () => {
    const p = pipStatussen(LEGE_MODULE_SPEC, null);
    expect(p.map((x) => x.status)).toEqual(new Array(7).fill("leeg"));
  });

  it("markeert het veld waar nu een vraag over gaat als actief", () => {
    const p = pipStatussen(LEGE_MODULE_SPEC, "onderwerp");
    expect(p[0]?.status).toBe("actief");
    expect(p[1]?.status).toBe("leeg");
  });

  it("markeert gevulde velden als gevuld", () => {
    const spec = { ...LEGE_MODULE_SPEC, onderwerp: "X" };
    const p = pipStatussen(spec, "doelgroep");
    expect(p[0]?.status).toBe("gevuld");
    expect(p[1]?.status).toBe("actief");
  });

  it("laat actief winnen van gevuld bij een verdiepingsvraag", () => {
    const p = pipStatussen(VOLLEDIG, "leerdoelen");
    expect(p.find((x) => x.veld === "leerdoelen")?.status).toBe("actief");
  });

  it("geeft een pip per vraag die het interview stelt", () => {
    // Zeven en niet vier: de pips tellen wat er gevraagd wordt. Toen ze de verplichte velden
    // telden stond er "4 / 4" boven een gesprek dat daarna nog drie vragen stelde.
    const p = pipStatussen(LEGE_MODULE_SPEC, null);
    expect(p.map((x) => x.label)).toEqual([
      "Onderwerp",
      "Doelgroep",
      "Leerdoelen",
      "Vraagvormen",
      "Thema",
      "Beeldgebruik",
      "Video",
    ]);
  });

  it("laat een overgeslagen ontwerpveld het genereren niet blokkeren", () => {
    // De pips tellen zeven vragen, maar alleen de inhoud is noodzakelijk: thema, beeldgebruik en
    // video hebben een terugval. Zouden ze hier meetellen, dan kon een auteur die ze overslaat
    // helemaal geen module meer krijgen.
    const zonderOntwerp: ModuleSpec = { ...VOLLEDIG, thema: null, beeldgebruik: null, video: null };
    expect(isCompleet(zonderOntwerp)).toBe(true);
    expect(ontbrekendeVelden(zonderOntwerp)).toEqual([]);
  });
});

describe("aantalGevuld", () => {
  it("telt alleen verplichte velden", () => {
    expect(aantalGevuld(LEGE_MODULE_SPEC)).toBe(0);
    expect(aantalGevuld(VOLLEDIG)).toBe(4);
    expect(aantalGevuld({ ...LEGE_MODULE_SPEC, toon: "warm" })).toBe(0);
  });
});

/* -------------------------------------------------------------- metDefaults */

describe("metDefaults", () => {
  it("vult toon en lengte met hun default", () => {
    const c = metDefaults(VOLLEDIG);
    expect(c?.toon).toBe(DEFAULT_TOON);
    expect(c?.lengte).toBe(DEFAULT_LENGTE);
  });

  it("respecteert een ingevulde toon en lengte", () => {
    const c = metDefaults({ ...VOLLEDIG, toon: "informeel", lengte: "~5 min" });
    expect(c?.toon).toBe("informeel");
    expect(c?.lengte).toBe("~5 min");
  });

  it("behandelt witruimte als niet ingevuld", () => {
    const c = metDefaults({ ...VOLLEDIG, toon: "   " });
    expect(c?.toon).toBe(DEFAULT_TOON);
  });

  it("geeft null als een verplicht veld ontbreekt", () => {
    expect(metDefaults(LEGE_MODULE_SPEC)).toBeNull();
    expect(metDefaults({ ...VOLLEDIG, vraagvormen: [] })).toBeNull();
  });

  it("laat context null als het leeg is (het is optioneel zonder default)", () => {
    expect(metDefaults(VOLLEDIG)?.context).toBeNull();
  });
});

/* --------------------------------------------------- aanpasbare velden & tekst */

describe("aanpasbareVelden", () => {
  it("biedt alleen gevulde velden aan", () => {
    const velden = aanpasbareVelden(VOLLEDIG).map((v) => v.veld);
    expect(velden).toContain("onderwerp");
    expect(velden).toContain("leerdoelen");
    expect(velden).not.toContain("toon"); // leeg
  });

  it("is leeg bij een lege spec", () => {
    expect(aanpasbareVelden(LEGE_MODULE_SPEC)).toEqual([]);
  });
});

describe("antwoordAlsTekst", () => {
  it("plakt meerdere keuzes met komma's", () => {
    expect(antwoordAlsTekst(["Meerkeuze", "Sleep"])).toBe("Meerkeuze, Sleep");
  });

  it("laat lege waarden weg", () => {
    expect(antwoordAlsTekst(["A", "  ", "B"])).toBe("A, B");
  });
});
