/**
 * De brug naar het observatiedocument is waar identiteit ontstaat. Een fout hier is stil: een
 * verkeerde IRI ziet er precies zo uit als een goede. Vandaar dat de seed-koppeling, de escaping
 * en de weigering-bij-onvolledigheid hier alle drie hard staan.
 */
import { describe, it, expect } from "vitest";
import { iri, publishBlockers, parseObservation } from "@ob/schema";
import {
  alsHtml,
  escapeHtml,
  naarObservatieDocument,
  TAAL,
  VRAAGVORM_INTERACTIE,
} from "../export";
import {
  leerpadUitContent,
  verbindKnopen,
  voegKnoopToe,
  wijzigKnoop,
  type Leerpad,
} from "../leerpad";
import type { Knoop, KnoopSoort } from "../graph";
import type { GeneratedContent } from "../types";

const ARTIFACT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const BASE = "https://xapi.example.com/acme";

const content: GeneratedContent = {
  titel: "Veilig werken op hoogte",
  intro: "Vallen van hoogte is de nummer één oorzaak van ongevallen.",
  secties: [{ type: "uitleg", kop: "Valgevaar", tekst: "Vanaf 2,5 meter geldt valgevaar." }],
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

const bouw = () => leerpadUitContent(content);
const exporteer = (leerpad: Leerpad, c: GeneratedContent = content) =>
  naarObservatieDocument({ leerpad, content: c, artifactId: ARTIFACT, iriBase: BASE });

/* -------------------------------------------------------------------- escaping */

describe("escapeHtml / alsHtml", () => {
  it("ontmantelt een scripttag", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapet ook in alinea's, want in het pakket draait geen sanitizer meer", () => {
    const html = alsHtml('Kijk <img src=x onerror=alert(1)> uit');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("maakt alinea's van lege regels en behoudt enkele regeleindes", () => {
    expect(alsHtml("Een\n\nTwee")).toBe("<p>Een</p><p>Twee</p>");
    expect(alsHtml("Een\nnog steeds een")).toBe("<p>Een<br>nog steeds een</p>");
  });

  it("levert niets op bij lege tekst", () => {
    expect(alsHtml("   \n\n  ")).toBe("");
  });
});

/* -------------------------------------------------------------------- het document */

describe("naarObservatieDocument", () => {
  it("levert een document dat het schema doorstaat", () => {
    const uit = exporteer(bouw());
    expect(uit.ok).toBe(true);
    if (!uit.ok) return;
    expect(() => parseObservation(uit.doc)).not.toThrow();
  });

  it("gebruikt de seed als identiteit, niet het documentinterne id", () => {
    const l = bouw();
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join());

    // De pagina-identiteit hangt aan de kop van de keten, niet aan een documentintern id.
    const kop = l.knopen.find((k) => k.id === "intro")!;
    expect(uit.doc.pages[0]!.id).toBe(kop.seed);
    expect(uit.doc.pages[0]!.id).not.toBe(kop.id);

    const page = uit.doc.pages[0]!;
    if (page.kind !== "stack") throw new Error("verwachtte een stapelpagina");
    const seeds = new Set(l.knopen.map((k) => k.seed));
    for (const blok of page.blocks) expect(seeds.has(blok.id)).toBe(true);
  });

  it("zet de blokken in de volgorde waarin de cursist ze krijgt", () => {
    const l = bouw();
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join());
    // Drie pagina's sinds de bouwer de module verdeelt: inleiding, inhoud, toets. De volgorde
    // die de cursist krijgt loopt dus over de pagina's heen.
    const paginas = uit.doc.pages.map((p) => {
      if (p.kind !== "stack") throw new Error("verwachtte een stapelpagina");
      return p;
    });
    expect(paginas.map((p) => Object.values(p.title)[0])).toEqual(["Inleiding", "Inhoud", "Toets"]);
    expect(paginas.map((p) => p.blocks.map((b) => b.name))).toEqual([
      ["Veilig werken op hoogte"],
      ["Valgevaar", "Samenvatting"],
      ["Vraag 1"],
    ]);
    // `order` telt per pagina opnieuw: het is de plek binnen het scherm.
    expect(paginas.map((p) => p.blocks.map((b) => b.order))).toEqual([[0], [0, 1], [0]]);
  });

  it("levert een activityId dat gelijk is aan iri.parent — de eis uit CLAUDE.md", () => {
    const uit = exporteer(bouw());
    if (!uit.ok) throw new Error(uit.redenen.join());
    expect(uit.activityId).toBe(iri.parent(BASE, ARTIFACT));
    expect(uit.activityId).toBe(`${BASE}/artifacts/${ARTIFACT}`);
  });

  it("vertaalt de vraagvorm naar een xAPI-interactietype met een goed antwoordpatroon", () => {
    const uit = exporteer(bouw());
    if (!uit.ok) throw new Error(uit.redenen.join());
    const blokken = uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
    const vraag = blokken.find((b) => b.kind === "question");
    if (vraag?.kind !== "question") throw new Error("verwachtte een vraagblok");
    expect(vraag.assessment.interactionType).toBe(VRAAGVORM_INTERACTIE.meerkeuze);
    expect(vraag.assessment.correctResponsesPattern).toEqual(["c1"]);
    expect(vraag.assessment.choices?.map((c) => c.text[TAAL])).toEqual([
      "1 meter",
      "2,5 meter",
      "5 meter",
    ]);
  });

  it("laat de AI-knoop buiten het document — dat is gereedschap, geen scherm", () => {
    let l = bouw();
    l = voegKnoopToe(l, "ai", 0, 0);
    const ai = l.knopen.at(-1)!;
    l = verbindKnopen(l, ai.id, "s0");
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join());
    const page = uit.doc.pages[0]!;
    if (page.kind !== "stack") throw new Error("verwachtte een stapelpagina");
    expect(page.blocks.map((b) => b.id)).not.toContain(ai.seed);
  });

  it("doorstaat publishBlockers zolang er niets visueels zonder alt-tekst staat", () => {
    const uit = exporteer(bouw());
    if (!uit.ok) throw new Error(uit.redenen.join());
    expect(publishBlockers(uit.doc)).toEqual([]);
  });
});

/* ------------------------------------------------------------------- weigeringen */

describe("naarObservatieDocument weigert", () => {
  it("als er nog geen blok op het canvas staat", () => {
    const l: Leerpad = { knopen: [], verbindingen: [] };
    const uit = exporteer(l);
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.redenen.join()).toContain("geen blok op het canvas");
  });

  it("als een kennischeck geen bruikbare vraag heeft", () => {
    const kaal: GeneratedContent = {
      ...content,
      vragen: [{ ...content.vragen[0]!, opties: ["alleen deze"], correct: 0 }],
    };
    const uit = exporteer(leerpadUitContent(kaal), kaal);
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.redenen.join()).toContain("nog geen vraag met antwoorden");
  });

  it("met een leesbare reden bij een ongeldige iriBase, niet met een crash", () => {
    const uit = naarObservatieDocument({
      leerpad: bouw(),
      content,
      artifactId: ARTIFACT,
      iriBase: "geen-url",
    });
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.redenen.join()).toContain("iriBase");
  });

  it("met een leesbare reden bij een artifactId dat geen uuid is", () => {
    const uit = naarObservatieDocument({
      leerpad: bouw(),
      content,
      artifactId: "e12459c7d08e434ea9d41670e06a3c6c",
      iriBase: BASE,
    });
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.redenen.join()).toContain("artifactId");
  });

  it("noemt de graafproblemen zonder er schemaruis naast te zetten", () => {
    const l: Leerpad = { knopen: [], verbindingen: [] };
    const uit = exporteer(l);
    if (uit.ok) throw new Error("had moeten weigeren");
    expect(uit.redenen).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------- alt-tekst */

describe("alt-tekst", () => {
  const metAfbeelding = () => {
    let l = bouw();
    l = voegKnoopToe(l, "afbeelding", 0, 0);
    const beeld = l.knopen.at(-1)!;
    l = wijzigKnoop(l, beeld.id, {
      titel: "Steigerfoto",
      fragment: "Een correct opgesteld steiger.",
      bestand: {
        naam: "steiger.png",
        mime: "image/png",
        grootte: 1234,
        url: "/api/bestand/0123456789abcdef0123456789abcdef",
        hercodeerd: true,
      },
    });
    // Achteraan de keten zetten zodat hij op dezelfde pagina komt.
    l = verbindKnopen(l, "samenvatting", beeld.id);
    return { l, beeldId: beeld.id };
  };

  it("blokkeert publiceren zolang een afbeelding er geen heeft", () => {
    const { l } = metAfbeelding();
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join());
    expect(publishBlockers(uit.doc).join()).toContain("missing altText");
  });

  it("laat publiceren door zodra hij er is", () => {
    const { l, beeldId } = metAfbeelding();
    const metAlt = wijzigKnoop(l, beeldId, {
      bestand: {
        naam: "steiger.png",
        mime: "image/png",
        grootte: 1234,
        url: "/api/bestand/0123456789abcdef0123456789abcdef",
        hercodeerd: true,
        alt: "Een steiger met leuning en kantplank, correct opgesteld.",
      },
    });
    const uit = exporteer(metAlt);
    if (!uit.ok) throw new Error(uit.redenen.join());
    expect(publishBlockers(uit.doc)).toEqual([]);
  });

  it("verwijst naar het bestand in de opslag, niet naar een blob-url", () => {
    const { l } = metAfbeelding();
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join());
    const blokken = uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
    const beeld = blokken.find((b) => b.content.media.length > 0)!;
    expect(beeld.content.media[0]).toEqual({
      assetId: "0123456789abcdef0123456789abcdef",
      kind: "image",
      // Mét extensie: een statische server leidt daar het content-type uit af. De naam staat in
      // het document zodat de exporter en de speler niet ieder iets anders kunnen verzinnen.
      filename: "0123456789abcdef0123456789abcdef.png",
    });
  });
});

/* -------------------------------------------------------------- componentsoorten */

describe("componentsoorten", () => {
  /**
   * Een bestand voor de mediasoorten.
   *
   * Zonder bestand weigert de export zo'n blok, en terecht: `content.html` is bij media leeg, dus
   * een blok zonder bestand is een sectie waar niets in staat. Deze tests gaan over de *vorm* die
   * een knoop krijgt, dus geven ze hem wat hij nodig heeft om te mogen bestaan.
   */
  const BESTAND = {
    naam: "steiger.png",
    mime: "image/png",
    grootte: 1234,
    url: "/api/bestand/0123456789abcdef0123456789abcdef",
    hercodeerd: true,
    alt: "Een steiger met leuning.",
  };

  /** Een knoop van deze soort achteraan de keten, met een eigen tekst. */
  const metKnoop = (soort: KnoopSoort, velden: Partial<Knoop> = {}) => {
    let l = bouw();
    l = voegKnoopToe(l, soort, 0, 0);
    const knoop = l.knopen.at(-1)!;
    l = wijzigKnoop(l, knoop.id, { titel: "Toegevoegd", ...velden });
    l = verbindKnopen(l, "samenvatting", knoop.id);
    return { l, id: knoop.id, seed: knoop.seed };
  };

  /** De blokken van het document, plat. */
  const blokken = (l: Leerpad) => {
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join(" · "));
    return uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
  };

  it("geeft elke knoopsoort de vorm die erbij hoort", () => {
    const verwacht: [KnoopSoort, string][] = [
      ["uitleg", "text"],
      ["afbeelding", "media"],
      ["video", "media"],
      ["audio", "media"],
      ["reflectie", "open"],
    ];
    for (const [soort, vorm] of verwacht) {
      const { l, seed } = metKnoop(soort, {
        uitvoer: "Waarom denk jij dat?",
        ...(vorm === "media" ? { bestand: BESTAND } : {}),
      });
      const blok = blokken(l).find((b) => b.id === seed)!;
      expect(blok.kind, `${soort} hoort ${vorm} te worden`).toBe(vorm);
    }
  });

  it("maakt van een kennischeck een vraagblok", () => {
    const blok = blokken(bouw()).find((b) => b.kind === "question");
    expect(blok).toBeDefined();
    expect(blok!.kind === "question" && blok!.assessment.interactionType).toBe("choice");
  });

  it("laat een tekstblok tekst blijven — de standaard is de veiligste uitkomst", () => {
    // De assessment-knoop heeft nog geen component in de speler. Hem als vraag exporteren zou een
    // interactie beloven die er niet is; tekst toont wat er wél staat.
    const { l, seed } = metKnoop("assessment");
    expect(blokken(l).find((b) => b.id === seed)!.kind).toBe("text");
  });

  it("laat beeld van rand tot rand lopen en tekst in de leeskolom", () => {
    const { l, seed } = metKnoop("afbeelding", { bestand: BESTAND });
    expect(blokken(l).find((b) => b.id === seed)!.presentation.fullBleed).toBe(true);
    const tekstblok = blokken(l).find((b) => b.kind === "text")!;
    expect(tekstblok.presentation.fullBleed).toBe(false);
  });
});

describe("de open vraag", () => {
  const metReflectie = (uitvoer: string) => {
    let l = bouw();
    l = voegKnoopToe(l, "reflectie", 0, 0);
    const knoop = l.knopen.at(-1)!;
    l = wijzigKnoop(l, knoop.id, { titel: "Jouw kijk", uitvoer });
    l = verbindKnopen(l, "samenvatting", knoop.id);
    return { l, seed: knoop.seed };
  };

  const openBlok = (l: Leerpad, seed: string) => {
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join(" · "));
    const blok = uit.doc.pages
      .flatMap((p) => (p.kind === "stack" ? p.blocks : []))
      .find((b) => b.id === seed)!;
    if (blok.kind !== "open") throw new Error(`verwachtte een open vraag, kreeg ${blok.kind}`);
    return { blok, doc: uit.doc };
  };

  it("wordt vastgelegd, niet beoordeeld", () => {
    const { l, seed } = metReflectie("Wat is volgens jou de grootste uitdaging?");
    const { blok } = openBlok(l, seed);
    expect(blok.assessment.interactionType).toBe("long-fill-in");
    // Geen goed antwoord, en geen punten die suggereren dat er een oordeel geveld is.
    expect(blok.assessment.correctResponsesPattern).toBeUndefined();
    expect(blok.assessment.score).toEqual({ min: 0, max: 0, correct: 0 });
  });

  it("draagt de vraag in de prompt en niet óók in de body", () => {
    const vraag = "Wat is volgens jou de grootste uitdaging?";
    const { l, seed } = metReflectie(vraag);
    const { blok } = openBlok(l, seed);
    expect(blok.assessment.prompt[TAAL]).toBe(vraag);
    expect(blok.content.html).toBe("");
  });

  it("krijgt de tekenlimiet uit het schema als de auteur er geen koos", () => {
    const { l, seed } = metReflectie("Waarom?");
    expect(openBlok(l, seed).blok.maxLength).toBe(500);
  });

  it("blokkeert publiceren niet — er valt niets goed te rekenen", () => {
    // `publishBlockers()` eist een correctResponsesPattern bij elke andere interactie. Zou hij dat
    // hier ook doen, dan was een module met één reflectie nooit meer te publiceren.
    const { l, seed } = metReflectie("Waarom?");
    expect(publishBlockers(openBlok(l, seed).doc)).toEqual([]);
  });

  it("weigert met een leesbare reden als er nog geen vraag staat", () => {
    let l = bouw();
    l = voegKnoopToe(l, "reflectie", 0, 0);
    const knoop = l.knopen.at(-1)!;
    l = wijzigKnoop(l, knoop.id, { titel: "" });
    l = verbindKnopen(l, "samenvatting", knoop.id);
    const uit = exporteer(l);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.redenen.join()).toContain("vraagtekst");
  });
});

describe("citaat", () => {
  const metCitaat = (tekst: string, bron?: string) => {
    let l = bouw();
    l = voegKnoopToe(l, "citaat", 0, 0);
    const knoop = l.knopen.at(-1)!;
    l = wijzigKnoop(l, knoop.id, { titel: "Nappo", uitvoer: tekst, ...(bron ? { bronvermelding: bron } : {}) });
    l = verbindKnopen(l, "samenvatting", knoop.id);
    return { l, seed: knoop.seed };
  };

  const citaatBlok = (l: Leerpad, seed: string) => {
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join(" · "));
    const blok = uit.doc.pages
      .flatMap((p) => (p.kind === "stack" ? p.blocks : []))
      .find((b) => b.id === seed)!;
    if (blok.kind !== "quote") throw new Error(`verwachtte een citaat, kreeg ${blok.kind}`);
    return blok;
  };

  it("draagt de tekst en de bronvermelding", () => {
    const { l, seed } = metCitaat("Reputatie bouw je in twintig jaar.", "Stephane Nappo");
    const blok = citaatBlok(l, seed);
    expect(blok.content.html).toContain("twintig jaar");
    expect(blok.attribution?.[TAAL]).toBe("Stephane Nappo");
  });

  it("laat de bron weg als de auteur er geen koos", () => {
    const { l, seed } = metCitaat("Zonder bron.");
    expect(citaatBlok(l, seed).attribution).toBeUndefined();
  });

  it("krijgt de volle breedte, een halve schermhoogte en nadruk — het is een adempauze", () => {
    // Nadruk en geen kleur: welke kleur bij "accent" hoort bepaalt het thema, zodat twee modules
    // uit twee prompts er hetzelfde uitzien.
    const { l, seed } = metCitaat("Iets van betekenis.");
    expect(citaatBlok(l, seed).presentation).toEqual({
      nadruk: "accent",
      fullBleed: true,
      minHeight: 0.5,
    });
  });

  it("weigert een citaat zonder tekst", () => {
    const { l } = metCitaat("");
    const uit = exporteer(l);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.redenen.join()).toContain("nog geen tekst");
  });
});

describe("carrousel", () => {
  const metCarrousel = (
    items: {
      id: string;
      kop: string;
      tekst: string;
      citaat?: string;
      bestand?: Knoop["bestand"];
    }[],
  ) => {
    let l = bouw();
    l = voegKnoopToe(l, "carrousel", 0, 0);
    const knoop = l.knopen.at(-1)!;
    l = wijzigKnoop(l, knoop.id, { titel: "De keten", items });
    l = verbindKnopen(l, "samenvatting", knoop.id);
    return { l, seed: knoop.seed };
  };

  const twee = [
    { id: "i1", kop: "Het signaal", tekst: "Een ziekenhuis meldt een verdachte e-mail." },
    { id: "i2", kop: "Het onderzoek", tekst: "De politie haalt de logs op.", citaat: "Samenwerking begint bij communicatie." },
  ];

  const carrouselBlok = (l: Leerpad, seed: string) => {
    const uit = exporteer(l);
    if (!uit.ok) throw new Error(uit.redenen.join(" · "));
    const blok = uit.doc.pages
      .flatMap((p) => (p.kind === "stack" ? p.blocks : []))
      .find((b) => b.id === seed)!;
    if (blok.kind !== "carousel") throw new Error(`verwachtte een carrousel, kreeg ${blok.kind}`);
    return blok;
  };

  it("houdt de stappen in de volgorde van de auteur", () => {
    const { l, seed } = metCarrousel(twee);
    const blok = carrouselBlok(l, seed);
    expect(blok.items.map((i) => i.heading[TAAL])).toEqual(["Het signaal", "Het onderzoek"]);
    expect(blok.items[1]!.highlight?.[TAAL]).toContain("communicatie");
  });

  it("zet de tekst in de stappen en niet óók erboven", () => {
    const { l, seed } = metCarrousel(twee);
    const blok = carrouselBlok(l, seed);
    expect(blok.content.html).toBe("");
    expect(blok.items[0]!.content.html).toContain("ziekenhuis");
  });

  it("laat lege stappen weg in plaats van ze te exporteren", () => {
    const { l, seed } = metCarrousel([...twee, { id: "i3", kop: "  ", tekst: "" }]);
    expect(carrouselBlok(l, seed).items).toHaveLength(2);
  });

  it("draagt de alt-tekst van een stap mee, zodat de publicatiepoort hem kan zien", () => {
    const beeld = (alt?: string) => ({
      naam: "netwerk.png",
      mime: "image/png",
      grootte: 1234,
      url: "/api/bestand/0123456789abcdef0123456789abcdef",
      hercodeerd: true,
      ...(alt === undefined ? {} : { alt }),
    });

    const zonder = metCarrousel([{ ...twee[0]!, bestand: beeld() }, twee[1]!]);
    const uitZonder = exporteer(zonder.l);
    if (!uitZonder.ok) throw new Error(uitZonder.redenen.join());
    // De poort zit in `@ob/schema`, niet in de brug: die weigert niet, hij levert aan.
    expect(publishBlockers(uitZonder.doc).join()).toContain("item[0]");

    const met = metCarrousel([
      { ...twee[0]!, bestand: beeld("Een wereldkaart met versleutelde knooppunten.") },
      twee[1]!,
    ]);
    const uitMet = exporteer(met.l);
    if (!uitMet.ok) throw new Error(uitMet.redenen.join());
    expect(publishBlockers(uitMet.doc)).toEqual([]);
  });

  it("weigert een carrousel met minder dan twee ingevulde stappen", () => {
    const { l } = metCarrousel([twee[0]!, { id: "i2", kop: "", tekst: "" }]);
    const uit = exporteer(l);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.redenen.join()).toContain("minstens twee");
  });
});

describe("doorlooptijd", () => {
  it("telt de minuten van wat de cursist doorloopt", () => {
    const uit = exporteer(bouw());
    if (!uit.ok) throw new Error(uit.redenen.join());
    const doc = uit.doc;
    const verwacht = doc.pages
      .flatMap((p) => (p.kind === "stack" ? p.blocks : []))
      .length;
    expect(doc.metadata.estimatedMinutes).toBeGreaterThan(0);
    // Geen exacte som overtypen — dat zou de schatting twee keer opschrijven. Wel: elk blok telt
    // minstens een minuut, dus de schatting kan niet ónder het aantal blokken liggen.
    expect(doc.metadata.estimatedMinutes!).toBeGreaterThanOrEqual(verwacht);
  });

  it("telt gereedschap van de auteur niet mee", () => {
    let l = bouw();
    l = voegKnoopToe(l, "ai", 0, 0);
    const metAi = exporteer(l);
    const zonder = exporteer(bouw());
    if (!metAi.ok || !zonder.ok) throw new Error("verwachtte twee geldige documenten");
    expect(metAi.doc.metadata.estimatedMinutes).toBe(zonder.doc.metadata.estimatedMinutes);
  });
});
