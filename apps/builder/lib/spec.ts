/**
 * Pure logica van de interview-lus: hoe een antwoord de moduleSpec verandert, welke velden nog
 * ontbreken, en wat de voortgangspips moeten laten zien.
 *
 * Dit staat los van React omdat het het deel is dat stil fout kan gaan — een antwoord dat het
 * verkeerde veld overschrijft, of leerdoelen die bij een verdiepingsvraag verdwijnen. Zie
 * lib/__tests__/spec.test.ts.
 */
import {
  ARRAY_VELDEN,
  DEFAULT_LENGTE,
  DEFAULT_TOON,
  UITVRAAGVELDEN,
  VERPLICHTE_VELDEN,
  type CompleteModuleSpec,
  type InvoerType,
  type ModuleSpec,
  type ModuleSpecVeld,
  type Uitvraagveld,
  type VerplichtVeld,
} from "./types";

/** Menselijke labels voor de pips en de "wat wil je aanpassen?"-keuze. */
export const VELD_LABEL: Record<ModuleSpecVeld, string> = {
  onderwerp: "Onderwerp",
  doelgroep: "Doelgroep",
  leerdoelen: "Leerdoelen",
  vraagvormen: "Vraagvormen",
  toon: "Toon",
  lengte: "Lengte",
  context: "Context",
  thema: "Thema",
  beeldgebruik: "Beeldgebruik",
  video: "Video",
};

export function isArrayVeld(veld: ModuleSpecVeld): boolean {
  return ARRAY_VELDEN.includes(veld);
}

/** Is dit veld gevuld? Een lege lijst of lege string telt niet mee. */
export function isGevuld(spec: ModuleSpec, veld: ModuleSpecVeld): boolean {
  const waarde = spec[veld];
  if (Array.isArray(waarde)) return waarde.length > 0;
  return typeof waarde === "string" && waarde.trim().length > 0;
}

/**
 * Schrijft een antwoord in de spec.
 *
 * Het subtiele geval zit bij de lijstvelden (leerdoelen, vraagvormen). Als het model keuzes
 * aanbood, ís het antwoord de volledige set → vervangen. Bij vrije tekst gaat het om één
 * toevoeging → aanvullen, want anders wist een verdiepingsvraag ("nog een derde leerdoel?")
 * de eerder gegeven leerdoelen.
 */
export function pasAntwoordToe(
  spec: ModuleSpec,
  veld: ModuleSpecVeld,
  waarden: string[],
  invoerType: InvoerType,
): ModuleSpec {
  const schoon = waarden.map((w) => w.trim()).filter((w) => w.length > 0);

  if (isArrayVeld(veld)) {
    const bestaand = (spec[veld] as string[]) ?? [];
    const keuzeGebaseerd = invoerType === "single_select" || invoerType === "multi_select";
    const nieuw = keuzeGebaseerd ? schoon : [...bestaand, ...schoon];
    return { ...spec, [veld]: [...new Set(nieuw)] };
  }

  return { ...spec, [veld]: schoon[0] ?? null };
}

/** Maakt één veld weer leeg — gebruikt door "Ik wil iets aanpassen". */
export function wisVeld(spec: ModuleSpec, veld: ModuleSpecVeld): ModuleSpec {
  return { ...spec, [veld]: isArrayVeld(veld) ? [] : null };
}

/** Verplichte velden die nog leeg zijn, in uitvraagvolgorde. */
export function ontbrekendeVelden(spec: ModuleSpec): VerplichtVeld[] {
  return VERPLICHTE_VELDEN.filter((v) => !isGevuld(spec, v));
}

export function isCompleet(spec: ModuleSpec): boolean {
  return ontbrekendeVelden(spec).length === 0;
}

export type PipStatus = "leeg" | "actief" | "gevuld";

/**
 * Status per verplicht veld voor de voortgangspips.
 *
 * `actiefVeld` is het veld waar het model nu een vraag over stelt. Een veld dat al gevuld is maar
 * opnieuw wordt uitgevraagd (verdiepingsvraag) toont als actief, niet als gevuld — de pip volgt
 * waar de gebruiker ís, niet alleen wat er al staat.
 */
export function pipStatussen(
  spec: ModuleSpec,
  actiefVeld: ModuleSpecVeld | null,
): { veld: Uitvraagveld; label: string; status: PipStatus }[] {
  return UITVRAAGVELDEN.map((veld) => {
    let status: PipStatus = "leeg";
    if (veld === actiefVeld) status = "actief";
    else if (isGevuld(spec, veld)) status = "gevuld";
    return { veld, label: VELD_LABEL[veld], status };
  });
}

/** Aantal beantwoorde vragen — voor "2 van 7". Telt wat er gevraagd wordt, niet wat moet. */
export function aantalGevuld(spec: ModuleSpec): number {
  return UITVRAAGVELDEN.filter((v) => isGevuld(spec, v)).length;
}

/** Hoeveel vragen het interview in totaal stelt. */
export const AANTAL_VRAGEN = UITVRAAGVELDEN.length;

/**
 * Vult de optionele velden met hun default en geeft een volledige spec terug.
 *
 * Nodig omdat /api/generate een spec zonder null-velden eist: het model levert die bij `genereer`,
 * maar als de gebruiker eerder afbreekt en wij zelf doorgaan, moeten toon en lengte alsnog staan.
 * Geeft null terug als een verplicht veld ontbreekt — de aanroeper hoort dan niet te genereren.
 */
export function metDefaults(spec: ModuleSpec): CompleteModuleSpec | null {
  if (!isCompleet(spec)) return null;
  return {
    onderwerp: spec.onderwerp!,
    doelgroep: spec.doelgroep!,
    leerdoelen: spec.leerdoelen,
    toon: spec.toon?.trim() || DEFAULT_TOON,
    vraagvormen: spec.vraagvormen,
    lengte: spec.lengte?.trim() || DEFAULT_LENGTE,
    context: spec.context,
    // De ontwerpvelden hebben hun eigen terugval verderop — `themaVan` kiest het standaardthema
    // als hier niets staat. Ze hier invullen zou een keuze suggereren die niemand gemaakt heeft.
    thema: spec.thema,
    beeldgebruik: spec.beeldgebruik,
    video: spec.video,
  };
}

/** Velden die de gebruiker kan kiezen bij "Ik wil iets aanpassen" — alleen wat gevuld is. */
export function aanpasbareVelden(spec: ModuleSpec): { veld: ModuleSpecVeld; label: string }[] {
  return (Object.keys(VELD_LABEL) as ModuleSpecVeld[])
    .filter((v) => isGevuld(spec, v))
    .map((veld) => ({ veld, label: VELD_LABEL[veld] }));
}

/** Toont een antwoord zoals het in de thread komt te staan. */
export function antwoordAlsTekst(waarden: string[]): string {
  return waarden.filter((w) => w.trim().length > 0).join(", ");
}
