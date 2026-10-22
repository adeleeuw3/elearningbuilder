/**
 * De browserkant van het bestand kiezen: inlezen, keuren, en bij een afbeelding hercoderen.
 *
 * **Het hercoderen is de EXIF-strip.** Een afbeelding door een canvas halen en er opnieuw uit
 * schrijven levert alleen de pixels op — alle metadata blijft achter, inclusief de GPS-coördinaten
 * die telefoons standaard meeschrijven. Dat is geen bijvangst maar de reden: een cursusfoto die de
 * thuisadresgegevens van de maker meedraagt naar andermans LMS is een lek.
 *
 * Het neutraliseert bovendien polyglot-bestanden: wat er ook achter de pixels verstopt zat, het
 * komt niet mee door de canvas.
 *
 * **Video en audio worden niet hercodeerd.** Dat kan een browser niet zonder een transcoder van
 * megabytes, en half werk zou hier erger zijn dan geen werk. Ze worden wél op hun bytes gekeurd en
 * op grootte begrensd, en dat staat zo in de interface.
 */
"use client";

import {
  controleerBestand,
  type Bestand,
  type BestandSoort,
} from "./bestand";

export type Verwerkt = { ok: true; bestand: Bestand } | { ok: false; reden: string };

/** Zoveel bytes zijn genoeg voor elke vingerafdruk die we kennen. */
const KOPLENGTE = 64;

export async function verwerkBestand(file: File, verwacht: BestandSoort): Promise<Verwerkt> {
  const kop = new Uint8Array(await file.slice(0, KOPLENGTE).arrayBuffer());
  const uitslag = controleerBestand(
    { naam: file.name, type: file.type, grootte: file.size },
    kop,
    verwacht,
  );
  if (!uitslag.ok) return { ok: false, reden: uitslag.reden ?? "Dit bestand kan niet gebruikt worden." };

  // Afbeeldingen gaan door de canvas: dat is de EXIF-strip. De rest gaat zoals hij is.
  let teSturen: Blob = file;
  let hercodeerd = false;
  if (verwacht === "afbeelding") {
    const her = await hercodeer(file, uitslag.mime ?? "image/jpeg");
    if (!her) {
      return {
        ok: false,
        reden: "Deze afbeelding kon niet worden gelezen; hij is mogelijk beschadigd.",
      };
    }
    teSturen = her;
    hercodeerd = true;
  }

  return upload(teSturen, file.name, verwacht, hercodeerd);
}

/**
 * Stuurt de bytes naar de opslag en gebruikt de URL die terugkomt.
 *
 * Bewust niet de object-URL bewaren: die leeft in dit tabblad en is na een herlaadbeurt dood. Wat
 * hier terugkomt is een pad naar de opslag, en dat overleeft wél.
 */
async function upload(
  blob: Blob,
  naam: string,
  soort: BestandSoort,
  hercodeerd: boolean,
): Promise<Verwerkt> {
  const form = new FormData();
  form.append("bestand", blob, naam);
  form.append("soort", soort);

  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: form });
  } catch {
    return { ok: false, reden: "De opslag is niet bereikbaar. Draait de server nog?" };
  }

  const body = (await res.json().catch(() => null)) as
    | { url?: string; mime?: string; grootte?: number; naam?: string; bericht?: string }
    | null;

  if (!res.ok || !body?.url) {
    return { ok: false, reden: body?.bericht ?? "De opslag weigerde dit bestand." };
  }
  return {
    ok: true,
    bestand: {
      naam: body.naam ?? naam,
      mime: body.mime ?? blob.type,
      grootte: body.grootte ?? blob.size,
      url: body.url,
      hercodeerd,
    },
  };
}

/**
 * Neemt een gekozen kandidaat uit de mediazoeker over.
 *
 * Gaat bewust door dezelfde deur als een bestand van je eigen schijf: de bytes komen via de
 * proxy binnen als een `File` en daarna doet `verwerkBestand` de rest — magic-byte-controle,
 * hercoderen, opslaan. Een aparte route voor "bestanden die wij zelf ophaalden" zou betekenen dat
 * de EXIF-strip één van de twee keer niet draait, en dat is precies de fout die niemand opmerkt.
 */
export async function neemKandidaatOver(
  bestandUrl: string,
  soort: BestandSoort,
  naam: string,
): Promise<Verwerkt> {
  let res: Response;
  try {
    res = await fetch("/api/media/haal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: bestandUrl, soort }),
    });
  } catch {
    return { ok: false, reden: "De server is niet bereikbaar." };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { bericht?: string } | null;
    return { ok: false, reden: body?.bericht ?? "Dit bestand kon niet worden opgehaald." };
  }

  const blob = await res.blob();
  const file = new File([blob], naam, { type: blob.type || "application/octet-stream" });
  return verwerkBestand(file, soort);
}

/**
 * Tekent de afbeelding op een canvas en schrijft hem opnieuw weg.
 *
 * PNG blijft PNG: die kan transparantie dragen, en naar JPEG omzetten zou dat vervangen door een
 * zwart vlak. Al het andere wordt JPEG.
 */
async function hercodeer(file: File, mime: string): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const beeld = await laad(url);
    const canvas = document.createElement("canvas");
    canvas.width = beeld.naturalWidth;
    canvas.height = beeld.naturalHeight;
    if (canvas.width === 0 || canvas.height === 0) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(beeld, 0, 0);

    const doel = mime === "image/png" ? "image/png" : "image/jpeg";
    return await new Promise<Blob | null>((klaar) =>
      canvas.toBlob((b) => klaar(b), doel, doel === "image/jpeg" ? 0.92 : undefined),
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function laad(url: string): Promise<HTMLImageElement> {
  return new Promise((klaar, mis) => {
    const img = new Image();
    img.onload = () => klaar(img);
    img.onerror = () => mis(new Error("kon de afbeelding niet laden"));
    img.src = url;
  });
}

/**
 * Geeft een object-URL vrij, als het er een is.
 *
 * Sinds de bestanden naar de opslag gaan is de URL meestal een pad en valt er niets vrij te geven.
 * De controle blijft staan omdat het hercoderen onderweg wél object-URL's maakt, en omdat een
 * bestand uit een oudere sessie er nog een kan hebben.
 */
export function geefVrij(bestand: Bestand | undefined): void {
  if (bestand?.url.startsWith("blob:")) URL.revokeObjectURL(bestand.url);
}
