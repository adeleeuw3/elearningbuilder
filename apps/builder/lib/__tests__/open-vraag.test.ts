/**
 * De open vraag, van interview tot exportbaar blok.
 *
 * Dit was de scherpste fout die een doorloop van de app opleverde. Het interview biedt "open
 * reflectievragen" aan, het model levert er netjes een — een vraag zonder opties en zonder juist
 * antwoord, want zo werkt een open vraag — en vervolgens weigerde de export de **hele module**:
 *
 *     Kennischeck "Vraag 5" heeft nog geen vraag met antwoorden.
 *
 * Een melding die de oorzaak omdraait: het ontbreken van antwoorden was juist de bedoeling. De
 * speler kon open vragen altijd al tonen; het was het generatiecontract dat ze niet kon uitdrukken.
 *
 * Deze tests dekken de hele keten, want elke schakel kon hem afzonderlijk weer breken: het vinkje
 * op de kaart, het soort knoop, waar de tekst vandaan komt, en wat er in het pakket terechtkomt.
 */
import { describe, it, expect } from "vitest";
import { bouwLeerpad, vraagIsKlaar } from "../graph";
import { leesTekst, contentMetTekst, leerpadUitContent } from "../leerpad";
import { naarObservatieDocument } from "../export";
import type { GeneratedContent, Vraag } from "../types";

const OPEN: Vraag = {
  vraagvorm: "Open reflectievraag",
  vorm: "open",
  vraag: "Welke twee brandrisico's zie je op je eigen werkplek?",
  opties: [],
  correct: 0,
  feedback: "Een sterk antwoord is concreet: noem de plek en het risico.",
};

const KEUZE: Vraag = {
  vraagvorm: "Meerkeuze",
  vorm: "keuze",
  vraag: "Vanaf welke hoogte geldt valgevaar?",
  opties: ["1 meter", "2,5 meter"],
  correct: 1,
  feedback: "Vanaf 2,5 meter.",
};

const content = (vragen: Vraag[]): GeneratedContent => ({
  titel: "Brandveiligheid",
  intro: "Een korte inleiding over brand op de werkvloer.",
  secties: [{ type: "uitleg", kop: "De branddriehoek", tekst: "Brandstof, zuurstof en warmte." }],
  vragen,
  samenvatting: "Ken je vluchtroute.",
});

describe("een open vraag telt als af", () => {
  it("heeft genoeg aan een vraag en een toelichting", () => {
    expect(vraagIsKlaar(OPEN)).toBe(true);
  });

  it("is niet af zonder vraag of zonder toelichting", () => {
    expect(vraagIsKlaar({ ...OPEN, vraag: "   " })).toBe(false);
    expect(vraagIsKlaar({ ...OPEN, feedback: "" })).toBe(false);
  });

  it("verandert niets aan een keuzevraag", () => {
    // Een keuzevraag zonder opties blijft onaf; de versoepeling geldt alleen voor `vorm: "open"`.
    expect(vraagIsKlaar(KEUZE)).toBe(true);
    expect(vraagIsKlaar({ ...KEUZE, opties: [] })).toBe(false);
  });
});

describe("de generator maakt er een reflectie van", () => {
  it("zet een open vraag neer als reflectie en een keuzevraag als toets", () => {
    const knopen = bouwLeerpad(content([KEUZE, OPEN])).knopen;
    expect(knopen.find((k) => k.id === "v0")?.soort).toBe("toets");
    expect(knopen.find((k) => k.id === "v1")?.soort).toBe("reflectie");
  });

  it("geeft de reflectie geen vraagvorm maar wel het juiste werkwoord", () => {
    // Een vraagvorm hoort bij een kennischeck. Hem toch zetten zou een interactietype beloven dat
    // er niet is — en het werkwoord blijft `answered`: de cursist antwoordt wel degelijk.
    const reflectie = bouwLeerpad(content([OPEN])).knopen.find((k) => k.soort === "reflectie")!;
    expect(reflectie.vraagvorm).toBeUndefined();
    expect(reflectie.aiBeoordeling).toBe(false);
    expect(reflectie.xapiWerkwoord).toContain("answered");
  });

  it("merkt hem aan als af, zodat hij niets blokkeert", () => {
    const reflectie = bouwLeerpad(content([OPEN])).knopen.find((k) => k.soort === "reflectie")!;
    expect(reflectie.klaar).toBe(true);
  });
});

describe("de tekst blijft op één plek staan", () => {
  it("leest de vraag uit de content en niet van de knoop", () => {
    // Zou hij zijn tekst op de knoop dragen, dan lopen de blokkenlijst en het whiteboard uiteen
    // zodra iemand er één van aanpast.
    const c = content([OPEN]);
    const reflectie = bouwLeerpad(c).knopen.find((k) => k.soort === "reflectie")!;
    expect(leesTekst(reflectie, c)).toBe(OPEN.vraag);
  });

  it("schrijft een wijziging terug naar de vraag in de content", () => {
    const c = content([OPEN]);
    const reflectie = bouwLeerpad(c).knopen.find((k) => k.soort === "reflectie")!;
    const na = contentMetTekst(reflectie, c, "Nieuwe vraag?");
    expect(na?.vragen[0]?.vraag).toBe("Nieuwe vraag?");
    // En de rest van de vraag blijft staan.
    expect(na?.vragen[0]?.feedback).toBe(OPEN.feedback);
  });
});

describe("het pakket", () => {
  const c = content([KEUZE, OPEN]);
  const uit = naarObservatieDocument({
    leerpad: leerpadUitContent(c),
    content: c,
    artifactId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    iriBase: "https://xapi.example.com/acme",
  });

  it("wordt niet meer geweigerd om een vraag zonder antwoorden", () => {
    if (!uit.ok) throw new Error(uit.redenen.join(" | "));
    expect(uit.ok).toBe(true);
  });

  it("levert een open blok met een prompt — niet een lege sectie", () => {
    if (!uit.ok) throw new Error(uit.redenen.join(" | "));
    const blokken = uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
    const open = blokken.find((b) => b.kind === "open");
    if (open?.kind !== "open") throw new Error("verwachtte een open blok");

    // Hier zat de bug: de tekst werd bewust uit `content.html` gelaten (hij hoort in de prompt),
    // maar er werd nooit een prompt gebouwd. Resultaat: een kopje zonder vraag en zonder tekstvak.
    expect(open.assessment?.prompt).toBeDefined();
    expect(Object.values(open.assessment!.prompt)[0]).toBe(OPEN.vraag);
    expect(open.content.html).toBe("");
  });

  it("vraagt geen juist antwoord bij een open blok", () => {
    if (!uit.ok) throw new Error(uit.redenen.join(" | "));
    const blokken = uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
    const open = blokken.find((b) => b.kind === "open");
    if (open?.kind !== "open") throw new Error("verwachtte een open blok");
    expect(open.assessment?.interactionType).toBe("long-fill-in");
    expect(open.assessment?.correctResponsesPattern).toBeUndefined();
  });

  it("neemt de toelichting mee, zodat de cursist hem na het indienen ziet", () => {
    if (!uit.ok) throw new Error(uit.redenen.join(" | "));
    const blokken = uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
    const open = blokken.find((b) => b.kind === "open");
    if (open?.kind !== "open") throw new Error("verwachtte een open blok");
    expect(Object.values(open.assessment!.feedback!.correct!)[0]).toBe(OPEN.feedback);
  });
});
