/**
 * GET /api/instellingen → wat er is ingesteld, als ja/nee.
 *
 * **Alleen of, nooit wat.** Dit antwoord gaat de browser in, en een sleutel die daar komt is een
 * sleutel die iedereen heeft die de pagina opent. Er wordt dus geen waarde teruggegeven, ook niet
 * afgekort of gemaskeerd: een laatste-vier-tekens is nog steeds vier tekens meer dan nodig.
 *
 * Bestaat omdat "exporteren weigert" en "zoeken vindt niets" allebei dezelfde oorzaak kunnen
 * hebben — een ontbrekende regel in `.env.local` — en die oorzaak nu op drie verschillende plekken
 * pas blijkt. Hier staat het op één scherm, vóórdat je ertegenaan loopt.
 */
import { NextResponse } from "next/server";
import { keurIriBasis } from "../../../lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface Instellingenstand {
  /** Zonder dit weigert de export. `bezwaar` legt uit wat er mis is als hij er wél staat. */
  iriBasis: { ingesteld: boolean; bezwaar: string | null };
  /** Zonder dit kan er niets geschreven of gegenereerd worden. */
  anthropic: boolean;
  /** Per mediabron: kan de zoeker hem gebruiken? */
  media: { pexels: boolean; pixabay: boolean; youtube: boolean };
}

export async function GET() {
  const basis = process.env.OB_IRI_BASE;
  const stand: Instellingenstand = {
    iriBasis: {
      ingesteld: !!basis,
      bezwaar: basis ? keurIriBasis(basis) : null,
    },
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    media: {
      pexels: !!process.env.PEXELS_API_KEY,
      pixabay: !!process.env.PIXABAY_API_KEY,
      youtube: !!process.env.YOUTUBE_API_KEY,
    },
  };
  return NextResponse.json(stand);
}
