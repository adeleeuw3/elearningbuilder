/**
 * De bewerkbare blokken draaien op deze functies. Het gevaarlijke geval is `correct`: dat is een
 * index in `opties`, en JSON Schema kan hier geen numerieke grens afdwingen. Wijst hij naar het
 * verkeerde of naar een niet-bestaand antwoord, dan is de vraag stuk zonder dat iets faalt.
 */
import { describe, it, expect } from "vitest";
import {
  andereKoppen,
  andereVragen,
  normaliseerContent,
  vervangSectie,
  vervangVraag,
  verwijderOptie,
  voegOptieToe,
  wijzigOptie,
  zetCorrect,
} from "../content";
import type { GeneratedContent, Sectie, Vraag } from "../types";

const vraag: Vraag = {
  vraagvorm: "Meerkeuze",
  vorm: "keuze" as const,
  vraag: "Wat doe je eerst?",
  opties: ["Harnas checken", "Meteen klimmen", "Ladder vastzetten"],
  correct: 2,
  feedback: "Je zet altijd eerst de ladder vast.",
};

const content: GeneratedContent = {
  titel: "Veilig werken op hoogte",
  intro: "In deze module…",
  secties: [
    { kop: "Risico's", tekst: "…", type: "uitleg" },
    { kop: "Valbeveiliging", tekst: "…", type: "uitleg" },
  ],
  vragen: [vraag, { ...vraag, vraag: "En daarna?", correct: 0 }],
  samenvatting: "Kort…",
};

/* ------------------------------------------------------------ blok vervangen */

describe("vervangSectie / vervangVraag", () => {
  const nieuw: Sectie = { kop: "Nieuw", tekst: "Andere tekst", type: "uitleg" };

  it("vervangt de sectie op de juiste index", () => {
    const c = vervangSectie(content, 1, nieuw);
    expect(c.secties[0]?.kop).toBe("Risico's");
    expect(c.secties[1]?.kop).toBe("Nieuw");
  });

  it("laat een onbekende index de content ongemoeid", () => {
    expect(vervangSectie(content, 9, nieuw)).toBe(content);
    expect(vervangSectie(content, -1, nieuw)).toBe(content);
  });

  it("vervangt de vraag op de juiste index", () => {
    const c = vervangVraag(content, 0, { ...vraag, vraag: "Anders?" });
    expect(c.vragen[0]?.vraag).toBe("Anders?");
    expect(c.vragen[1]?.vraag).toBe("En daarna?");
  });

  it("muteert het origineel niet", () => {
    vervangSectie(content, 0, nieuw);
    expect(content.secties[0]?.kop).toBe("Risico's");
  });
});

/* ------------------------------------------------------------------- opties */

describe("wijzigOptie", () => {
  it("verandert alleen de tekst, niet welk antwoord juist is", () => {
    const v = wijzigOptie(vraag, 0, "Harnas controleren");
    expect(v.opties[0]).toBe("Harnas controleren");
    expect(v.correct).toBe(2);
  });

  it("negeert een index buiten bereik", () => {
    expect(wijzigOptie(vraag, 9, "x")).toBe(vraag);
  });
});

describe("verwijderOptie — houdt `correct` naar hetzelfde antwoord wijzen", () => {
  it("schuift correct op als een optie ervóór verdwijnt", () => {
    const v = verwijderOptie(vraag, 0); // correct was 2 ("Ladder vastzetten")
    expect(v.opties).toEqual(["Meteen klimmen", "Ladder vastzetten"]);
    expect(v.correct).toBe(1);
    expect(v.opties[v.correct]).toBe("Ladder vastzetten"); // zelfde antwoord
  });

  it("laat correct staan als een optie erná verdwijnt", () => {
    const v = verwijderOptie({ ...vraag, correct: 0 }, 2);
    expect(v.correct).toBe(0);
    expect(v.opties[v.correct]).toBe("Harnas checken");
  });

  it("valt terug op 0 als het juiste antwoord zelf verdwijnt", () => {
    const v = verwijderOptie(vraag, 2);
    expect(v.correct).toBe(0);
    expect(v.opties[v.correct]).toBeDefined();
  });

  it("weigert onder de twee opties te gaan — dan is het geen vraag meer", () => {
    const tweeOpties: Vraag = { ...vraag, opties: ["A", "B"], correct: 1 };
    expect(verwijderOptie(tweeOpties, 0)).toBe(tweeOpties);
  });

  it("houdt correct altijd binnen bereik", () => {
    const v = verwijderOptie({ ...vraag, correct: 2 }, 1);
    expect(v.correct).toBeGreaterThanOrEqual(0);
    expect(v.correct).toBeLessThan(v.opties.length);
  });
});

describe("voegOptieToe / zetCorrect", () => {
  it("voegt een lege optie toe zonder correct te verstoren", () => {
    const v = voegOptieToe(vraag);
    expect(v.opties).toHaveLength(4);
    expect(v.opties[3]).toBe("");
    expect(v.correct).toBe(2);
  });

  it("zet het juiste antwoord", () => {
    expect(zetCorrect(vraag, 0).correct).toBe(0);
  });

  it("negeert een index buiten bereik", () => {
    expect(zetCorrect(vraag, 9)).toBe(vraag);
    expect(zetCorrect(vraag, -1)).toBe(vraag);
  });
});

/* -------------------------------------------------------- normaliseerContent */

describe("normaliseerContent", () => {
  it("trekt een te hoge correct-index binnen bereik", () => {
    const kapot: GeneratedContent = { ...content, vragen: [{ ...vraag, correct: 7 }] };
    const c = normaliseerContent(kapot);
    expect(c.vragen[0]?.correct).toBe(2); // laatste geldige index
  });

  it("trekt een negatieve correct-index naar 0", () => {
    const kapot: GeneratedContent = { ...content, vragen: [{ ...vraag, correct: -3 }] };
    expect(normaliseerContent(kapot).vragen[0]?.correct).toBe(0);
  });

  it("laat geldige content ongewijzigd", () => {
    expect(normaliseerContent(content).vragen[0]?.correct).toBe(2);
  });

  it("garandeert dat elke vraag een bestaand juist antwoord heeft", () => {
    const kapot: GeneratedContent = {
      ...content,
      vragen: [{ ...vraag, correct: 99 }, { ...vraag, correct: -1 }],
    };
    for (const v of normaliseerContent(kapot).vragen) {
      expect(v.opties[v.correct]).toBeDefined();
    }
  });
});

/* ------------------------------------------------------------------ context */

describe("andereKoppen / andereVragen", () => {
  it("laat de eigen kop weg", () => {
    expect(andereKoppen(content, 0)).toEqual(["Valbeveiliging"]);
  });

  it("laat de eigen vraag weg", () => {
    expect(andereVragen(content, 0)).toEqual(["En daarna?"]);
  });
});
