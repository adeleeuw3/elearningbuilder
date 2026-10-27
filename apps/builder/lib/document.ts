/**
 * Tekst uit een aangeleverd document halen, met zijn koppen.
 *
 * **Waarom dit bestaat.** Een gegenereerde module is generiek: het model weet alles van het vak en
 * niets van jullie procedure. De grootste kwaliteitssprong voor een L&D-afdeling is dat de module
 * klopt met *hun* handboek — en dan moet dat handboek erin.
 *
 * **Waarom de koppen meekomen.** Een module die zich op een bron baseert moet navolgbaar zijn,
 * anders is "het staat in het handboek" een bewering die niemand kan controleren. Door de koppen
 * mee te nemen kan het model per sectie zeggen wáár het vandaan komt, en kan een auteur dat
 * nakijken. Zonder die verwijzing is grondmateriaal alleen een duurdere manier om te verzinnen.
 *
 * **Wat hier niet in zit: PDF.** Dat is een binair formaat met gecomprimeerde streams, eigen
 * lettertype-coderingen en tekst die in willekeurige volgorde op de pagina staat. Met de hand
 * uitlezen levert voor een eenvoudig document bruikbare tekst op en voor een ingewikkeld document
 * stilletjes onzin — en onzin als bron is erger dan geen bron, want het model bouwt er een
 * geloofwaardige module omheen. Dat vraagt een bibliotheek, en dat is een beslissing over de build.
 *
 * Puur en los van React: dit is bij uitstek het deel dat stil fout gaat. Een verkeerd gelezen
 * lengte of een gemiste tag levert geen foutmelding op maar een half document.
 */
import JSZip from "jszip";

/** Hoe groot een aangeleverd document mag zijn. Een handboek is tekst, geen archief. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * Hoeveel tekst we eruit meenemen.
 *
 * Niet omdat meer niet kan, maar omdat alles wat hier binnenkomt bij elke generatie meegaat naar
 * het model. Een handboek van driehonderd pagina's maakt elke aanroep traag en duur, terwijl de
 * eerste tientallen pagina's meestal de kern dragen. Wordt er afgekapt, dan zegt de app dat —
 * stilletjes de helft weglaten is precies hoe een module ontstaat die een hoofdstuk mist.
 */
export const MAX_TEKEN = 120_000;

export type Documentsoort = "docx" | "tekst";

/** Eén alinea uit het document, met zijn kopniveau als het er een is. */
export interface Alinea {
  tekst: string;
  /** 1 = hoofdstuktitel, 2 = paragraaf, enzovoort. Afwezig bij gewone tekst. */
  niveau?: number;
}

export interface Documentinhoud {
  soort: Documentsoort;
  alineas: Alinea[];
  /** De tekst zoals hij naar het model gaat, koppen gemarkeerd met `#`. */
  tekst: string;
  /** Is er afgekapt? Dan hoort de auteur dat te weten. */
  afgekapt: boolean;
}

/** Wat het is, afgaand op de eerste bytes en niet op de bestandsnaam. */
export function herkenDocument(bytes: Uint8Array, naam: string): Documentsoort | null {
  // DOCX is een ZIP. De naam telt mee omdat élk ZIP-bestand hiermee begint; de inhoud bepaalt
  // daarna of het er echt een is (`word/document.xml` moet erin zitten).
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && /\.docx$/i.test(naam)) return "docx";
  if (/\.(txt|md|markdown)$/i.test(naam) && !lijktBinair(bytes)) return "tekst";
  return null;
}

/** Zitten er bytes in die in tekst niet voorkomen? Dan is het geen platte tekst. */
function lijktBinair(bytes: Uint8Array): boolean {
  const kijk = bytes.slice(0, 1024);
  for (const b of kijk) {
    // Nulbyte of een stuurteken dat geen tab, newline of carriage return is.
    if (b === 0) return true;
    if (b < 9 || (b > 13 && b < 32)) return true;
  }
  return false;
}

/** XML-entiteiten terug naar tekens. Alleen de vijf die in een DOCX voorkomen. */
function ontXml(tekst: string): string {
  return tekst
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * De alinea's uit de XML van een DOCX.
 *
 * Een Word-document is een reeks `<w:p>`-alinea's. Daarbinnen staat de tekst in `<w:t>`-stukjes
 * die door opmaak uit elkaar getrokken zijn: één zin kan over vijf `<w:t>`-tags verdeeld staan
 * omdat er een vetgedrukt woord in zit. Die horen dus aan elkaar, niet met spaties ertussen.
 *
 * Het kopniveau staat in `<w:pStyle w:val="Heading2"/>` binnen de alinea-eigenschappen. Word
 * schrijft dat in het Engels, ook in een Nederlandse installatie; een Nederlands sjabloon kan
 * daarnaast "Kop2" gebruiken, dus beide worden herkend.
 */
export function alineasUitXml(xml: string): Alinea[] {
  const alineas: Alinea[] = [];
  // Niet met een XML-parser: we willen alleen de twee dingen hierboven, en een parser erbij halen
  // voor twee tags is een afhankelijkheid die zijn gewicht niet waard is.
  const perAlinea = xml.split(/<w:p[ >]/).slice(1);

  for (const stuk of perAlinea) {
    const eind = stuk.indexOf("</w:p>");
    const body = eind >= 0 ? stuk.slice(0, eind) : stuk;

    const stijl = /<w:pStyle[^>]*w:val="(?:Heading|Kop)\s?(\d)"/i.exec(body);
    const niveau = stijl ? Number(stijl[1]) : undefined;

    let tekst = "";
    for (const m of body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
      tekst += ontXml(m[1] ?? "");
    }
    // Tabs en harde regelafbrekingen binnen een alinea.
    tekst = tekst.replace(/\s+/g, " ").trim();
    if (!tekst) continue;

    alineas.push(niveau ? { tekst, niveau } : { tekst });
  }

  return alineas;
}

/**
 * Platte tekst of Markdown naar alinea's; `#`-koppen worden kopniveaus.
 *
 * Regel voor regel, en niet per blok tussen witregels. In markdown volgt de tekst meestal direct
 * ónder een kop zonder lege regel ertussen; met blokken werd daar één alinea van, mét de
 * `#`-tekens er nog in, en was de kop als bronverwijzing verloren. Dat gebeurde meteen bij het
 * eerste echte handboek dat ik erdoorheen haalde.
 */
export function alineasUitTekst(ruw: string): Alinea[] {
  const alineas: Alinea[] = [];
  let lopend: string[] = [];

  const sluit = () => {
    const tekst = lopend.join(" ").replace(/\s+/g, " ").trim();
    if (tekst) alineas.push({ tekst });
    lopend = [];
  };

  for (const regel of ruw.split(/\r?\n/)) {
    const kop = /^\s*(#{1,6})\s+(.+?)\s*$/.exec(regel);
    if (kop) {
      sluit();
      alineas.push({ tekst: kop[2]!, niveau: kop[1]!.length });
      continue;
    }
    if (regel.trim() === "") {
      sluit();
      continue;
    }
    lopend.push(regel.trim());
  }
  sluit();

  return alineas;
}

/**
 * De alinea's als één tekst voor het model, met de koppen herkenbaar.
 *
 * Markdown-koppen, zodat het model ziet wat een hoofdstuktitel is en er per sectie naar kan
 * verwijzen. Wordt de limiet geraakt, dan kapt hij af op een alineagrens — midden in een zin
 * stoppen levert een bron op die iets anders lijkt te zeggen dan er staat.
 */
export function alsBrontekst(alineas: Alinea[], maxTeken = MAX_TEKEN): {
  tekst: string;
  afgekapt: boolean;
} {
  const regels: string[] = [];
  let lengte = 0;
  let afgekapt = false;

  for (const a of alineas) {
    const regel = a.niveau ? `${"#".repeat(a.niveau)} ${a.tekst}` : a.tekst;
    if (lengte + regel.length + 2 > maxTeken) {
      afgekapt = true;
      break;
    }
    regels.push(regel);
    lengte += regel.length + 2;
  }

  return { tekst: regels.join("\n\n"), afgekapt };
}

export type Uitkomst =
  | { ok: true; inhoud: Documentinhoud }
  | { ok: false; reden: string };

/** Het document uitlezen. Weigert met een reden die een auteur verder helpt. */
export async function leesDocument(
  bytes: Uint8Array,
  naam: string,
  maxTeken = MAX_TEKEN,
): Promise<Uitkomst> {
  if (bytes.byteLength === 0) return { ok: false, reden: "Dit bestand is leeg." };
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      reden: `Dit bestand is groter dan ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
    };
  }

  const soort = herkenDocument(bytes, naam);
  if (!soort) {
    return {
      ok: false,
      reden:
        "Alleen Word (.docx), platte tekst (.txt) en Markdown (.md) worden gelezen. " +
        "PDF nog niet — sla hem op als Word of plak de tekst.",
    };
  }

  let alineas: Alinea[];
  if (soort === "tekst") {
    alineas = alineasUitTekst(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  } else {
    let xml: string;
    try {
      const zip = await JSZip.loadAsync(bytes);
      const deel = zip.file("word/document.xml");
      if (!deel) {
        return { ok: false, reden: "Dit lijkt een ZIP, maar geen Word-document." };
      }
      xml = await deel.async("string");
    } catch {
      return { ok: false, reden: "Dit Word-document kon niet geopend worden." };
    }
    alineas = alineasUitXml(xml);
  }

  if (alineas.length === 0) {
    return { ok: false, reden: "Er staat geen leesbare tekst in dit document." };
  }

  const { tekst, afgekapt } = alsBrontekst(alineas, maxTeken);
  return { ok: true, inhoud: { soort, alineas, tekst, afgekapt } };
}
