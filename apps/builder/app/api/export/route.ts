/**
 * POST /api/export  { module: { id, content, leerpad }, profiel: "xapi" | "cmi5" }
 *
 * Bouwt het exportpakket en geeft de ZIP terug.
 *
 * De module komt **inline** mee en wordt niet van schijf geladen: exporteren hoeft niet te wachten
 * op opslaan. De identiteit gaat mee als `module.id` — de client kent hem vanaf het moment dat de
 * module bestaat, en gebruikt datzelfde id als project-id zodra er wél bewaard wordt. Zo levert
 * exporteren vóór en ná het opslaan dezelfde IRI's op, en valt de historie in de LRS niet in tweeën.
 *
 * De volgorde is met opzet: eerst weigeren, dan pas bouwen.
 *
 *   1. de module moet een geldig id en een graaf hebben;
 *   2. de graaf moet een cursus opleveren (`naarObservatieDocument` weigert anders);
 *   3. `publishBlockers()` moet leeg zijn — dat is de a11y-poort uit `@ob/schema`;
 *   4. `assertActivityIdMatches` controleert dat het manifest en de runtime naar dezelfde
 *      activiteit wijzen;
 *   5. `assertNoSecrets()` draait binnen `buildZip`, vóór het zippen.
 *
 * `OB_IRI_BASE` is verplicht en heeft geen standaardwaarde. De IRI-namespace is identiteit: raden
 * zou statements publiceren onder een namespace die niet van jou is, en dat is in een LRS niet meer
 * terug te draaien.
 */
import { NextResponse } from "next/server";
import path from "node:path";
import { publishBlockers } from "@ob/schema";
import { assertActivityIdMatches, buildZip } from "@ob/exporter";
import { keurIriBasis, naarObservatieDocument } from "../../../lib/export";
import { migreerLeerpad } from "../../../lib/migratie";
import { APP_JS, appCss, indexHtml } from "../../../lib/shell";
import { themaVan } from "../../../lib/thema";
import { alsUuid, isGeldigId } from "../../../lib/opslag";
import { schijfOpslag } from "../../../lib/opslag-schijf";
import type { ApiFout, GeneratedContent } from "../../../lib/types";
import type { Leerpad } from "../../../lib/leerpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** De gebouwde runtime die in elk pakket meegaat. */
const RUNTIME = path.join(process.cwd(), "..", "..", "packages", "xapi-runtime", "dist");

export async function POST(request: Request) {
  const basis = process.env.OB_IRI_BASE;
  if (!basis) {
    return fout(
      "OB_IRI_BASE is niet ingesteld. Zonder IRI-namespace kan er niet geëxporteerd worden — zie .env.example.",
      "ongeldige_invoer",
      500,
    );
  }

  const namespaceProbleem = keurIriBasis(basis);
  if (namespaceProbleem) return fout(namespaceProbleem, "ongeldige_invoer", 500);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldige_invoer", 400);
  }
  const invoer = body as { module?: unknown; profiel?: unknown };
  const module = invoer.module as
    | { id?: unknown; content?: GeneratedContent; leerpad?: Leerpad; thema?: unknown }
    | undefined;
  if (!module || !isGeldigId(module.id)) {
    return fout("Er zat geen module met een geldige identiteit bij de aanvraag.", "ongeldige_invoer", 400);
  }
  if (!module.content || !module.leerpad) {
    return fout("De module is onvolledig: er ontbreekt content of een graaf.", "ongeldige_invoer", 422);
  }
  const profiel = invoer.profiel === "cmi5" ? "cmi5" : "xapi";

  // Migreren blijft nodig: een module die sinds het paginamodel niet meer geopend is komt hier in
  // de oude vorm binnen. Zonder deze stap krijgt de pagina de seed van haar eerste blok in plaats
  // van die van de oude paginaknoop — een andere IRI voor hetzelfde scherm, en dus een gebroken
  // historie in de LRS.
  const uit = naarObservatieDocument({
    leerpad: migreerLeerpad(module.leerpad),
    content: module.content,
    artifactId: alsUuid(module.id),
    iriBase: basis,
  });
  if (!uit.ok) return weigering(uit.redenen);

  const blokkades = publishBlockers(uit.doc);
  if (blokkades.length > 0) return weigering(blokkades);

  // Manifest en runtime moeten naar dezelfde activiteit wijzen; anders komt de historie in de LRS
  // onder twee identiteiten terecht.
  try {
    assertActivityIdMatches(uit.doc, uit.activityId);
  } catch (e) {
    return fout(e instanceof Error ? e.message : "activityId komt niet overeen.", "onbekend", 500);
  }

  const titel = Object.values(uit.doc.metadata.title)[0] ?? "Module";

  try {
    const zip = await buildZip({
      doc: uit.doc,
      profile: profiel,
      runtime: {
        bootstrapJsPath: path.join(RUNTIME, "xapi-bootstrap.js"),
        clientJsPath: path.join(RUNTIME, "xapi_client_min.js"),
      },
      shell: {
        indexHtml: indexHtml({
          titel,
          taal: uit.doc.metadata.language,
          ondertitel: Object.values(uit.doc.metadata.subtitle ?? {})[0],
          // Het pad moet gelijk zijn aan wat `collectAssets` in het pakket zet, anders staat er op
          // het laadscherm een gebroken plaatje.
          logoPad: uit.doc.metadata.branding.logo
            ? `assets/${uit.doc.metadata.branding.logo.filename ?? uit.doc.metadata.branding.logo.assetId}`
            : undefined,
        }),
        appJs: APP_JS,
        // Het thema dat de auteur in het gesprek koos. Een onbekende of ontbrekende naam valt
        // terug op het standaardthema; de export mag hier nooit op stuklopen.
        appCss: appCss(themaVan(typeof module.thema === "string" ? module.thema : null)),
      },
      readAsset: async (assetId) => {
        const bestand = await schijfOpslag.leesBestand(assetId);
        if (!bestand) throw new Error(`Bestand ${assetId} staat niet meer in de opslag.`);
        // Alleen de bytes: hoe het bestand in het pakket heet staat in het document, en daar staat
        // het één keer. Toen dat hier óók bepaald werd liepen de exporter en de speler uiteen.
        return bestand.bytes;
      },
    });

    return new Response(zip as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.byteLength),
        "Content-Disposition": `attachment; filename="module-${module.id}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fout(
      e instanceof Error ? e.message : "Het pakket kon niet gebouwd worden.",
      "onbekend",
      500,
    );
  }
}

/** Een weigering met redenen die een auteur kan lezen, niet een stapel schemafouten. */
function weigering(redenen: string[]) {
  const body: ApiFout & { redenen: string[] } = {
    fout: true,
    code: "ongeldige_invoer",
    bericht: "De module kan nog niet geëxporteerd worden.",
    redenen,
  };
  return NextResponse.json(body, { status: 422 });
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
