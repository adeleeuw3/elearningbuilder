/**
 * POST /api/regenerate
 *
 * Body: { moduleSpec, blokType, huidig, andereKoppen }
 * Geeft terug: één vervangend blok (sectie of vraag).
 *
 * Bestaat zodat "Opnieuw" op één blok niet de hele module hoeft te hergenereren: dat is sneller,
 * goedkoper, en laat de blokken die de auteur al goedkeurde ongemoeid.
 */
import { NextResponse } from "next/server";
import { ClaudeFout, callGestructureerd } from "../../../lib/claude";
import { HERGENERATIE_SYSTEM_PROMPT } from "../../../lib/prompts";
import {
  RegenerateRequestSchema,
  SectieSchema,
  VraagSchema,
  type ApiFout,
  type RegenerateRequest,
} from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bouwOpdracht(req: RegenerateRequest): string {
  return [
    "moduleSpec:",
    JSON.stringify(req.moduleSpec, null, 2),
    "",
    `Huidig blok (type: ${req.blokType}):`,
    JSON.stringify(req.huidig, null, 2),
    "",
    req.andereKoppen.length
      ? `Koppen van de andere blokken (niet herhalen): ${req.andereKoppen.join(" · ")}`
      : "Er zijn geen andere blokken.",
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldige_invoer", 400);
  }

  const invoer = RegenerateRequestSchema.safeParse(body);
  if (!invoer.success) {
    return fout(
      `De aanvraag is onvolledig: ${invoer.error.issues[0]?.path.join(".") ?? "onbekend veld"}.`,
      "ongeldige_invoer",
      400,
    );
  }

  try {
    const blok = await callGestructureerd({
      system: HERGENERATIE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: bouwOpdracht(invoer.data) }],
      // Het schema verschilt per bloktype, zodat structured outputs precies de juiste vorm afdwingt.
      schema: invoer.data.blokType === "sectie" ? SectieSchema : VraagSchema,
      effort: "medium",
      maxTokens: 4000,
    });

    return NextResponse.json(blok);
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
