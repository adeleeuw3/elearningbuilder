/**
 * De bestandscontrole is de plek waar een fout niet luidruchtig faalt maar stil doorglipt: een
 * verkeerd bestand wordt geaccepteerd, komt in een exportpakket en draait op andermans LMS. Daarom
 * staan de eisen uit CLAUDE.md §8 hier als tests: bytes boven extensie, SVG eruit, grenzen hard.
 */
import { describe, it, expect } from "vitest";
import {
  accepteert,
  controleerBestand,
  herkenSoort,
  isTekstDocument,
  leesbareGrootte,
  MAX_BYTES,
  mimeGroep,
} from "../bestand";

/** Bouwt een kop met de gegeven bytes, aangevuld tot een bruikbare lengte. */
function kop(...bytes: number[]): Uint8Array {
  const b = new Uint8Array(64);
  bytes.forEach((v, i) => (b[i] = v));
  return b;
}
const tekens = (s: string, vanaf = 0): number[] => {
  const uit: number[] = new Array(vanaf).fill(0);
  for (const c of s) uit.push(c.charCodeAt(0));
  return uit;
};

const PNG = kop(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x08);
const PNG_ECHT = kop(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = kop(0xff, 0xd8, 0xff, 0xe0);
const GIF = kop(...tekens("GIF89a"));
const WEBP = kop(...tekens("RIFF"), 0, 0, 0, 0, ...tekens("WEBP"));
const MP4 = kop(0, 0, 0, 0x20, ...tekens("ftypisom"));
const WEBM = kop(0x1a, 0x45, 0xdf, 0xa3);
const WAV = kop(...tekens("RIFF"), 0, 0, 0, 0, ...tekens("WAVE"));
const OGG = kop(...tekens("OggS"));
const MP3_ID3 = kop(...tekens("ID3"));
const MP3_FRAME = kop(0xff, 0xfb);
const SVG = kop(...tekens('<svg xmlns="http://www.w3.org/2000/svg">'));
const XML = kop(...tekens('<?xml version="1.0"?><svg/>'));

/* ------------------------------------------------------------------ herkennen */

describe("herkenSoort", () => {
  it("herkent de afbeeldingsformaten", () => {
    expect(herkenSoort(PNG_ECHT)?.mime).toBe("image/png");
    expect(herkenSoort(JPEG)?.mime).toBe("image/jpeg");
    expect(herkenSoort(WEBP)?.mime).toBe("image/webp");
  });

  it("herkent video", () => {
    expect(herkenSoort(MP4)?.mime).toBe("video/mp4");
    expect(herkenSoort(WEBM)?.mime).toBe("video/webm");
  });

  it("herkent audio, ook een kaal MP3-frame", () => {
    expect(herkenSoort(WAV)?.mime).toBe("audio/wav");
    expect(herkenSoort(OGG)?.mime).toBe("audio/ogg");
    expect(herkenSoort(MP3_ID3)?.mime).toBe("audio/mpeg");
    expect(herkenSoort(MP3_FRAME)?.mime).toBe("audio/mpeg");
  });

  it("houdt RIFF-varianten uit elkaar", () => {
    // WAV en WEBP beginnen allebei met RIFF; het onderscheid zit op positie 8.
    expect(herkenSoort(WEBP)?.soort).toBe("afbeelding");
    expect(herkenSoort(WAV)?.soort).toBe("audio");
  });

  it("herkent GIF niet als geldig type — die wordt geweigerd", () => {
    expect(herkenSoort(GIF)).toBeNull();
  });

  it("weigert een bijna-goede kop", () => {
    // Laatste byte van de PNG-signatuur klopt niet: 0x08 in plaats van 0x0A.
    expect(herkenSoort(PNG)).toBeNull();
  });

  it("weigert wat het niet kent", () => {
    expect(herkenSoort(kop(0x00, 0x01, 0x02))).toBeNull();
    expect(herkenSoort(new Uint8Array(0))).toBeNull();
  });
});

describe("isTekstDocument", () => {
  it("ziet een SVG", () => {
    expect(isTekstDocument(SVG)).toBe(true);
  });

  it("ziet een XML-declaratie", () => {
    expect(isTekstDocument(XML)).toBe(true);
  });

  it("laat binaire bestanden door", () => {
    expect(isTekstDocument(PNG_ECHT)).toBe(false);
    expect(isTekstDocument(MP4)).toBe(false);
  });
});

/* ------------------------------------------------------------------- keuren */

describe("controleerBestand", () => {
  const meta = (naam: string, type: string, grootte = 1024) => ({ naam, type, grootte });

  it("keurt een echte PNG op een afbeeldingsknoop goed", () => {
    const u = controleerBestand(meta("foto.png", "image/png"), PNG_ECHT, "afbeelding");
    expect(u.ok).toBe(true);
    expect(u.mime).toBe("image/png");
  });

  it("weigert een SVG, ook met een nette naam en mime", () => {
    const u = controleerBestand(meta("logo.svg", "image/svg+xml"), SVG, "afbeelding");
    expect(u.ok).toBe(false);
    expect(u.reden).toContain("scripts");
  });

  it("weigert een GIF met uitleg over de animatie", () => {
    const u = controleerBestand(meta("dans.gif", "image/gif"), GIF, "afbeelding");
    expect(u.ok).toBe(false);
    expect(u.reden).toContain("animatie");
  });

  it("weigert een MP3 die zich voordoet als PNG", () => {
    // Dit is het geval waar de magic-byte-controle voor bestaat: de extensie liegt.
    const u = controleerBestand(meta("plaatje.png", "image/png"), MP3_ID3, "afbeelding");
    expect(u.ok).toBe(false);
    expect(u.reden).toContain("audio/mpeg");
  });

  it("wijst een bestand op de verkeerde soort knoop af met een bruikbare melding", () => {
    const u = controleerBestand(meta("clip.mp4", "video/mp4"), MP4, "audio");
    expect(u.ok).toBe(false);
    expect(u.reden).toContain("video-knoop");
  });

  it("laat een afwijkende maar plausibele mime door", () => {
    // Sommige systemen melden image/jpg in plaats van image/jpeg; de hoofdgroep klopt.
    expect(controleerBestand(meta("f.jpg", "image/jpg"), JPEG, "afbeelding").ok).toBe(true);
  });

  it("laat een leeg mime-type door — dan is er niets om tegen te spreken", () => {
    expect(controleerBestand(meta("f", ""), JPEG, "afbeelding").ok).toBe(true);
  });

  it("weigert een leeg bestand", () => {
    const u = controleerBestand(meta("leeg.png", "image/png", 0), PNG_ECHT, "afbeelding");
    expect(u.ok).toBe(false);
    expect(u.reden).toContain("leeg");
  });

  it("weigert boven de grens en noemt die grens", () => {
    const groot = MAX_BYTES.afbeelding + 1;
    const u = controleerBestand(meta("groot.png", "image/png", groot), PNG_ECHT, "afbeelding");
    expect(u.ok).toBe(false);
    expect(u.reden).toContain("10.0 MB");
  });

  it("laat precies de grens toe", () => {
    const u = controleerBestand(
      meta("net-goed.png", "image/png", MAX_BYTES.afbeelding),
      PNG_ECHT,
      "afbeelding",
    );
    expect(u.ok).toBe(true);
  });

  it("heeft een ruimere grens voor video dan voor audio en afbeelding", () => {
    expect(MAX_BYTES.video).toBeGreaterThan(MAX_BYTES.audio);
    expect(MAX_BYTES.audio).toBeGreaterThan(MAX_BYTES.afbeelding);
  });
});

/* -------------------------------------------------------------------- overig */

describe("hulpjes", () => {
  it("geeft per soort een accept-lijst die alleen die soort bevat", () => {
    expect(accepteert("afbeelding").split(",").every((m) => m.startsWith("image/"))).toBe(true);
    expect(accepteert("video").split(",").every((m) => m.startsWith("video/"))).toBe(true);
    expect(accepteert("audio").split(",").every((m) => m.startsWith("audio/"))).toBe(true);
  });

  it("noemt SVG en GIF niet in de accept-lijst", () => {
    expect(accepteert("afbeelding")).not.toContain("svg");
    expect(accepteert("afbeelding")).not.toContain("gif");
  });

  it("vertaalt de soort naar de mime-hoofdgroep", () => {
    expect(mimeGroep("afbeelding")).toBe("image");
    expect(mimeGroep("video")).toBe("video");
  });

  it("schrijft groottes leesbaar op", () => {
    expect(leesbareGrootte(512)).toBe("512 B");
    expect(leesbareGrootte(2048)).toBe("2 kB");
    expect(leesbareGrootte(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
