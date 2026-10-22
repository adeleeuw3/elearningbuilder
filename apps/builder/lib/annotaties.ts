/**
 * Vrije tekeningen en handmatige verbindingen op het canvas.
 *
 * Pure logica, want hier zit de val: bij een andere zoomfactor moet een pointerpositie eerst
 * terug naar canvascoördinaten voordat je hem opslaat. Vergeet je dat, dan tekent de stift naast
 * de cursor en verschuiven bestaande streken zodra je zoomt — zonder dat iets faalt.
 */

export interface Punt {
  x: number;
  y: number;
}

export interface Streek {
  id: string;
  punten: Punt[];
}

/** Handmatig gelegde verbinding tussen twee knopen. */
export interface EigenVerbinding {
  id: string;
  van: string;
  naar: string;
}

/**
 * Zet een pointerpositie om naar canvascoördinaten.
 *
 * `rect` is de begrenzing van het geschaalde canvas op het scherm; `zoom` de factor waarmee het
 * getransformeerd is. Delen door de zoom is de hele truc: zonder dat staat alles wat je op 150%
 * tekent op twee derde van de plek waar je klikte.
 */
export function naarCanvas(
  client: Punt,
  rect: { left: number; top: number },
  zoom: number,
): Punt {
  const factor = zoom > 0 ? zoom : 1;
  return { x: (client.x - rect.left) / factor, y: (client.y - rect.top) / factor };
}

/** Begint een nieuwe streek op dit punt. */
export function startStreek(id: string, punt: Punt): Streek {
  return { id, punten: [punt] };
}

/**
 * Voegt een punt toe, maar slaat punten over die te dicht op het vorige liggen.
 *
 * Zonder die drempel groeit een streek naar duizenden punten bij één haal, wat het hertekenen
 * merkbaar traag maakt zonder dat de lijn er beter uitziet.
 */
export const MIN_PUNT_AFSTAND = 2;

export function vulAan(streek: Streek, punt: Punt): Streek {
  const laatste = streek.punten[streek.punten.length - 1];
  if (laatste) {
    const dx = punt.x - laatste.x;
    const dy = punt.y - laatste.y;
    if (Math.hypot(dx, dy) < MIN_PUNT_AFSTAND) return streek;
  }
  return { ...streek, punten: [...streek.punten, punt] };
}

/** Een streek van één punt is geen lijn — die gooien we weg. */
export function isBruikbaar(streek: Streek): boolean {
  return streek.punten.length >= 2;
}

/** SVG-pad voor een streek. Vloeiend genoeg zonder curve-berekening. */
export function streekPad(streek: Streek): string {
  if (streek.punten.length === 0) return "";
  const [eerste, ...rest] = streek.punten;
  return [
    `M${eerste!.x.toFixed(1)} ${eerste!.y.toFixed(1)}`,
    ...rest.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
  ].join(" ");
}

/** Ligt dit punt op of vlak bij de streek? Voor de gum. */
export function raaktStreek(streek: Streek, punt: Punt, marge = 8): boolean {
  return streek.punten.some((p) => Math.hypot(p.x - punt.x, p.y - punt.y) <= marge);
}

/**
 * Voegt een handmatige verbinding toe.
 *
 * Weigert een knoop aan zichzelf (dat tekent een lus die nergens heen gaat) en weigert een
 * duplicaat in dezelfde richting — twee identieke lijnen zien er kapot uit.
 */
export function voegVerbindingToe(
  bestaand: EigenVerbinding[],
  id: string,
  van: string,
  naar: string,
): EigenVerbinding[] {
  if (van === naar) return bestaand;
  if (bestaand.some((v) => v.van === van && v.naar === naar)) return bestaand;
  return [...bestaand, { id, van, naar }];
}

export function verwijderVerbinding(
  bestaand: EigenVerbinding[],
  id: string,
): EigenVerbinding[] {
  return bestaand.filter((v) => v.id !== id);
}

export function verwijderStreek(bestaand: Streek[], id: string): Streek[] {
  return bestaand.filter((s) => s.id !== id);
}

/**
 * Volgend id voor een streek of eigen verbinding, afgeleid van wat er al ligt.
 *
 * Waarom niet een oplopende teller in het whiteboard: dat component wordt ontkoppeld als je naar
 * de blokkenweergave wisselt, dus de teller begint daarna weer op 0 en deelt ids uit die al
 * bestaan. Twee paden met dezelfde React-key betekent dat er één van verdwijnt.
 */
export function volgendAnnotatieId(
  streken: Streek[],
  verbindingen: EigenVerbinding[],
): string {
  const hoogste = [...streken, ...verbindingen].reduce((max, a) => {
    const n = Number(a.id.slice(1));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `a${hoogste + 1}`;
}
