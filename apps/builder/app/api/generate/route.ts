/**
 * POST /api/generate
 *
 * Body: { moduleSpec }  — de volledige spec uit een `genereer`-antwoord.
 * Geeft terug: de content-JSON (titel, intro, secties, vragen, samenvatting).
 */
import { NextResponse } from "next/server";
import { ClaudeFout, callGestructureerd } from "../../../lib/claude";
import { GENERATIE_SYSTEM_PROMPT } from "../../../lib/prompts";
import {
  GeneratedContentSchema,
  GenerateRequestSchema,
  type ApiFout,
  type CompleteModuleSpec,
} from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bouwOpdracht(spec: CompleteModuleSpec): string {
  return ["moduleSpec:", JSON.stringify(spec, null, 2)].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldige_invoer", 400);
  }

  const invoer = GenerateRequestSchema.safeParse(body);
  if (!invoer.success) {
    return fout(
      `De moduleSpec is onvolledig: ${invoer.error.issues[0]?.path.join(".") ?? "onbekend veld"}.`,
      "ongeldige_invoer",
      400,
    );
  }

  try {
    const content = await callGestructureerd({
      system: GENERATIE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: bouwOpdracht(invoer.data.moduleSpec) }],
      schema: GeneratedContentSchema,
      // Dit is het inhoudelijke werk — hier telt kwaliteit boven snelheid.
      effort: "high",
      // Blijft onder de ~16k grens waarboven niet-streamende verzoeken kunnen aflopen.
      maxTokens: 16000,
    });

    return NextResponse.json(content);
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
