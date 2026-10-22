/**
 * Eenmalige migratie van het oude paginamodel naar het nieuwe.
 *
 * In het oude model was "Pagina" een knooptype: inhoudsblokken liepen een paginaknoop in, pagina's
 * liepen een cursusknoop in, en de volgorde zat in díe schakels. In het nieuwe model is een pagina
 * een keten van inhoudsblokken en zit de volgorde in de verticale positie op het canvas.
 *
 * Drie dingen moeten daarom mee, en alle drie zijn ze stil als je ze vergeet:
 *
 *   1. **De cursusvolgorde.** Die stond in pagina→pagina-schakels die nu verdwijnen. Zonder
 *      herplaatsing zou een bestaande module na het openen in een willekeurige volgorde staan —
 *      en dat is precies het soort verlies dat niemand meteen ziet.
 *   2. **De pagina-identiteit.** De seed van de oude paginaknoop wordt `paginaSeed` op de kop van
 *      de keten, zodat de IRI's in de export gelijk blijven en de historie in de LRS niet in tweeën
 *      valt.
 *   3. **De routes.** Een vertakking hing tussen pagina's; die schakels worden omgehangen naar de
 *      staart en de kop van de bijbehorende ketens.
 *
 * Daarnaast verdwijnen de knooptypes START (`intro`) en AFSLUITING (`samenvatting`). Dat waren
 * aparte soorten voor "de eerste" en "de laatste", terwijl de volgorde nu uit de canvaspositie
 * volgt. Ze worden gewone uitleg-blokken; titel, prompt en uitvoer blijven staan, en een markering
 * `bron` houdt vast welk contentveld ze tonen.
 *
 * De migratie is idempotent: een leerpad dat al om is komt er ongewijzigd uit.
 */
import {
  KANT_MARGE,
  KOLOM_AFSTAND,
  NIVEAU,
  type Knoop,
  type KnoopSoort,
  type Leerpad,
  type Verbinding,
} from "./graph";

/** Verticale afstand tussen twee pagina's. Ruim, zodat de scheiding tussen rijen leesbaar blijft. */
export const RIJ_HOOGTE = 260;

/**
 * Het leerpad zoals het op schijf kan staan.
 *
 * Losser getypeerd dan `Leerpad`: `soort` mag hier nog `"pagina"` of `"cursus"` zijn, want dat
 * staat in bestanden die vóór deze wijziging bewaard zijn.
 */
export interface OudLeerpad {
  knopen: (Omit<Knoop, "soort"> & { soort: string })[];
  verbindingen: Verbinding[];
}

const OUD = new Set(["pagina", "cursus"]);
/** Knooptypes die een gewoon uitleg-blok worden, met de markering die ze meekrijgen. */
const NAAR_UITLEG: Record<string, "intro" | "samenvatting"> = {
  intro: "intro",
  samenvatting: "samenvatting",
};
/**
 * Wat hier als inhoud telt.
 *
 * Afgeleid uit `NIVEAU` in plaats van overgetypt: een tweede lijst die met de eerste gelijk moet
 * blijven lopen doet dat een tijdje wel en dan niet meer, en de fout is stil — een nieuw
 * blokblok valt dan bij het migreren buiten de rijen en staat ineens los op het canvas. De twee
 * oude namen staan er los bij, want die bestaan niet meer als soort.
 */
const INHOUD = new Set<string>([
  "intro",
  "samenvatting",
  ...(Object.keys(NIVEAU) as KnoopSoort[]).filter((s) => NIVEAU[s] === "inhoud"),
]);

/** Heeft dit leerpad de migratie nog nodig? */
export function heeftOudModel(leerpad: OudLeerpad): boolean {
  return leerpad.knopen.some((k) => OUD.has(k.soort) || k.soort in NAAR_UITLEG);
}

/**
 * Zet een START- of AFSLUITING-knoop om naar een uitleg-blok.
 *
 * Titel, prompt en uitvoer blijven; alleen de soort verandert en er komt een markering bij die
 * vasthoudt welk contentveld het blok toont. Zonder die markering zou de kaart na de migratie naar
 * het verkeerde veld gaan schrijven — precies de fout die het lastigst te zien is, want de tekst
 * verdwijnt niet, hij komt ergens anders terecht.
 */
function alsUitleg<T extends { soort: string }>(knoop: T): T {
  const bron = NAAR_UITLEG[knoop.soort];
  return bron ? { ...knoop, soort: "uitleg", bron } : knoop;
}

/**
 * Zet een oud leerpad om naar het nieuwe model.
 *
 * Doet niets aan een leerpad dat al om is — zo kan deze functie zonder nadenken op elk geladen
 * project draaien.
 */
export function migreerLeerpad(oud: OudLeerpad): Leerpad {
  // Eerst de knooptypes. Dat is een omzetting per knoop en raakt de plaatsing niet — een leerpad
  // dat verder al om is mag daar niet alsnog door elkaar geschud worden.
  if (!heeftOudModel(oud)) return oud as Leerpad;
  const leerpad: OudLeerpad = { ...oud, knopen: oud.knopen.map(alsUitleg) };
  if (!leerpad.knopen.some((k) => OUD.has(k.soort))) return leerpad as Leerpad;

  const perId = new Map(leerpad.knopen.map((k) => [k.id, k]));
  const soortVan = (id: string) => perId.get(id)?.soort;
  const isInhoud = (id: string) => INHOUD.has(soortVan(id) ?? "");

  /** De inhoudsketen die deze pagina in loopt, van kop naar staart. */
  const ketenVan = (paginaId: string): string[] => {
    const omgekeerd: string[] = [];
    const bezocht = new Set<string>([paginaId]);
    let doel = paginaId;
    for (;;) {
      const vorige = leerpad.verbindingen.find((v) => v.naar === doel && isInhoud(v.van));
      if (!vorige || bezocht.has(vorige.van)) break;
      bezocht.add(vorige.van);
      omgekeerd.push(vorige.van);
      doel = vorige.van;
    }
    return omgekeerd.reverse();
  };

  const paginaIds = leerpad.knopen.filter((k) => k.soort === "pagina").map((k) => k.id);
  const keten = new Map(paginaIds.map((id) => [id, ketenVan(id)]));

  /* ------------------------------------------------- de oude cursusvolgorde */

  // Precies zoals het oude `cursusPad`: begin bij de pagina zonder structuurvoorganger en volg de
  // schakels. Takken uit een vertakking komen daarbij vanzelf op volgorde langs.
  const heeftVoorganger = new Set(
    leerpad.verbindingen
      .filter((v) => soortVan(v.van) === "pagina" || soortVan(v.van) === "vertakking")
      .map((v) => v.naar),
  );
  const start = paginaIds.find((id) => !heeftVoorganger.has(id));

  const volgorde: string[] = [];
  const gezien = new Set<string>();
  const loop = (id: string) => {
    if (gezien.has(id)) return;
    gezien.add(id);
    if (soortVan(id) === "pagina") volgorde.push(id);
    if (soortVan(id) === "cursus") return;
    for (const v of leerpad.verbindingen.filter((x) => x.van === id)) loop(v.naar);
  };
  if (start) loop(start);
  // Pagina's buiten het pad raken we niet kwijt; ze komen erachter, in documentvolgorde.
  for (const id of paginaIds) if (!volgorde.includes(id)) volgorde.push(id);

  /* -------------------------------------------------------------- de knopen */

  const inKeten = new Set(volgorde.flatMap((id) => keten.get(id) ?? []));
  // Inhoud die in het oude model in géén pagina uitkwam ("los") wordt nu vanzelf een eigen pagina.
  const losseKetens = leerpad.knopen
    .filter((k) => INHOUD.has(k.soort) && !inKeten.has(k.id))
    .map((k) => [k.id]);

  const rijen: string[][] = [
    ...volgorde.map((id) => keten.get(id) ?? []).filter((r) => r.length > 0),
    ...losseKetens,
  ];

  const plek = new Map<string, { x: number; y: number }>();
  rijen.forEach((rij, i) => {
    const y = KANT_MARGE + i * RIJ_HOOGTE;
    rij.forEach((id, j) => plek.set(id, { x: KANT_MARGE + j * KOLOM_AFSTAND, y }));
  });
  const onderkant = KANT_MARGE + rijen.length * RIJ_HOOGTE;

  /** De kop van de keten van deze pagina, of null als de pagina leeg was. */
  const kopVan = (paginaId: string) => keten.get(paginaId)?.[0] ?? null;
  const staartVan = (paginaId: string) => keten.get(paginaId)?.at(-1) ?? null;

  const identiteit = new Map<string, { seed: string; titel: string }>();
  for (const paginaId of volgorde) {
    const kop = kopVan(paginaId);
    const pagina = perId.get(paginaId);
    if (kop && pagina) identiteit.set(kop, { seed: pagina.seed, titel: pagina.titel });
  }

  const knopen: Knoop[] = [];
  let structuurKolom = 0;
  for (const k of leerpad.knopen) {
    if (OUD.has(k.soort)) continue;
    const basis = k as Knoop;
    const positie = plek.get(k.id);
    if (positie) {
      const eigen = identiteit.get(k.id);
      knopen.push({
        ...basis,
        ...positie,
        ...(eigen
          ? {
              paginaSeed: eigen.seed,
              // De titel van de oude paginaknoop wordt de overschreven paginatitel: die heeft de
              // auteur zelf gekozen, en die hoort niet te verdwijnen omdat het model verandert.
              ...(eigen.titel.trim() ? { paginaTitel: eigen.titel.trim() } : {}),
            }
          : {}),
      });
      continue;
    }
    // Secties, vertakkingen en AI-knopen: onder de rijen, zodat ze niets overlappen. Een sectie
    // die daar staat claimt niets meer — de auteur sleept hem boven de pagina's die erbij horen.
    knopen.push({
      ...basis,
      x: KANT_MARGE + structuurKolom * KOLOM_AFSTAND,
      y: onderkant,
    });
    structuurKolom += 1;
  }

  /* ----------------------------------------------------------- de schakels */

  const nieuweKnoopIds = new Set(knopen.map((k) => k.id));
  const verbindingen: Verbinding[] = [];
  const gebruikt = new Set<string>();

  for (const v of leerpad.verbindingen) {
    const vanSoort = soortVan(v.van);
    const naarSoort = soortVan(v.naar);

    // Alles wat in de cursusknoop uitkwam draagt geen betekenis meer.
    if (vanSoort === "cursus" || naarSoort === "cursus") continue;
    // Pagina→sectie en vertakking→sectie: sectielidmaatschap is nu positie, geen schakel.
    if (vanSoort === "sectie" || naarSoort === "sectie") continue;

    // Een vertakking hing tussen pagina's; hij hangt nu tussen ketens. Dit omhangen moet vóór de
    // regel die schakels naar een pagina weggooit — anders is er niets meer om om te hangen.
    let van = v.van;
    let naar = v.naar;
    if (vanSoort === "pagina" && naarSoort === "vertakking") {
      const staart = staartVan(v.van);
      if (!staart) continue;
      van = staart;
    } else if (vanSoort === "vertakking" && naarSoort === "pagina") {
      const kop = kopVan(v.naar);
      if (!kop) continue;
      naar = kop;
    } else if (vanSoort === "pagina" || naarSoort === "pagina") {
      // Wat overblijft is inhoud→pagina en pagina→pagina: lidmaatschap en volgorde, allebei nu
      // afgeleid uit respectievelijk de keten en de positie.
      continue;
    }

    if (!nieuweKnoopIds.has(van) || !nieuweKnoopIds.has(naar)) continue;
    if (van === naar) continue;
    // Na het omhangen kunnen er dubbelen ontstaan; die zouden de keten dubbel laten tellen.
    const sleutel = `${van}>${naar}`;
    if (gebruikt.has(sleutel)) continue;
    gebruikt.add(sleutel);
    verbindingen.push({ ...v, van, naar });
  }

  return { knopen, verbindingen };
}
