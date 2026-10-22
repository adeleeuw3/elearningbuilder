/**
 * GET /api/bestand/[id]
 *
 * Serveert een opgeslagen bestand terug.
 *
 * Het type komt uit de naam die wij zelf hebben gemaakt, nooit uit de aanvraag. Daarbij drie koppen
 * die ertoe doen: `nosniff` zodat de browser niet zelf gaat raden wat dit is, een CSP die alles
 * verbiedt voor het geval er ooit toch iets uitvoerbaars doorheen komt, en `inline` zonder de naam
 * van de auteur — die naam is invoer van buiten en hoort niet in een header thuis.
 */
import { isGeldigId } from "../../../../lib/opslag";
import { schijfOpslag } from "../../../../lib/opslag-schijf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isGeldigId(id)) return new Response("Niet gevonden", { status: 404 });

  const bestand = await schijfOpslag.leesBestand(id);
  if (!bestand) return new Response("Niet gevonden", { status: 404 });

  return new Response(bestand.bytes as BodyInit, {
    headers: {
      "Content-Type": bestand.mime,
      "Content-Length": String(bestand.bytes.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // Onveranderlijk: de inhoud achter een id wijzigt nooit, want een nieuwe upload krijgt een
      // nieuw id.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
