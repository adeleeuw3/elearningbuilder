/**
 * Tekst uit een aangeleverd document halen.
 *
 * Dit is bij uitstek het deel dat stil fout gaat. Een gemiste tag of een verkeerd gelezen lengte
 * levert geen foutmelding op maar een hálf document — en een model dat op een half handboek
 * bouwt, schrijft met volle overtuiging een module die een hoofdstuk mist.
 *
 * De lastigste eigenschap van een DOCX staat in de derde test: Word hakt één zin in stukken zodra
 * er opmaak in zit. "Meld het **direct**" staat als drie losse `<w:t>`-stukjes in de XML. Worden
 * die met spaties aan elkaar geplakt, dan staat er "Meld het direct ." in je bronmateriaal.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  alineasUitTekst,
  alineasUitXml,
  alsBrontekst,
  herkenDocument,
  leesDocument,
  MAX_DOCUMENT_BYTES,
} from "../document";

/* ------------------------------------------------------------------ bouwstenen */

const alinea = (tekst: string, stijl?: string) =>
  `<w:p>${stijl ? `<w:pPr><w:pStyle w:val="${stijl}"/></w:pPr>` : ""}` +
  `<w:r><w:t>${tekst}</w:t></w:r></w:p>`;

const docxXml = (body: string) =>
  `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`;

/** Een echte DOCX: een ZIP met `word/document.xml` erin. */
async function maakDocx(body: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("word/document.xml", docxXml(body));
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "uint8array" });
}

const tekstBytes = (s: string) => new TextEncoder().encode(s);

/* ---------------------------------------------------------------------- tests */

describe("herkenDocument", () => {
  it("herkent een DOCX aan zijn bytes én zijn naam", async () => {
    const bytes = await maakDocx(alinea("Hallo"));
    expect(herkenDocument(bytes, "handboek.docx")).toBe("docx");
    // Dezelfde bytes zonder de juiste naam: elk ZIP-bestand begint met PK, dus de naam telt mee.
    expect(herkenDocument(bytes, "handboek.zip")).toBeNull();
  });

  it("herkent platte tekst en markdown", () => {
    expect(herkenDocument(tekstBytes("Hallo"), "notitie.txt")).toBe("tekst");
    expect(herkenDocument(tekstBytes("# Kop"), "notitie.md")).toBe("tekst");
  });

  it("weigert iets binairs dat zich voordoet als tekst", () => {
    // Een nulbyte komt in tekst niet voor. Zonder deze controle gaat een afbeelding met de naam
    // `handboek.txt` als bronmateriaal het model in.
    const nep = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]);
    expect(herkenDocument(nep, "handboek.txt")).toBeNull();
  });

  it("weigert PDF met zoveel woorden", async () => {
    const pdf = tekstBytes("%PDF-1.7\n...");
    const uit = await leesDocument(pdf, "handboek.pdf");
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.reden).toContain("PDF nog niet");
  });
});

describe("alineasUitXml", () => {
  it("haalt alinea's en hun koppen eruit", () => {
    const xml = docxXml(
      alinea("Melden van incidenten", "Heading1") +
        alinea("Elk incident wordt gemeld.") +
        alinea("Wanneer", "Heading2") +
        alinea("Binnen 24 uur."),
    );
    expect(alineasUitXml(xml)).toEqual([
      { tekst: "Melden van incidenten", niveau: 1 },
      { tekst: "Elk incident wordt gemeld." },
      { tekst: "Wanneer", niveau: 2 },
      { tekst: "Binnen 24 uur." },
    ]);
  });

  it("plakt een zin die door opmaak in stukken staat weer aan elkaar", () => {
    // Dit is de valkuil: Word splitst bij elk opmaakwissel. Met spaties ertussen krijg je
    // "Meld het direct ." in je bronmateriaal.
    const gesplitst =
      "<w:p><w:r><w:t>Meld het </w:t></w:r><w:r><w:t>direct</w:t></w:r>" +
      "<w:r><w:t>.</w:t></w:r></w:p>";
    expect(alineasUitXml(docxXml(gesplitst))).toEqual([{ tekst: "Meld het direct." }]);
  });

  it("herkent ook een Nederlands kopsjabloon", () => {
    expect(alineasUitXml(docxXml(alinea("Procedure", "Kop1")))).toEqual([
      { tekst: "Procedure", niveau: 1 },
    ]);
  });

  it("zet XML-entiteiten terug naar tekens", () => {
    expect(alineasUitXml(docxXml(alinea("Jan &amp; Piet &lt;dienst&gt;")))).toEqual([
      { tekst: "Jan & Piet <dienst>" },
    ]);
  });

  it("slaat lege alinea's over", () => {
    expect(alineasUitXml(docxXml(alinea("Een") + "<w:p></w:p>" + alinea("Twee")))).toHaveLength(2);
  });
});

describe("alineasUitTekst", () => {
  it("maakt van markdown-koppen kopniveaus", () => {
    expect(alineasUitTekst("# Handboek\n\nEerste alinea.\n\n## Melden\n\nBinnen 24 uur.")).toEqual([
      { tekst: "Handboek", niveau: 1 },
      { tekst: "Eerste alinea." },
      { tekst: "Melden", niveau: 2 },
      { tekst: "Binnen 24 uur." },
    ]);
  });

  it("houdt een kop los van de alinea die er direct onder staat", () => {
    // Dit ging mis bij een echt handboek. In markdown volgt de tekst meestal zonder witregel op
    // de kop; met blokken werd daar één alinea van, mét de #-tekens erin, en was de kop als
    // bronverwijzing verloren.
    expect(alineasUitTekst("## 1. Reikwijdte\nDit protocol geldt voor baliemedewerkers.")).toEqual([
      { tekst: "1. Reikwijdte", niveau: 2 },
      { tekst: "Dit protocol geldt voor baliemedewerkers." },
    ]);
  });

  it("plakt doorlopende regels binnen één alinea aan elkaar", () => {
    expect(alineasUitTekst("Een zin die over\ntwee regels loopt.")).toEqual([
      { tekst: "Een zin die over twee regels loopt." },
    ]);
  });
});

describe("alsBrontekst", () => {
  it("markeert koppen zodat het model ernaar kan verwijzen", () => {
    const uit = alsBrontekst([{ tekst: "Melden", niveau: 2 }, { tekst: "Binnen 24 uur." }]);
    expect(uit.tekst).toBe("## Melden\n\nBinnen 24 uur.");
    expect(uit.afgekapt).toBe(false);
  });

  it("kapt af op een alineagrens en zegt dat hij dat deed", () => {
    // Midden in een zin stoppen levert een bron op die iets anders lijkt te zeggen dan er staat.
    const lang = [{ tekst: "A".repeat(50) }, { tekst: "B".repeat(50) }, { tekst: "C".repeat(50) }];
    const uit = alsBrontekst(lang, 60);
    expect(uit.afgekapt).toBe(true);
    expect(uit.tekst).toBe("A".repeat(50));
    expect(uit.tekst).not.toContain("B");
  });
});

describe("leesDocument", () => {
  it("leest een echte DOCX van begin tot eind", async () => {
    const bytes = await maakDocx(
      alinea("Agressieprotocol", "Heading1") + alinea("Meld elk incident binnen 24 uur."),
    );
    const uit = await leesDocument(bytes, "protocol.docx");
    if (!uit.ok) throw new Error(uit.reden);
    expect(uit.inhoud.soort).toBe("docx");
    expect(uit.inhoud.alineas).toHaveLength(2);
    expect(uit.inhoud.tekst).toContain("# Agressieprotocol");
    expect(uit.inhoud.afgekapt).toBe(false);
  });

  it("weigert een ZIP die geen Word-document is", async () => {
    const zip = new JSZip();
    zip.file("iets-anders.txt", "hallo");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const uit = await leesDocument(bytes, "nep.docx");
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.reden).toContain("geen Word-document");
  });

  it("weigert een leeg bestand en een te groot bestand", async () => {
    expect((await leesDocument(new Uint8Array(0), "leeg.txt")).ok).toBe(false);
    const groot = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    groot.set(tekstBytes("# Kop"));
    const uit = await leesDocument(groot, "groot.txt");
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.reden).toContain("MB");
  });

  it("weigert een document waar wel bytes maar geen tekst in staat", async () => {
    const uit = await leesDocument(await maakDocx("<w:p></w:p>"), "leeg.docx");
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.reden).toContain("geen leesbare tekst");
  });
});
