/**
 * POST /api/interview
 *
 * Body: { moduleSpec, gesprek }
 * Geeft terug: één van de drie contractvormen (vraag | bevestig | genereer).
 *
 * Dit is de enige plek waar de interview-prompt en de API-key samenkomen. De route is bewust
 * dun: schema-validatie in, modelaanroep, schema-validatie uit.
 */
import { NextResponse } from "next/server";
import { ClaudeFout, callGestructureerd } from "../../../lib/claude";
import { INTERVIEW_SYSTEM_PROMPT } from "../../../lib/prompts";
import {
  InterviewAntwoordSchema,
  InterviewRequestSchema,
  type ApiFout,
  type GesprekRegel,
  type ModuleSpec,
} from "../../../lib/types";

export const runtime = "nodejs";
/** Nooit cachen: elke beurt hangt af van de meegestuurde spec en historie. */
export const dynamic = "force-dynamic";

/**
 * Het gesprek wordt als één user-turn meegegeven, met de huidige spec erboven. Dat houdt de
 * system prompt byte-stabiel (goed voor prompt caching) en geeft het model precies wat de
 * prompt belooft: "de huidige moduleSpec en het gesprek tot nu toe".
 */
function bouwBeurt(moduleSpec: ModuleSpec, gesprek: GesprekRegel[]): string {
  const historie =
    gesprek.length === 0
      ? "(nog geen gesprek — dit is de eerste beurt)"
      : gesprek
          .map((r) => `${r.rol === "ai" ? "Prism" : "Gebruiker"}: ${r.bericht}`)
          .join("\n");

  return [
    "Huidige moduleSpec:",
    JSON.stringify(moduleSpec, null, 2),
    "",
    "Gesprek tot nu toe:",
    historie,
    "",
    "Bepaal het belangrijkste nog-lege of nog-vage veld en geef je volgende antwoord.",
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldige_invoer", 400);
  }

  const invoer = InterviewRequestSchema.safeParse(body);
  if (!invoer.success) {
    return fout(
      `De aanvraag is onvolledig: ${invoer.error.issues[0]?.path.join(".") ?? "onbekend veld"}.`,
      "ongeldige_invoer",
      400,
    );
  }

  const { moduleSpec, gesprek } = invoer.data;

  try {
    const antwoord = await callGestructureerd({
      system: INTERVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: bouwBeurt(moduleSpec, gesprek) }],
      schema: InterviewAntwoordSchema,
      // Eén klein gestructureerd besluit per beurt; laag effort houdt het gesprek snel.
      effort: "low",
      // Ruim, want max_tokens dekt op Opus 5 ook het denken.
      maxTokens: 4000,
      // Gemeten: een beurt duurt ~8-9s, en denken uitzetten scheelt daarin vrijwel niets
      // (~8,3s vs ~8,9s, binnen de ruis). De tijd zit in het genereren van de vraag en de
      // optieteksten zelf, niet in het denken. Daarom laten we adaptive thinking staan — dat
      // vermijdt de twee bekende faalmodi van thinking-uit op Opus 5 zonder iets te kosten.
      // Wil je het gesprek écht sneller, dan is een lichter model voor déze route de knop.
    });

    return NextResponse.json(antwoord);
  } catch (e) {
    const f = e instanceof ClaudeFout ? e : null;
    return fout(
      f?.message ?? "Er ging iets onverwacht mis. Probeer het opnieuw.",
      f?.code ?? "onbekend",
      f?.code === "geen_api_key" ? 500 : 502,
    );
  }
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
