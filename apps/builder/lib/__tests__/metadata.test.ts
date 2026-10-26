/**
 * Metadata uit een afbeelding halen.
 *
 * `CLAUDE.md` §8 eist magic-byte-controle, hercoderen en EXIF strippen. De eerste gebeurde al op
 * de server, de andere twee alleen in de browser — en de browser is comfort: wie de uploadroute
 * rechtstreeks aanroept komt daar niet langs. Gemeten op een echte upload kwam een PNG met een
 * `tEXt`-blok er aan de andere kant uit met precies dezelfde bytes, blok en al.
 *
 * Deze tests gaan over twee dingen die allebei stil fout kunnen gaan: komt de metadata er echt
 * uit, en blijft de afbeelding heel. Een verkeerd gelezen lengte levert geen foutmelding op maar
 * een kapot bestand, en dat zie je pas als een cursist naar een leeg vlak kijkt.
 */
import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { draagtMetadata, zonderMetadata } from "../metadata";

/* ------------------------------------------------------------------ bouwstenen */

function crc(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
}

/** Een geldige 4×4-PNG, met de meegegeven extra blokken ertussen. */
function maakPng(extra: Buffer[] = []): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(4, 0);
  ihdr.writeUInt32BE(4, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rij = Buffer.concat([Buffer.from([0]), Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0])]);
  const idat = deflateSync(Buffer.concat([rij, rij, rij, rij]));
  return Uint8Array.from(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ihdr),
      ...extra,
      pngChunk("IDAT", idat),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const tekstBlok = (sleutel: string, waarde: string) =>
  pngChunk("tEXt", Buffer.concat([Buffer.from(sleutel), Buffer.from([0]), Buffer.from(waarde)]));

/** Een JPEG met een APP1-segment (daar zit EXIF in) en een minimale scan. */
function maakJpeg(metExif: boolean): Uint8Array {
  const delen: number[] = [0xff, 0xd8];
  if (metExif) {
    const payload = Buffer.concat([Buffer.from("Exif\0\0"), Buffer.from("GPS 52.37N 4.89E")]);
    const lengte = payload.length + 2;
    delen.push(0xff, 0xe1, (lengte >> 8) & 255, lengte & 255, ...payload);
  }
  // Een quantisatietabel (DQT) die moet blijven staan.
  const dqt = Buffer.alloc(65, 7);
  delen.push(0xff, 0xdb, ((dqt.length + 2) >> 8) & 255, (dqt.length + 2) & 255, ...dqt);
  // Start of scan, daarna beeldgegevens tot het eind.
  delen.push(0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0);
  delen.push(0x12, 0x34, 0x56, 0xff, 0xd9);
  return Uint8Array.from(delen);
}

/* ---------------------------------------------------------------------- tests */

describe("PNG", () => {
  it("haalt een tekstblok eruit", () => {
    const met = maakPng([tekstBlok("Comment", "GPS 52.37N 4.89E")]);
    expect(draagtMetadata(met, "image/png")).toBe(true);

    const uit = zonderMetadata(met, "image/png");
    expect(uit.gestript).toBe(true);
    expect(draagtMetadata(uit.bytes, "image/png")).toBe(false);
    expect(Buffer.from(uit.bytes).includes(Buffer.from("GPS 52.37N"))).toBe(false);
  });

  it("laat het beeld zelf ongemoeid", () => {
    // Dit is de helft die stil fout gaat: metadata weg, maar ook het beeld weg.
    const schoon = maakPng();
    const met = maakPng([tekstBlok("Comment", "iets"), tekstBlok("Author", "iemand")]);
    expect(Buffer.from(zonderMetadata(met, "image/png").bytes)).toEqual(Buffer.from(schoon));
  });

  it("houdt een kleurprofiel en de afmeting", () => {
    // Die zeggen niets over wie of waar, maar wel hoe het beeld hoort te worden weergegeven.
    const pHYs = pngChunk("pHYs", Buffer.from([0, 0, 11, 19, 0, 0, 11, 19, 1]));
    const uit = zonderMetadata(maakPng([pHYs]), "image/png");
    expect(Buffer.from(uit.bytes).includes(Buffer.from("pHYs"))).toBe(true);
  });

  it("raakt een PNG zonder metadata niet aan", () => {
    const schoon = maakPng();
    expect(Buffer.from(zonderMetadata(schoon, "image/png").bytes)).toEqual(Buffer.from(schoon));
  });

  it("laat een onleesbare structuur met rust in plaats van hem half door te snijden", () => {
    // Een lengte die buiten het bestand wijst betekent dat we het verkeerd lezen. Dan is de
    // originele afbeelding teruggeven beter dan een restant opleveren.
    const stuk = maakPng().slice(0, 30);
    const uit = zonderMetadata(stuk, "image/png");
    expect(uit.gestript).toBe(false);
    expect(uit.bytes).toBe(stuk);
  });
});

describe("JPEG", () => {
  it("haalt het EXIF-segment eruit", () => {
    const met = maakJpeg(true);
    expect(draagtMetadata(met, "image/jpeg")).toBe(true);

    const uit = zonderMetadata(met, "image/jpeg");
    expect(uit.gestript).toBe(true);
    expect(draagtMetadata(uit.bytes, "image/jpeg")).toBe(false);
    expect(Buffer.from(uit.bytes).includes(Buffer.from("GPS 52.37N"))).toBe(false);
  });

  it("houdt de tabellen en de beeldgegevens", () => {
    const uit = zonderMetadata(maakJpeg(true), "image/jpeg");
    const schoon = maakJpeg(false);
    expect(Buffer.from(uit.bytes)).toEqual(Buffer.from(schoon));
    // En het bestand eindigt nog steeds op de eind-marker.
    expect([...uit.bytes.slice(-2)]).toEqual([0xff, 0xd9]);
  });
});

describe("onbekende formaten", () => {
  it("laat video en geluid ongemoeid", () => {
    const bytes = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);
    const uit = zonderMetadata(bytes, "video/webm");
    expect(uit.gestript).toBe(false);
    expect(uit.bytes).toBe(bytes);
  });
});
