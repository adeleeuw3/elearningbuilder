/**
 * Package assembler — turns a published observation document into a static xAPI/cmi5 ZIP.
 *
 * Guarantees (plans/01 §6.3, plans/02 §6):
 *   - deterministic output (stable file order; no build-host paths/timestamps in content),
 *   - manifest activityId === iri.parent(base, artifactId),
 *   - runs assertNoSecrets() over the assembled package BEFORE zipping,
 *   - fully offline: only relative asset paths; LRS is discovered at runtime.
 *
 * `readAsset` is injected so the caller wires in R2/S3 (keeps this package I/O-agnostic).
 */
import JSZip from "jszip";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { iri, type ObservationDoc } from "@ob/schema";
import { tincanXml, cmi5Xml, type ManifestInput } from "./manifests";
import { assertNoSecrets } from "./secret-scan";

export type Profile = "xapi" | "cmi5";

export interface ExportInput {
  doc: ObservationDoc;
  profile: Profile;
  /** Absolute paths to the built runtime files (packages/xapi-runtime/dist). */
  runtime: { bootstrapJsPath: string; clientJsPath: string };
  /** App shell files (rendered elsewhere): index.html, app.js, app.css contents. */
  shell: { indexHtml: string; appJs: string; appCss: string };
  /**
   * Resolve an assetId to its bytes.
   *
   * Only the bytes: the document decides what the file is called inside the package (see
   * `collectAssets`). Two places naming the same file is how the exporter and the player came to
   * disagree about it in the first place.
   */
  readAsset: (assetId: string) => Promise<Uint8Array>;
  masteryScore?: number;
}

/** Assemble the package as an in-memory file map (path -> bytes|string). Deterministic order. */
export async function assemblePackage(input: ExportInput): Promise<Map<string, Uint8Array | string>> {
  const { doc, profile } = input;
  const activityId = iri.parent(doc.iriBase, doc.artifactId);
  const title = pickLang(doc.metadata.title);
  const description = doc.metadata.description ? pickLang(doc.metadata.description) : undefined;
  const language = doc.metadata.language;

  const files = new Map<string, Uint8Array | string>();

  // 1) app shell + observation document (the runtime renders from this)
  files.set("index.html", input.shell.indexHtml);
  files.set("app.js", input.shell.appJs);
  files.set("app.css", input.shell.appCss);
  files.set("observation.json", JSON.stringify(doc, null, 2));

  // 2) runtime (no secrets, framework-free)
  files.set("xapi-bootstrap.js", await readFileBytes(input.runtime.bootstrapJsPath));
  files.set("xapi_client_min.js", await readFileBytes(input.runtime.clientJsPath));

  // 3) manifest
  const manifest: ManifestInput = {
    activityId,
    title,
    ...(description !== undefined ? { description } : {}),
    language,
    launchFile: "index.html",
    ...(input.masteryScore !== undefined ? { masteryScore: input.masteryScore } : {}),
  };
  files.set(profile === "cmi5" ? "cmi5.xml" : "tincan.xml", profile === "cmi5" ? cmi5Xml(manifest) : tincanXml(manifest));

  // 4) assets (dedupe by assetId; stable order)
  for (const { assetId, filename } of collectAssets(doc)) {
    files.set(`assets/${filename}`, await input.readAsset(assetId));
  }

  return files;
}

/** Build the ZIP. Runs the secret gate first. */
export async function buildZip(input: ExportInput): Promise<Uint8Array> {
  const files = await assemblePackage(input);

  // Secret gate BEFORE zipping: stage text files to a temp dir and scan.
  const dir = mkdtempSync(join(tmpdir(), "ob-export-"));
  for (const [path, content] of files) {
    if (typeof content === "string") {
      const full = join(dir, path);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content, "utf8");
    }
  }
  assertNoSecrets([dir]); // throws if anything secret-shaped is present

  const zip = new JSZip();
  // Deterministic: sort paths; fixed date so archives are byte-diffable.
  const fixedDate = new Date("1980-01-01T00:00:00Z");
  for (const path of [...files.keys()].sort()) {
    zip.file(path, files.get(path)!, { date: fixedDate });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Assert the manifest activityId matches the runtime parent IRI (export test). */
export function assertActivityIdMatches(doc: ObservationDoc, manifestActivityId: string): void {
  const expected = iri.parent(doc.iriBase, doc.artifactId);
  if (manifestActivityId !== expected) {
    throw new Error(`activityId mismatch: manifest=${manifestActivityId} runtime=${expected}`);
  }
}

/**
 * Every file the package has to carry, with the name it gets inside the package.
 *
 * Both page kinds, and captions too — a video without its track is an accessibility regression
 * that only shows up in use.
 *
 * Walks everything the player can reach, not just the obvious places: a carousel keeps its images
 * one level down in `items`, and a section background hangs off `presentation`. Missing one of
 * those is invisible here and broken there — the document still names the file, the ZIP just
 * doesn't contain it, so the learner gets an empty box on an LMS with no network.
 */
export function collectAssets(doc: ObservationDoc): { assetId: string; filename: string }[] {
  const uit = new Map<string, string>();
  const voeg = (assetId: string, filename?: string) => {
    // Eerste naam wint, maar een échte naam wint van de terugval: hetzelfde bestand mag maar één
    // keer in het pakket zitten.
    const bestaand = uit.get(assetId);
    if (!bestaand || bestaand === assetId) uit.set(assetId, filename ?? assetId);
  };
  const fromMedia = (
    media: { assetId: string; filename?: string; captionsAssetId?: string }[],
  ) => {
    for (const m of media) {
      voeg(m.assetId, m.filename);
      if (m.captionsAssetId) voeg(m.captionsAssetId);
    }
  };

  // De twee beelden die bij de module als geheel horen: het logo op het laadscherm en het beeld
  // naast het menu. Ze staan niet in een pagina, dus de lus hieronder komt ze nooit tegen — en een
  // logo dat het pakket niet in gaat is een laadscherm met een gebroken plaatje.
  const merk = doc.metadata.branding;
  if (merk?.logo) voeg(merk.logo.assetId, merk.logo.filename);
  if (merk?.image) voeg(merk.image.assetId, merk.image.filename);

  for (const page of doc.pages) {
    if (page.kind === "scene") {
      voeg(page.scene.assetId);
      for (const c of page.components) fromMedia(c.content.media);
      continue;
    }
    for (const b of page.blocks) {
      fromMedia(b.content.media);
      const achtergrond = b.presentation?.background;
      if (achtergrond) voeg(achtergrond.assetId, achtergrond.filename);
      if (b.kind === "carousel") for (const item of b.items) fromMedia(item.content.media);
    }
  }
  return [...uit.entries()]
    .map(([assetId, filename]) => ({ assetId, filename }))
    .sort((a, b) => a.assetId.localeCompare(b.assetId));
}

function pickLang(m: Record<string, string>): string {
  return m["en-US"] ?? Object.values(m)[0] ?? "";
}

async function readFileBytes(path: string): Promise<Uint8Array> {
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(await readFile(path));
}

export { assertNoSecrets } from "./secret-scan";
export { tincanXml, cmi5Xml } from "./manifests";
