/**
 * Getypte fetch-wrappers voor de twee routes.
 *
 * Beide geven een resultaat-object terug in plaats van te throwen: de UI moet elke fout in de
 * juiste toon kunnen tonen mét een "Opnieuw proberen"-knop, en dan is een discriminated union
 * makkelijker dan try/catch rond elke aanroep.
 */
import {
  SchrijfAntwoordSchema,
  type SchrijfAntwoord,
  GeneratedContentSchema,
  InterviewAntwoordSchema,
  SectieSchema,
  VraagSchema,
  type ApiFout,
  type CompleteModuleSpec,
  type GeneratedContent,
  type GesprekRegel,
  type InterviewAntwoord,
  type ModuleSpec,
  type Sectie,
  type Vraag,
} from "./types";

export type Resultaat<T> =
  | { ok: true; data: T }
  | { ok: false; bericht: string; code: ApiFout["code"] };

const ONBEKEND = "Er ging iets onverwacht mis. Probeer het opnieuw.";

async function postJson<T>(
  url: string,
  body: unknown,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } },
): Promise<Resultaat<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Netwerkfout: server plat, offline, of de aanvraag afgebroken.
    return {
      ok: false,
      bericht: "Geen verbinding met de server. Controleer je verbinding en probeer het opnieuw.",
      code: "onbekend",
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, bericht: ONBEKEND, code: "onbekend" };
  }

  if (!response.ok) {
    const fout = payload as Partial<ApiFout>;
    return {
      ok: false,
      bericht: typeof fout?.bericht === "string" ? fout.bericht : ONBEKEND,
      code: fout?.code ?? "onbekend",
    };
  }

  // Ook het succespad valideren: de frontend rendert op basis van deze vorm.
  const geldig = schema.safeParse(payload);
  if (!geldig.success) {
    return {
      ok: false,
      bericht: "De server gaf een onverwacht antwoord. Probeer het opnieuw.",
      code: "ongeldig_json",
    };
  }

  return { ok: true, data: geldig.data as T };
}

export function vraagVolgendeBeurt(
  moduleSpec: ModuleSpec,
  gesprek: GesprekRegel[],
): Promise<Resultaat<InterviewAntwoord>> {
  return postJson<InterviewAntwoord>(
    "/api/interview",
    { moduleSpec, gesprek },
    InterviewAntwoordSchema,
  );
}

export function genereerContent(
  moduleSpec: CompleteModuleSpec,
): Promise<Resultaat<GeneratedContent>> {
  return postJson<GeneratedContent>("/api/generate", { moduleSpec }, GeneratedContentSchema);
}

/** Eén sectie opnieuw laten schrijven. */
export function regenereerSectie(
  moduleSpec: CompleteModuleSpec,
  huidig: Sectie,
  andereKoppen: string[],
): Promise<Resultaat<Sectie>> {
  return postJson<Sectie>(
    "/api/regenerate",
    { moduleSpec, blokType: "sectie", huidig, andereKoppen },
    SectieSchema,
  );
}

/** Eén vraag opnieuw laten schrijven. */
export function regenereerVraag(
  moduleSpec: CompleteModuleSpec,
  huidig: Vraag,
  andereVragen: string[],
): Promise<Resultaat<Vraag>> {
  return postJson<Vraag>(
    "/api/regenerate",
    { moduleSpec, blokType: "vraag", huidig, andereKoppen: andereVragen },
    VraagSchema,
  );
}

/** De tekst van één knoop op het canvas laten schrijven. */
export function schrijfTekst(req: {
  opdracht: string;
  titel: string;
  huidig: string;
  context: string;
  /** Hoeveel versies om uit te kiezen. Eén betekent: gewoon schrijven. */
  aantal: number;
}): Promise<Resultaat<SchrijfAntwoord>> {
  return postJson<SchrijfAntwoord>("/api/schrijf", req, SchrijfAntwoordSchema);
}

/* ------------------------------------------------------------------ opslag */

/**
 * Dezelfde vorm als de opslag teruggeeft, doorgegeven en niet overgetypt.
 *
 * Hier stond een eigen kopie met drie velden. Toen de opslag er twee bij kreeg (pagina's en
 * blokken) wist de client daar niets van: de velden kwamen wél over de lijn, maar waren
 * onzichtbaar voor TypeScript. Twee definities van hetzelfde lopen uiteen zonder dat iets faalt.
 */
import type { ProjectRegel } from "./opslag";
export type { ProjectRegel };

export async function lijstProjecten(): Promise<ProjectRegel[]> {
  try {
    const res = await fetch("/api/project");
    if (!res.ok) return [];
    const body = (await res.json()) as { projecten?: ProjectRegel[] };
    return body.projecten ?? [];
  } catch {
    return [];
  }
}

/**
 * Bewaart de module.
 *
 * Geeft bij een mislukking de reden terug die de server noemt, en niet een gok. "Draait de server
 * nog?" stond er eerst, en dat is precies één van de mogelijke oorzaken — bij elke andere stuurde
 * die zin de auteur de verkeerde kant op.
 */
export async function bewaarProject(
  id: string | null,
  titel: string,
  doc: unknown,
): Promise<Resultaat<ProjectRegel>> {
  let res: Response;
  try {
    res = await fetch("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(id ? { id } : {}), titel, doc }),
    });
  } catch {
    return {
      ok: false,
      bericht: "Geen verbinding met de server. Draait hij nog?",
      code: "onbekend",
    };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return {
      ok: false,
      bericht: `De server antwoordde met status ${res.status} en geen leesbaar bericht.`,
      code: "onbekend",
    };
  }
  if (!res.ok) {
    const fout = payload as Partial<ApiFout>;
    return {
      ok: false,
      bericht: fout.bericht ?? `De server weigerde het opslaan (status ${res.status}).`,
      code: fout.code ?? "onbekend",
    };
  }
  return { ok: true, data: payload as ProjectRegel };
}

export async function laadProject(
  id: string,
): Promise<{ regel: ProjectRegel; doc: unknown } | null> {
  try {
    const res = await fetch(`/api/project/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as { regel: ProjectRegel; doc: unknown };
  } catch {
    return null;
  }
}

/** Gooit een module weg. `false` als hij er al niet meer was of de server weigerde. */
export async function verwijderProject(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/project/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------- export */

export type ExportProfiel = "xapi" | "cmi5";

/**
 * De uitkomst van een exportpoging.
 *
 * Een weigering is hier geen fout maar een uitkomst met redenen: de route weigert bewust vóór het
 * bouwen (ontbrekende alt-tekst, een pagina zonder inhoud), en die redenen zijn voor de auteur
 * geschreven. Ze wegvangen in een generieke foutmelding zou precies de informatie weggooien
 * waarmee hij het kan oplossen.
 */
export type ExportUitkomst =
  | { ok: true; blob: Blob; bestandsnaam: string }
  | { ok: false; bericht: string; redenen: string[] };

/**
 * Vraagt het exportpakket op.
 *
 * Bij succes komt er een ZIP terug (binair), bij een weigering JSON — vandaar dat dit niet door
 * `postJson` kan: die leest altijd JSON en zou de ZIP slopen.
 */
export async function exporteerPakket(
  module: { id: string; content: unknown; leerpad: unknown; thema?: string | null },
  profiel: ExportProfiel,
): Promise<ExportUitkomst> {
  let res: Response;
  try {
    res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ module, profiel }),
    });
  } catch {
    return {
      ok: false,
      bericht: "Geen verbinding met de server. Draait hij nog?",
      redenen: [],
    };
  }

  if (res.ok) {
    const blob = await res.blob();
    return { ok: true, blob, bestandsnaam: bestandsnaamUit(res) ?? `module-${module.id}.zip` };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, bericht: ONBEKEND, redenen: [] };
  }
  const fout = payload as Partial<ApiFout> & { redenen?: unknown };
  return {
    ok: false,
    bericht: typeof fout.bericht === "string" ? fout.bericht : ONBEKEND,
    redenen: Array.isArray(fout.redenen) ? fout.redenen.filter((r) => typeof r === "string") : [],
  };
}

/**
 * De bestandsnaam uit `Content-Disposition`.
 *
 * De server bepaalt hem uit het project-id (32 hex), dus hij kan geen pad raken. Toch hier nog
 * eens door een strak patroon: deze naam gaat naar een download-attribuut, en een naam die de
 * browser als pad leest is precies wat je daar niet wilt.
 */
function bestandsnaamUit(res: Response): string | null {
  const kop = res.headers.get("content-disposition");
  const m = kop ? /filename="([A-Za-z0-9._-]+)"/.exec(kop) : null;
  return m ? m[1]! : null;
}
