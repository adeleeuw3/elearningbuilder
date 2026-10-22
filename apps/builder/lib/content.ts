/**
 * Pure bewerkingen op de gegenereerde content.
 *
 * Los van React omdat dit het deel is dat stil fout kan gaan: een blok dat op de verkeerde index
 * landt, of een `correct`-index die niet meer naar het juiste antwoord wijst nadat een optie is
 * verwijderd. Zie lib/__tests__/content.test.ts.
 */
import type { GeneratedContent, Sectie, Vraag } from "./types";

/** Vervangt één sectie op index. Onbekende index laat de content ongemoeid. */
export function vervangSectie(
  content: GeneratedContent,
  index: number,
  sectie: Sectie,
): GeneratedContent {
  if (index < 0 || index >= content.secties.length) return content;
  return {
    ...content,
    secties: content.secties.map((s, i) => (i === index ? sectie : s)),
  };
}

/** Vervangt één vraag op index. Onbekende index laat de content ongemoeid. */
export function vervangVraag(
  content: GeneratedContent,
  index: number,
  vraag: Vraag,
): GeneratedContent {
  if (index < 0 || index >= content.vragen.length) return content;
  return {
    ...content,
    vragen: content.vragen.map((v, i) => (i === index ? vraag : v)),
  };
}

/**
 * Wijzigt één optie van een vraag.
 *
 * `correct` blijft een index in `opties`, dus die verschuift niet — een tekst wijzigen verandert
 * niet welk antwoord juist is.
 */
export function wijzigOptie(vraag: Vraag, index: number, tekst: string): Vraag {
  if (index < 0 || index >= vraag.opties.length) return vraag;
  return { ...vraag, opties: vraag.opties.map((o, i) => (i === index ? tekst : o)) };
}

/**
 * Verwijdert een optie en houdt `correct` naar hetzelfde antwoord wijzen.
 *
 * Dit is de subtiele: verdwijnt een optie vóór het juiste antwoord, dan schuift de index één op.
 * Verdwijnt het juiste antwoord zelf, dan valt `correct` terug op 0 — er moet altijd een geldig
 * antwoord zijn, anders is de vraag stuk. Onder de twee opties verwijderen we niets: een vraag
 * met één optie is geen vraag.
 */
export function verwijderOptie(vraag: Vraag, index: number): Vraag {
  if (vraag.opties.length <= 2) return vraag;
  if (index < 0 || index >= vraag.opties.length) return vraag;

  const opties = vraag.opties.filter((_, i) => i !== index);
  let correct = vraag.correct;
  if (index === vraag.correct) correct = 0;
  else if (index < vraag.correct) correct = vraag.correct - 1;

  return { ...vraag, opties, correct: begrensCorrect(correct, opties.length) };
}

/** Voegt een lege optie toe, zodat de auteur die kan invullen. */
export function voegOptieToe(vraag: Vraag): Vraag {
  return { ...vraag, opties: [...vraag.opties, ""] };
}

/** Zet welk antwoord juist is. Buiten bereik wordt genegeerd. */
export function zetCorrect(vraag: Vraag, index: number): Vraag {
  if (index < 0 || index >= vraag.opties.length) return vraag;
  return { ...vraag, correct: index };
}

/** Houdt `correct` binnen de grenzen van `opties`. */
function begrensCorrect(correct: number, aantal: number): number {
  if (aantal === 0) return 0;
  return Math.min(Math.max(0, correct), aantal - 1);
}

/**
 * Repareert content die van buiten komt zodat de UI er altijd op kan vertrouwen.
 *
 * Structured outputs garandeert de vórm, niet dat `correct` binnen `opties` valt — dat is een
 * numerieke beperking en die ondersteunt JSON Schema hier niet. Een `correct` van 7 bij drie
 * opties zou anders een vraag zonder juist antwoord tonen.
 */
export function normaliseerContent(content: GeneratedContent): GeneratedContent {
  return {
    ...content,
    vragen: content.vragen.map((v) => ({
      ...v,
      correct: begrensCorrect(v.correct, v.opties.length),
    })),
  };
}

/** Koppen van de andere secties — context voor "Opnieuw" zodat het model niet herhaalt. */
export function andereKoppen(content: GeneratedContent, index: number): string[] {
  return content.secties.filter((_, i) => i !== index).map((s) => s.kop);
}

/** Vraagteksten van de andere vragen — zelfde doel. */
export function andereVragen(content: GeneratedContent, index: number): string[] {
  return content.vragen.filter((_, i) => i !== index).map((v) => v.vraag);
}

/**
 * Een lege module om zelf op te bouwen, zonder interview.
 *
 * Bewust geen verzonnen intro of samenvatting: die velden blijven leeg, zodat het statusbolletje
 * op de kaart en de controlelijst eerlijk melden dat er nog werk ligt. Wél een titel, want een
 * naamloze kop leest als een weergavefout. Heeft de auteur al een onderwerp getypt, dan is dat de
 * titel — dat zijn zijn eigen woorden en geen invulling van ons.
 */
export function legeContent(onderwerp?: string | null): GeneratedContent {
  const titel = (onderwerp ?? "").trim();
  return {
    titel: titel.length > 0 ? titel : "Naamloze module",
    intro: "",
    secties: [],
    vragen: [],
    samenvatting: "",
  };
}
