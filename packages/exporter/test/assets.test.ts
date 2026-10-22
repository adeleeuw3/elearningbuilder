/**
 * Wat de speler kan opvragen, moet in het pakket zitten.
 *
 * Dit ging twee keer mis en beide keren stil: de ZIP werd gebouwd, het manifest klopte, en de
 * cursist kreeg een leeg vlak. Eén keer omdat de verzamelaar alleen naar `content.media` keek en
 * niet naar de beelden van een carrousel of de achtergrond van een sectie; één keer omdat de
 * exporter `assets/<id>.<ext>` schreef terwijl de speler `assets/<id>` opvroeg.
 *
 * Vandaar dat hier niet staat "er zitten assets in", maar: precies de paden die de speler
 * samenstelt, en niets meer.
 */
import { describe, it, expect } from "vitest";
import { ObservationDoc } from "@ob/schema";
import { collectAssets, assemblePackage } from "../src/index";

const EN = "nl-NL";
const uuid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

const blok = (extra: Record<string, unknown>) => ({
  id: uuid(9),
  name: "Blok",
  label: { [EN]: "Blok" },
  ...extra,
});

const doc = (blocks: unknown[]) =>
  ObservationDoc.parse({
    schemaVersion: "1.0",
    artifactId: uuid(1),
    version: 1,
    iriBase: "https://xapi.example.com/acme",
    metadata: { title: { [EN]: "Module" }, language: EN },
    pages: [{ kind: "stack", id: uuid(2), title: { [EN]: "Pagina" }, blocks }],
  });

describe("collectAssets", () => {
  it("pakt het beeld van een gewoon blok, met de naam uit het document", () => {
    const uit = collectAssets(
      doc([
        blok({
          kind: "media",
          content: { html: "", media: [{ assetId: "a1", kind: "image", filename: "a1.png" }] },
        }),
      ]),
    );
    expect(uit).toEqual([{ assetId: "a1", filename: "a1.png" }]);
  });

  it("pakt óók het beeld van een carrousel-stap", () => {
    const uit = collectAssets(
      doc([
        blok({
          kind: "carousel",
          items: [
            {
              id: "i1",
              heading: { [EN]: "Stap" },
              content: { html: "", media: [{ assetId: "a2", kind: "image", filename: "a2.jpg" }] },
            },
          ],
        }),
      ]),
    );
    expect(uit).toEqual([{ assetId: "a2", filename: "a2.jpg" }]);
  });

  it("pakt de achtergrond van een sectie", () => {
    const uit = collectAssets(
      doc([
        blok({
          kind: "quote",
          presentation: { background: { assetId: "a3" }, fullBleed: true },
        }),
      ]),
    );
    // Zonder naam in het document valt hij terug op het kale id — precies wat de speler opvraagt.
    expect(uit).toEqual([{ assetId: "a3", filename: "a3" }]);
  });

  it("pakt het logo en het menubeeld, die in geen enkele pagina staan", () => {
    // Deze twee horen bij de module als geheel. De lus over `pages` komt ze dus nooit tegen, en
    // dat is precies de reden dat ze vergeten kunnen worden: het pakket bouwt gewoon door en het
    // laadscherm toont een gebroken plaatje.
    const uit = collectAssets(
      ObservationDoc.parse({
        schemaVersion: "1.0",
        artifactId: uuid(1),
        version: 1,
        iriBase: "https://xapi.example.com/acme",
        metadata: {
          title: { [EN]: "Module" },
          language: EN,
          branding: {
            logo: { assetId: "logo1", filename: "logo1.png" },
            image: { assetId: "menu1", filename: "menu1.jpg" },
          },
        },
        pages: [{ kind: "stack", id: uuid(2), title: { [EN]: "Pagina" }, blocks: [] }],
      }),
    );
    expect(uit).toEqual([
      { assetId: "logo1", filename: "logo1.png" },
      { assetId: "menu1", filename: "menu1.jpg" },
    ]);
  });

  it("neemt een bestand dat twee keer gebruikt wordt maar één keer mee", () => {
    const media = [{ assetId: "a4", kind: "image", filename: "a4.png" }];
    const uit = collectAssets(
      doc([
        blok({ kind: "media", content: { html: "", media } }),
        { ...blok({ kind: "media", content: { html: "", media } }), id: uuid(8) },
      ]),
    );
    expect(uit).toEqual([{ assetId: "a4", filename: "a4.png" }]);
  });

  it("laat ondertitels niet liggen", () => {
    const uit = collectAssets(
      doc([
        blok({
          kind: "media",
          content: {
            html: "",
            media: [{ assetId: "v1", kind: "video", filename: "v1.mp4", captionsAssetId: "c1" }],
          },
        }),
      ]),
    );
    expect(uit.map((a) => a.assetId)).toEqual(["c1", "v1"]);
  });
});

describe("het pakket", () => {
  it("zet elk bestand neer op het pad dat de speler samenstelt", async () => {
    const files = await assemblePackage({
      doc: doc([
        blok({
          kind: "carousel",
          items: [
            {
              id: "i1",
              heading: { [EN]: "Stap" },
              content: { html: "", media: [{ assetId: "a2", kind: "image", filename: "a2.png" }] },
            },
          ],
        }),
      ]),
      profile: "xapi",
      runtime: { bootstrapJsPath: __filename, clientJsPath: __filename },
      shell: { indexHtml: "<!doctype html>", appJs: "", appCss: "" },
      readAsset: async () => new Uint8Array([1, 2, 3]),
    });

    // De speler bouwt `"assets/" + (m.filename || m.assetId)`. Precies dat pad, geen ander.
    expect([...files.keys()]).toContain("assets/a2.png");
    expect([...files.keys()]).not.toContain("assets/a2");
  });
});
