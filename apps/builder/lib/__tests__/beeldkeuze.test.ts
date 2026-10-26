/**
 * Beeld kiezen bij de stof.
 *
 * Twee dingen gaan hier stil fout. Een zoekterm die alleen uit lidwoorden en vraagwoorden bestaat
 * levert geen foutmelding op maar een lege strook — de auteur ziet "niets gevonden" en denkt dat
 * de bron leeg is. En een beeld dat bij de verkeerde sectie belandt ziet er niet kapot uit; het
 * ziet er alleen vreemd uit, en dat merk je pas in het LMS.
 */
import { describe, it, expect } from "vitest";
import { beeldstappen, hoeveelBeelden, metBeelden, zoektermVoorSectie } from "../beeldkeuze";
import { bouwLeerpad } from "../graph";
import type { Bestand } from "../bestand";
import type { GeneratedContent } from "../types";

const BESTAND = (naam: string): Bestand => ({
  naam,
  mime: "image/jpeg",
  grootte: 1024,
  url: `blob:${naam}`,
  hercodeerd: true,
});

const content = (koppen: string[]): GeneratedContent => ({
  titel: "Brandveiligheid op de werkvloer",
  intro: "Een inleiding.",
  secties: koppen.map((kop) => ({ type: "uitleg" as const, kop, tekst: `Tekst over ${kop}.` })),
  vragen: [],
  samenvatting: "Een slot.",
});

describe("zoektermVoorSectie", () => {
  it("houdt de woorden over die een beeld kunnen dragen", () => {
    expect(zoektermVoorSectie("Brandveiligheid", "Wat doe je bij een brandalarm?")).toBe(
      "brandalarm",
    );
  });

  it("laat een kop die al concreet is met rust", () => {
    expect(zoektermVoorSectie("Brandveiligheid", "De branddriehoek")).toBe("branddriehoek");
  });

  it("valt terug op het onderwerp als er niets overblijft", () => {
    // "Wat doe je?" houdt na het wegstrepen niets over. Een lege term is een zoekopdracht die
    // gegarandeerd niets vindt, en dat leest als "de bron heeft niets".
    expect(zoektermVoorSectie("Brandveiligheid op de werkvloer", "Wat doe je?")).toBe(
      "Brandveiligheid op de werkvloer",
    );
  });

  it("gebruikt de Engelse term van het model als die er is", () => {
    // De bronnen indexeren op Engels. Zonder deze term gaf "begin stoel basis houding" flamingo,
    // law, button en winter; "office chair posture" gaf een bureaustoel.
    expect(
      zoektermVoorSectie("Ergonomie", "Begin bij de stoel", "office chair posture"),
    ).toBe("office chair posture");
  });

  it("negeert een lege term van het model en valt terug op de kop", () => {
    expect(zoektermVoorSectie("Ergonomie", "De branddriehoek", "   ")).toBe("branddriehoek");
    expect(zoektermVoorSectie("Ergonomie", "De branddriehoek", undefined)).toBe("branddriehoek");
  });

  it("knipt een lange kop af in plaats van hem hele zinnen te laten worden", () => {
    const lang = "Herkennen melden blussen ontruimen evalueren nazorg registreren";
    expect(zoektermVoorSectie("Brand", lang).split(" ").length).toBeLessThanOrEqual(4);
  });
});

describe("beeldstappen", () => {
  it("geeft één stap per sectie, met de index erbij", () => {
    const stappen = beeldstappen(content(["De branddriehoek", "Vluchtroutes"]));
    expect(stappen.map((s) => s.index)).toEqual([0, 1]);
    expect(stappen.map((s) => s.kop)).toEqual(["De branddriehoek", "Vluchtroutes"]);
  });

  it("slaat een sectie zonder kop over", () => {
    expect(beeldstappen(content(["Goede kop", "   "]))).toHaveLength(1);
  });

  it("toont een fragment van de tekst, zodat je ziet wat je illustreert", () => {
    const stap = beeldstappen(content(["De branddriehoek"]))[0]!;
    expect(stap.fragment).toContain("De branddriehoek");
  });

  it("vraagt niets bij een module zonder secties", () => {
    expect(beeldstappen(content([]))).toEqual([]);
  });
});

describe("weinig beeld is niet geen beeld", () => {
  const zes = content(["Een", "Twee", "Drie", "Vier", "Vijf", "Zes"]);

  it("vraagt bij elk niveau om minstens één beeld", () => {
    // Dit ging mis: "weinig beeld" sloeg de hele stap over, en dan krijgt een auteur die om een
    // paar afbeeldingen vroeg er nul.
    for (const niveau of ["weinig", "gemiddeld", "beeldrijk"]) {
      expect(beeldstappen(zes, niveau).length).toBeGreaterThan(0);
    }
  });

  it("vraagt om meer naarmate het niveau hoger is", () => {
    const weinig = beeldstappen(zes, "weinig").length;
    const gemiddeld = beeldstappen(zes, "gemiddeld").length;
    const rijk = beeldstappen(zes, "beeldrijk").length;
    expect(weinig).toBeLessThan(gemiddeld);
    expect(gemiddeld).toBeLessThan(rijk);
    expect(rijk).toBe(6);
  });

  it("houdt ook bij één sectie en 'weinig' één stap over", () => {
    // Afronden naar beneden zou hier nul opleveren; een module met één sectie en "weinig beeld"
    // hoort toch de vraag te krijgen.
    expect(hoeveelBeelden(1, "weinig")).toBe(1);
    expect(beeldstappen(content(["Enige sectie"]), "weinig")).toHaveLength(1);
  });

  it("verdeelt de stappen over de module in plaats van vooraan te stapelen", () => {
    // Drie beelden bovenaan en verder niets ziet er onaf uit; begin-midden-eind leest als een
    // bedoeling.
    const indices = beeldstappen(zes, "weinig").map((s) => s.index);
    expect(indices).toContain(0);
    expect(indices[indices.length - 1]).toBe(5);
  });

  it("vraagt om alles als er geen niveau bekend is", () => {
    // Een module die buiten het interview om is begonnen heeft geen antwoord; dan niets vragen
    // zou het beeld stil weglaten.
    expect(beeldstappen(zes).length).toBe(6);
    expect(beeldstappen(zes, null).length).toBe(6);
  });
});

describe("metBeelden", () => {
  const basis = () => bouwLeerpad(content(["Eerste", "Tweede"]));

  it("zet het beeld op de knoop van de juiste sectie", () => {
    const na = metBeelden(basis(), { 1: BESTAND("tweede.jpg") });
    expect(na.knopen.find((k) => k.id === "s1")?.bestand?.naam).toBe("tweede.jpg");
    expect(na.knopen.find((k) => k.id === "s0")?.bestand).toBeUndefined();
  });

  it("koppelt op index en niet op volgorde in de keten", () => {
    // De volgorde verandert zodra de auteur iets versleept; dan zou het beeld meeschuiven naar een
    // sectie waar het niet over gaat.
    const omgedraaid = basis();
    const knopen = [...omgedraaid.knopen].reverse();
    const na = metBeelden({ ...omgedraaid, knopen }, { 0: BESTAND("eerste.jpg") });
    expect(na.knopen.find((k) => k.id === "s0")?.bestand?.naam).toBe("eerste.jpg");
    expect(na.knopen.find((k) => k.id === "s1")?.bestand).toBeUndefined();
  });

  it("raakt de intro en de samenvatting niet aan", () => {
    // Die dragen `index: null`; zou de koppeling op volgorde lopen, dan kreeg de intro het beeld
    // van de eerste sectie.
    const na = metBeelden(basis(), { 0: BESTAND("eerste.jpg") });
    expect(na.knopen.find((k) => k.bron === "intro")?.bestand).toBeUndefined();
    expect(na.knopen.find((k) => k.bron === "samenvatting")?.bestand).toBeUndefined();
  });

  it("laat een blok dat de auteur zelf neerzette met rust", () => {
    const eigen = basis();
    const metEigen = {
      ...eigen,
      knopen: eigen.knopen.map((k) =>
        k.id === "s0" ? { ...k, eigen: true, bestand: BESTAND("eigen-keuze.jpg") } : k,
      ),
    };
    const na = metBeelden(metEigen, { 0: BESTAND("van-stock.jpg") });
    expect(na.knopen.find((k) => k.id === "s0")?.bestand?.naam).toBe("eigen-keuze.jpg");
  });

  it("geeft hetzelfde leerpad terug als er niets gekozen is", () => {
    const voor = basis();
    expect(metBeelden(voor, {})).toBe(voor);
  });
});
