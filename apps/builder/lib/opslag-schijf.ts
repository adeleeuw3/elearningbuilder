/**
 * De opslag op schijf: één map naast de app.
 *
 * Dit is de implementatie voor lokaal bouwen, niet voor productie. Serverless draait op een
 * wegwerp-bestandssysteem, en er zit geen tenancy in — `CLAUDE.md` §1 eist `withTenant` voor alle
 * tenant-data, en dat hoort in de R2/Postgres-implementatie die hier straks naast komt. De app
 * praat alleen met de `Opslag`-interface, dus dat is een wissel op één plek.
 *
 * Alle paden worden hier gebouwd uit een **geverifieerd id**, nooit uit iets dat de client stuurde.
 * De controle staat in `lib/opslag.ts` en werpt liever dan te gokken.
 */
import "server-only";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isGeldigId,
  mimeVanSchijfnaam,
  schijfnaam,
  type Opslag,
  type ProjectRegel,
} from "./opslag";

/** Waar alles komt te staan. Buiten `app/` en `public/`, zodat niets per ongeluk statisch geserveerd wordt. */
const WORTEL = path.join(process.cwd(), "data");
const PROJECTEN = path.join(WORTEL, "projecten");
const BESTANDEN = path.join(WORTEL, "bestanden");

async function zorgVoorMappen(): Promise<void> {
  await mkdir(PROJECTEN, { recursive: true });
  await mkdir(BESTANDEN, { recursive: true });
}

interface OpgeslagenProject {
  regel: ProjectRegel;
  doc: unknown;
}

/**
 * Hoe groot een bewaarde module is: pagina's en blokken.
 *
 * Voorzichtig met het document: het komt van schijf en kan uit een oudere versie komen. Een vorm
 * die niet klopt levert hier geen telling op in plaats van een uitzondering — het beheeroverzicht
 * mag niet omvallen op één oud bestand.
 */
function omvangVan(doc: unknown): { paginas?: number; blokken?: number } {
  const leerpad = (doc as { leerpad?: { knopen?: unknown[]; verbindingen?: unknown[] } })?.leerpad;
  if (!leerpad || !Array.isArray(leerpad.knopen)) return {};
  const knopen = leerpad.knopen as { id?: string; soort?: string }[];
  const verbindingen = Array.isArray(leerpad.verbindingen)
    ? (leerpad.verbindingen as { van?: string; naar?: string }[])
    : [];
  const inhoud = knopen.filter((k) => INHOUDSOORTEN.has(String(k?.soort)));
  const ids = new Set(inhoud.map((k) => k.id));
  // Een pagina is een keten: zoveel ketens als er inhoudsblokken zijn die niets boven zich hebben.
  const heeftVoorganger = new Set(
    verbindingen.filter((v) => ids.has(v.van) && ids.has(v.naar)).map((v) => v.naar),
  );
  return {
    blokken: inhoud.length,
    paginas: inhoud.filter((k) => !heeftVoorganger.has(k.id)).length,
  };
}

/**
 * De soorten die als blok op het scherm van de cursist komen.
 *
 * Met opzet een eigen lijst en niet die uit `graph.ts`: die kent alleen de soorten van vandaag, en
 * hier worden bestanden gelezen die ouder kunnen zijn dan de laatste modelwijziging. Een
 * onbekende soort telt gewoon niet mee in plaats van de telling te laten klappen.
 */
const INHOUDSOORTEN = new Set([
  "uitleg",
  "toets",
  "video",
  "afbeelding",
  "audio",
  "citaat",
  "carrousel",
  "reflectie",
  "assessment",
  // Soorten uit het oude model, zodat een niet-gemigreerd project geen nul toont.
  "intro",
  "samenvatting",
]);

export const schijfOpslag: Opslag = {
  async bewaarProject(id, titel, doc) {
    if (!isGeldigId(id)) throw new Error(`Ongeldig project-id: ${String(id)}`);
    await zorgVoorMappen();
    const regel: ProjectRegel = {
      id,
      titel: titel.trim().slice(0, 200) || "Naamloze module",
      // Het tijdstip komt van de server. Een client die zijn eigen tijd meestuurt kan de lijst
      // ordenen zoals hij wil, en dat is precies het soort detail dat later niemand meer snapt.
      gewijzigd: new Date().toISOString(),
    };
    const inhoud: OpgeslagenProject = { regel, doc };
    await writeFile(path.join(PROJECTEN, `${id}.json`), JSON.stringify(inhoud), "utf8");
    return regel;
  },

  async laadProject(id) {
    if (!isGeldigId(id)) return null;
    try {
      const ruw = await readFile(path.join(PROJECTEN, `${id}.json`), "utf8");
      const geparsed = JSON.parse(ruw) as OpgeslagenProject;
      return { regel: geparsed.regel, doc: geparsed.doc };
    } catch {
      return null;
    }
  },

  async lijstProjecten() {
    await zorgVoorMappen();
    const namen = await readdir(PROJECTEN).catch(() => [] as string[]);
    const regels: ProjectRegel[] = [];
    for (const naam of namen) {
      const id = naam.replace(/\.json$/, "");
      if (!isGeldigId(id)) continue; // vreemde bestanden in de map negeren we
      const p = await this.laadProject(id);
      if (p) regels.push({ ...p.regel, ...omvangVan(p.doc) });
    }
    return regels.sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));
  },

  async verwijderProject(id) {
    if (!isGeldigId(id)) return false;
    try {
      await unlink(path.join(PROJECTEN, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  },

  async leesInstelling(naam) {
    await zorgVoorMappen();
    try {
      return JSON.parse(await readFile(path.join(WORTEL, `${naam}.json`), "utf8")) as unknown;
    } catch {
      // Niet aanwezig of onleesbaar: dan is er gewoon nog niets ingesteld.
      return null;
    }
  },

  async bewaarInstelling(naam, doc) {
    await zorgVoorMappen();
    await writeFile(path.join(WORTEL, `${naam}.json`), JSON.stringify(doc), "utf8");
  },

  async bewaarBestand(id, mime, bytes) {
    await zorgVoorMappen();
    // Werpt bij een onbekend type of ongeldig id — daar willen we geen bestand voor aanmaken.
    const naam = schijfnaam(id, mime);
    await writeFile(path.join(BESTANDEN, naam), bytes);
  },

  async leesBestand(id) {
    if (!isGeldigId(id)) return null;
    const namen = await readdir(BESTANDEN).catch(() => [] as string[]);
    const naam = namen.find((n) => n.startsWith(`${id}.`));
    if (!naam) return null;
    // Het type komt uit de naam die wij zelf gemaakt hebben, niet uit iets van buiten.
    const mime = mimeVanSchijfnaam(naam);
    if (!mime) return null;
    try {
      const buf = await readFile(path.join(BESTANDEN, naam));
      return { mime, bytes: new Uint8Array(buf) };
    } catch {
      return null;
    }
  },
};

