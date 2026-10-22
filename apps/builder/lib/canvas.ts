/**
 * Het canvas als ruimte: passend maken, ordenen, zoeken, en wat je mag verbinden.
 *
 * Puur en los van React. Dit is het deel dat stil fout gaat: een layout waarin twee kaarten op
 * elkaar liggen ziet er niet kapot uit, hij ziet er slordig uit — en dat merk je pas als je iets
 * kwijt bent.
 */
import {
  KANT_MARGE,
  KNOOP_BREEDTE,
  KOLOM_AFSTAND,
  RIJ_HOOGTE,
  RIJ_TUSSEN,
  type Knoop,
} from "./graph";
import { NIVEAU, type Leerpad } from "./graph";
import { paginasVan } from "./paginas";
import { verbindingsBezwaar } from "./leerpad";

/** Hoogte waarmee de layout rekent. De echte hoogte verschilt per soort en wordt pas gemeten. */
export const LAYOUT_HOOGTE = 210;

/* ---------------------------------------------------------------- pas op scherm */

export interface Kader {
  x: number;
  y: number;
  breedte: number;
  hoogte: number;
}

/** Het kleinste kader waar alle knopen in passen. `null` bij een leeg canvas. */
export function omvattendKader(knopen: Knoop[], knoopHoogte = LAYOUT_HOOGTE): Kader | null {
  if (knopen.length === 0) return null;
  let links = Infinity;
  let boven = Infinity;
  let rechts = -Infinity;
  let onder = -Infinity;
  for (const k of knopen) {
    links = Math.min(links, k.x);
    boven = Math.min(boven, k.y);
    rechts = Math.max(rechts, k.x + KNOOP_BREEDTE);
    onder = Math.max(onder, k.y + knoopHoogte);
  }
  return { x: links, y: boven, breedte: rechts - links, hoogte: onder - boven };
}

/** De grenzen waarbinnen de zoomfactor mag vallen. Buiten dit bereik is het canvas onbruikbaar. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

export interface Passend {
  zoom: number;
  /** Waar het canvasvak heen moet scrollen, in schermpixels. */
  scrollX: number;
  scrollY: number;
}

/**
 * De zoom en scrollpositie waarbij alles in beeld staat.
 *
 * Met wat lucht eromheen: precies passend betekent kaarten die de rand raken, en dan lijkt het
 * alsof er nog iets buiten staat. Bij één knoop niet inzoomen tot 200% — dan vult één kaart het
 * scherm en ben je de context kwijt; vandaar de begrenzing op 1.
 */
export function passendOpScherm(
  knopen: Knoop[],
  vak: { breedte: number; hoogte: number },
  knoopHoogte = LAYOUT_HOOGTE,
  lucht = 48,
): Passend | null {
  const kader = omvattendKader(knopen, knoopHoogte);
  if (!kader || vak.breedte <= 0 || vak.hoogte <= 0) return null;

  const ruw = Math.min(
    (vak.breedte - lucht * 2) / kader.breedte,
    (vak.hoogte - lucht * 2) / kader.hoogte,
  );
  const zoom = Math.max(MIN_ZOOM, Math.min(1, ruw));

  // Het midden van het kader in het midden van het vak.
  const middenX = (kader.x + kader.breedte / 2) * zoom;
  const middenY = (kader.y + kader.hoogte / 2) * zoom;
  return {
    zoom,
    scrollX: Math.max(0, middenX - vak.breedte / 2),
    scrollY: Math.max(0, middenY - vak.hoogte / 2),
  };
}

/** Waar het vak heen moet om deze knoop in beeld te brengen, met hem in het midden. */
export function scrollNaarKnoop(
  knoop: Knoop,
  vak: { breedte: number; hoogte: number },
  zoom: number,
  knoopHoogte = LAYOUT_HOOGTE,
): { scrollX: number; scrollY: number } {
  const midX = (knoop.x + KNOOP_BREEDTE / 2) * zoom;
  const midY = (knoop.y + knoopHoogte / 2) * zoom;
  return {
    scrollX: Math.max(0, midX - vak.breedte / 2),
    scrollY: Math.max(0, midY - vak.hoogte / 2),
  };
}

/* --------------------------------------------------------------------- ordenen */

/**
 * Eén rij op het canvas.
 *
 * Een pagina *is* een rij: haar onderdelen staan op één y-baan, van links naar rechts in
 * linkvolgorde. Een sectie krijgt zijn eigen rij als kop erboven. Wat overblijft (AI-knopen) zakt
 * naar een rij onderaan — dat is gereedschap van de auteur en hoort niet in de leesrichting.
 */
export interface Rij {
  /** De kop van de pagina die op deze rij staat; `null` voor een sectiekop of de restrij. */
  paginaKop: string | null;
  ids: string[];
  y: number;
  /** De hoogte van deze baan: minstens `RIJ_HOOGTE`, meer als er een hoge kaart in staat. */
  hoogte: number;
}

/**
 * Deelt het canvas in rijen in.
 *
 * De volgorde van de pagina's komt uit `paginasVan`, en die leest de huidige y-posities. Deze
 * functie schrijft ze daarna terug op het raster. Dat is met opzet **normaliseren** en niet
 * toewijzen: zou de layout de volgorde bepalen én de y schrijven, dan bijten die twee elkaar en is
 * niet meer te zeggen wat de bron is. Nu blijft y de enige bron, en verandert een sleepbeweging de
 * volgorde vanzelf bij de volgende layout.
 */
export function rijenVan(
  leerpad: Leerpad,
  hoogtes: Record<string, number> = {},
  knoopHoogte = LAYOUT_HOOGTE,
): Rij[] {
  const hoogteVan = (id: string) => Math.max(hoogtes[id] ?? knoopHoogte, 60);
  const paginas = paginasVan(leerpad);

  // Een vertakking hangt achter de staart van een keten; door hem áán die rij te plakken blijft de
  // schakel ernaartoe kort en horizontaal, precies zoals de schakels binnen de rij.
  const vertakkingAchter = new Map<string, string[]>();
  for (const v of leerpad.verbindingen) {
    const bron = leerpad.knopen.find((k) => k.id === v.van);
    const doel = leerpad.knopen.find((k) => k.id === v.naar);
    if (!bron || !doel || doel.soort !== "vertakking") continue;
    if (NIVEAU[bron.soort] !== "inhoud") continue;
    vertakkingAchter.set(bron.id, [...(vertakkingAchter.get(bron.id) ?? []), doel.id]);
  }

  const secties = leerpad.knopen
    .filter((k) => k.soort === "sectie")
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const geplaatst = new Set<string>();
  const rijen: Rij[] = [];
  let y = KANT_MARGE;

  const legRij = (paginaKop: string | null, ids: string[]) => {
    if (ids.length === 0) return;
    for (const id of ids) geplaatst.add(id);
    const hoogte = Math.max(
      RIJ_HOOGTE,
      ids.reduce((max, id) => Math.max(max, hoogteVan(id)), 0) + RIJ_TUSSEN,
    );
    rijen.push({ paginaKop, ids, y, hoogte });
    y += hoogte;
  };

  let volgendeSectie = 0;
  for (const pagina of paginas) {
    while (volgendeSectie < secties.length && secties[volgendeSectie]!.y <= pagina.kop.y) {
      legRij(null, [secties[volgendeSectie]!.id]);
      volgendeSectie += 1;
    }
    const ids = pagina.onderdelen.flatMap((k) => [k.id, ...(vertakkingAchter.get(k.id) ?? [])]);
    legRij(pagina.kop.id, ids);
  }
  for (; volgendeSectie < secties.length; volgendeSectie += 1) {
    legRij(null, [secties[volgendeSectie]!.id]);
  }

  // Wat nergens bij hoort: AI-knopen, en vertakkingen die (nog) aan geen keten hangen.
  legRij(
    null,
    leerpad.knopen.filter((k) => !geplaatst.has(k.id)).map((k) => k.id),
  );
  return rijen;
}

/**
 * Legt alle knopen op het rijraster.
 *
 * Dit is de enige plek die `x` en `y` schrijft. Draait na elke structuurwijziging, zodat het canvas
 * altijd leesbaar is: links naar rechts is de volgorde binnen een pagina, boven naar onder is de
 * volgorde van de cursus. Overlap is daarmee niet afgevangen maar onmogelijk.
 */
export function rijLayout(
  leerpad: Leerpad,
  hoogtes: Record<string, number> = {},
  knoopHoogte = LAYOUT_HOOGTE,
): Knoop[] {
  const plek = new Map<string, { x: number; y: number }>();
  for (const rij of rijenVan(leerpad, hoogtes, knoopHoogte)) {
    rij.ids.forEach((id, i) => plek.set(id, { x: KANT_MARGE + i * KOLOM_AFSTAND, y: rij.y }));
  }
  return leerpad.knopen.map((k) => ({ ...k, ...(plek.get(k.id) ?? { x: k.x, y: k.y }) }));
}

/** Het leerpad met de knopen op het raster. */
export function metLayout(
  leerpad: Leerpad,
  hoogtes: Record<string, number> = {},
): Leerpad {
  return { ...leerpad, knopen: rijLayout(leerpad, hoogtes) };
}

/**
 * De y waarop een nieuw blok neergezet wordt: onder de laagste rij.
 *
 * Een nieuw blok is een nieuwe pagina, en pagina's staan op volgorde van boven naar onder. Onderaan
 * betekent dus "achteraan in de cursus" — de enige plek waar hij niets van wat er al staat verstoort.
 */
export function onderRijen(leerpad: Leerpad, hoogtes: Record<string, number> = {}): number {
  const rijen = rijenVan(leerpad, hoogtes);
  const laatste = rijen[rijen.length - 1];
  return laatste ? laatste.y + laatste.hoogte : KANT_MARGE;
}

/* --------------------------------------------------------------------- snappen */

/** Hoe dicht een blok bij een baan moet komen voordat hij eraan vastklikt, in canvaspixels. */
export const SNAP_AFSTAND = 14;

export interface SnapUitkomst {
  x: number;
  y: number;
  /** De baan waar hij aan vastklikte, om een hulplijn te tekenen. `null` = niet gesnapt. */
  hulplijnX: number | null;
  hulplijnY: number | null;
}

/**
 * Klikt een gesleept blok vast op de banen van de andere blokken.
 *
 * Dit is het hulpmiddel dat het raster oplevert zonder het af te dwingen: kolommen en rijen lijnen
 * vanzelf uit omdat je er tegenaan komt, niet omdat het moet. De hulplijn is er niet als versiering
 * maar als bewijs — zonder zichtbare lijn weet de auteur niet óf hij gesnapt heeft, en dan lijkt
 * een uitlijning die net niet klopt precies op een die wel klopt.
 *
 * De linkermarge telt als baan mee, zodat de eerste kolom van een nieuwe rij vanzelf op één lijn
 * komt met de eerste kolom van de rest.
 */
export function snapPositie(
  knopen: Knoop[],
  id: string,
  x: number,
  y: number,
  drempel = SNAP_AFSTAND,
): SnapUitkomst {
  const anderen = knopen.filter((k) => k.id !== id);
  const dichtstbij = (waarde: number, banen: number[]): number | null => {
    let beste: number | null = null;
    let afstand = drempel;
    for (const baan of banen) {
      const d = Math.abs(baan - waarde);
      if (d <= afstand) {
        afstand = d;
        beste = baan;
      }
    }
    return beste;
  };

  const xBaan = dichtstbij(x, [KANT_MARGE, ...anderen.map((k) => k.x)]);
  const yBaan = dichtstbij(y, [KANT_MARGE, ...anderen.map((k) => k.y)]);
  return {
    x: xBaan ?? x,
    y: yBaan ?? y,
    hulplijnX: xBaan,
    hulplijnY: yBaan,
  };
}

/* ------------------------------------------------------------------ overlappen */

/** Overlappen deze twee kaarten elkaar? Met de gemeten hoogte, want die verschilt per bloktype. */
export function overlapt(
  a: { x: number; y: number; hoogte: number },
  b: { x: number; y: number; hoogte: number },
): boolean {
  return (
    a.x < b.x + KNOOP_BREEDTE &&
    b.x < a.x + KNOOP_BREEDTE &&
    a.y < b.y + b.hoogte &&
    b.y < a.y + a.hoogte
  );
}

/**
 * De eerstvolgende vrije plek vanaf `x`,`y`, naar rechts.
 *
 * Twee kaarten op elkaar zien er niet kapot uit, ze zien er slordig uit — en de onderste is
 * onvindbaar. Vandaar dat een drop op een bezette plek opschuift in plaats van te stapelen. Naar
 * rechts en niet naar beneden, want naar beneden zou de rijvolgorde veranderen en dus de cursus
 * herordenen; dat is niet wat iemand bedoelt als hij een blok neerzet.
 */
export function vrijePositie(
  knopen: Knoop[],
  id: string,
  x: number,
  y: number,
  hoogtes: Record<string, number> = {},
  knoopHoogte = LAYOUT_HOOGTE,
): { x: number; y: number } {
  const hoogteVan = (k: string) => Math.max(hoogtes[k] ?? knoopHoogte, 60);
  const anderen = knopen.filter((k) => k.id !== id);
  const mij = hoogteVan(id);
  let plek = { x, y };
  // Begrensd: bij een vol canvas moet dit stoppen in plaats van door te lopen.
  for (let poging = 0; poging < 200; poging += 1) {
    const botsing = anderen.find((k) =>
      overlapt({ ...plek, hoogte: mij }, { x: k.x, y: k.y, hoogte: hoogteVan(k.id) }),
    );
    if (!botsing) return plek;
    plek = { x: botsing.x + KOLOM_AFSTAND, y: plek.y };
  }
  return plek;
}

/* --------------------------------------------------------------- in een rij */

/**
 * Zet een blok op de eerstvolgende kolompositie van de pagina waar het in loopt.
 *
 * Draait wanneer een blok via een schakel aan een pagina wordt gehangen: dan hoort het meteen op
 * zijn plek in de rij te staan, en niet daar waar het toevallig lag. Rekent vanaf de kop, niet
 * vanaf de linkermarge — een rij die de auteur opzij heeft getrokken blijft dan staan waar hij hem
 * heeft neergelegd.
 */
export function schuifInRij(leerpad: Leerpad, blokId: string): Leerpad {
  const pagina = paginasVan(leerpad).find((p) => p.onderdelen.some((k) => k.id === blokId));
  if (!pagina) return leerpad;
  const index = pagina.onderdelen.findIndex((k) => k.id === blokId);
  if (index <= 0) return leerpad;
  const doel = {
    x: pagina.kop.x + index * KOLOM_AFSTAND,
    y: pagina.kop.y,
  };
  return {
    ...leerpad,
    knopen: leerpad.knopen.map((k) => (k.id === blokId ? { ...k, ...doel } : k)),
  };
}

/* ---------------------------------------------------------------------- zoeken */

export interface Treffer {
  knoop: Knoop;
  /** Waar de term gevonden is, om in de lijst te tonen. */
  waar: "titel" | "tekst" | "opdracht";
}

/**
 * Zoekt op titel, toelichting en opdracht.
 *
 * Titeltreffers eerst: wie zoekt heeft meestal een naam in zijn hoofd. Hoofdletterongevoelig, want
 * niemand onthoudt hoe hij het schreef.
 */
export function zoekKnopen(knopen: Knoop[], term: string, max = 8): Treffer[] {
  const t = term.trim().toLowerCase();
  if (t.length === 0) return [];
  const treffers: Treffer[] = [];
  for (const k of knopen) {
    if (k.titel.toLowerCase().includes(t)) treffers.push({ knoop: k, waar: "titel" });
    else if ((k.fragment ?? "").toLowerCase().includes(t)) treffers.push({ knoop: k, waar: "tekst" });
    else if ((k.uitvoer ?? "").toLowerCase().includes(t)) treffers.push({ knoop: k, waar: "tekst" });
    else if ((k.prompt ?? "").toLowerCase().includes(t)) treffers.push({ knoop: k, waar: "opdracht" });
  }
  const rang = { titel: 0, tekst: 1, opdracht: 2 } as const;
  return treffers.sort((a, b) => rang[a.waar] - rang[b.waar]).slice(0, max);
}

/* --------------------------------------------------------------- meer selecteren */

/** Shift-klik: erbij of eraf. Gewone klik: alleen deze. */
export function wisselSelectie(selectie: string[], id: string, bij: boolean): string[] {
  if (!bij) return [id];
  return selectie.includes(id) ? selectie.filter((x) => x !== id) : [...selectie, id];
}

/**
 * Verplaatst een groep knopen met dezelfde verschuiving.
 *
 * De verschuiving wordt eerst begrensd op de groep als geheel, en daarna pas toegepast. Zou elke
 * knoop apart geklemd worden, dan schuift de groep uit elkaar zodra één knoop de rand raakt.
 */
export function verplaatsGroep(
  knopen: Knoop[],
  ids: string[],
  dx: number,
  dy: number,
  grens: { breedte: number; hoogte: number },
  knoopHoogte = LAYOUT_HOOGTE,
): Knoop[] {
  const set = new Set(ids);
  const groep = knopen.filter((k) => set.has(k.id));
  if (groep.length === 0) return knopen;

  const minX = Math.min(...groep.map((k) => k.x));
  const minY = Math.min(...groep.map((k) => k.y));
  const maxX = Math.max(...groep.map((k) => k.x + KNOOP_BREEDTE));
  const maxY = Math.max(...groep.map((k) => k.y + knoopHoogte));

  const echteDx = Math.max(-minX, Math.min(dx, grens.breedte - maxX));
  const echteDy = Math.max(-minY, Math.min(dy, grens.hoogte - maxY));

  return knopen.map((k) =>
    set.has(k.id) ? { ...k, x: k.x + echteDx, y: k.y + echteDy } : k,
  );
}

/* ------------------------------------------------------------ geldige doelen */

/**
 * Waar deze knoop naartoe mag.
 *
 * Bestond al als `magVerbinden`, maar alleen achteraf: je hoorde pas ná het loslaten dat het niet
 * mocht. Met deze verzameling kan het canvas de geldige doelen oplichten terwijl je sleept, en dan
 * hoef je de regels niet te leren door afgewezen te worden.
 *
 * Een lus valt hier ook af: die zou een pad zonder einde beschrijven en wordt door `verbindKnopen`
 * toch geweigerd, dus hem oplichten zou liegen.
 */
export function geldigeDoelen(leerpad: Leerpad, vanId: string): Set<string> {
  const van = leerpad.knopen.find((k) => k.id === vanId);
  if (!van) return new Set();
  const uit = new Set<string>();
  for (const naar of leerpad.knopen) {
    if (naar.id === vanId) continue;
    // Hetzelfde oordeel als de hint bij de cursor. Twee lijsten die gelijk moeten blijven lopen
    // uiteen, en dan licht het canvas een doel op dat vervolgens geweigerd wordt.
    if (verbindingsBezwaar(van, naar, leerpad)) continue;
    if (leerpad.verbindingen.some((v) => v.van === vanId && v.naar === naar.id)) continue;
    uit.add(naar.id);
  }
  return uit;
}

/** Hoeveel knopen er per niveau zijn — voor de melding onder het canvas. */
export function telPerNiveau(knopen: Knoop[]): Record<string, number> {
  const uit: Record<string, number> = {};
  for (const k of knopen) {
    const n = NIVEAU[k.soort];
    uit[n] = (uit[n] ?? 0) + 1;
  }
  return uit;
}
