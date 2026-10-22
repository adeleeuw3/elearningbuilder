/**
 * De zoekroute. Wat hier vastligt is vooral wat er níét gebeurt: geen sleutel in het antwoord,
 * geen aanvraag naar een adres dat niet in de lijst staat, en geen stilte als een bron ontbreekt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const OUD = { ...process.env };

/** Elke fetch die de route doet, met het adres erbij. */
let aanroepen: { url: string; headers: Record<string, string> }[] = [];

function stubProviders(antwoorden: Record<string, unknown>) {
  aanroepen = [];
  vi.stubGlobal("fetch", (invoer: URL | string | Request, init?: RequestInit) => {
    const url = String(invoer instanceof Request ? invoer.url : invoer);
    aanroepen.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const sleutel = Object.keys(antwoorden).find((k) => url.includes(k));
    if (!sleutel) return Promise.resolve(new Response(null, { status: 404 }));
    return Promise.resolve(
      new Response(JSON.stringify(antwoorden[sleutel]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
}

const PEXELS_FOTO = {
  photos: [
    {
      id: 1,
      width: 1920,
      height: 1080,
      url: "https://www.pexels.com/photo/1/",
      photographer: "Ada",
      photographer_url: "https://www.pexels.com/@ada",
      alt: "Een serverruimte",
      src: { large2x: "https://images.pexels.com/photos/1/x.jpg", medium: "https://images.pexels.com/photos/1/m.jpg" },
    },
  ],
};

const PIXABAY_FOTO = {
  hits: [
    {
      id: 2,
      pageURL: "https://pixabay.com/photos/2/",
      previewURL: "https://cdn.pixabay.com/2-klein.jpg",
      webformatURL: "https://pixabay.com/get/2-web.jpg",
      largeImageURL: "https://pixabay.com/get/2-groot.jpg",
      tags: "server, netwerk",
      user: "Grace",
    },
  ],
};

const YOUTUBE = {
  items: [
    {
      id: { videoId: "vid123" },
      snippet: { title: "Wat is phishing?", channelTitle: "Politie", thumbnails: { medium: { url: "https://i.ytimg.com/vi/vid123/m.jpg" } } },
    },
  ],
};

async function zoek(body: unknown) {
  const { POST } = await import("../zoek/route");
  return POST(
    new Request("http://localhost/api/media/zoek", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  delete process.env.PEXELS_API_KEY;
  delete process.env.PIXABAY_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...OUD };
});

describe("POST /api/media/zoek", () => {
  it("weigert leesbaar als er geen enkele bron is ingesteld", async () => {
    stubProviders({});
    const res = await zoek({ term: "cybercrime", soorten: ["afbeelding"] });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("geen_api_key");
    expect(body.bericht).toContain("PEXELS_API_KEY");
  });

  it("werkt met één bron en zegt welke er ontbreekt", async () => {
    process.env.PEXELS_API_KEY = "pex-geheim";
    stubProviders({ "api.pexels.com": PEXELS_FOTO });

    const res = await zoek({ term: "cybercrime serverruimte", soorten: ["afbeelding"] });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.bronnen).toEqual(["pexels"]);
    expect(body.ontbrekend).toContain("pixabay");
    expect(body.kandidaten.afbeelding).toHaveLength(1);
    expect(body.kandidaten.afbeelding[0]).toMatchObject({ bron: "pexels", maker: "Ada" });
  });

  it("mengt de bronnen in plaats van er één voorop te zetten", async () => {
    process.env.PEXELS_API_KEY = "pex";
    process.env.PIXABAY_API_KEY = "pix";
    stubProviders({ "api.pexels.com": PEXELS_FOTO, "pixabay.com/api": PIXABAY_FOTO });

    const body = await (await zoek({ term: "server", soorten: ["afbeelding"] })).json();
    expect(body.kandidaten.afbeelding.map((k: { bron: string }) => k.bron)).toEqual([
      "pexels",
      "pixabay",
    ]);
  });

  it("laat geen enkele sleutel in het antwoord terechtkomen", async () => {
    // Pixabay zet zijn sleutel in de query-string; die staat dus in adressen die we intern
    // bouwen. Als daar ooit iets van in een kandidaat belandt, ligt de sleutel op straat.
    process.env.PEXELS_API_KEY = "pex-geheim-abc";
    process.env.PIXABAY_API_KEY = "pix-geheim-xyz";
    stubProviders({ "api.pexels.com": PEXELS_FOTO, "pixabay.com/api": PIXABAY_FOTO });

    const tekst = await (await zoek({ term: "server", soorten: ["afbeelding"] })).text();
    expect(tekst).not.toContain("pex-geheim-abc");
    expect(tekst).not.toContain("pix-geheim-xyz");
  });

  it("vraagt YouTube alleen als er om een externe video gevraagd wordt", async () => {
    process.env.PEXELS_API_KEY = "pex";
    process.env.YOUTUBE_API_KEY = "yt";
    stubProviders({ "api.pexels.com": PEXELS_FOTO, googleapis: YOUTUBE });

    await zoek({ term: "phishing", soorten: ["afbeelding"] });
    expect(aanroepen.some((a) => a.url.includes("googleapis"))).toBe(false);

    await zoek({ term: "phishing", soorten: ["externe-video"] });
    expect(aanroepen.some((a) => a.url.includes("googleapis"))).toBe(true);
  });

  it("vraagt YouTube alleen om video's die de eigenaar laat insluiten", async () => {
    // Zonder dat filter komen er video's terug die niemand kan afspelen in de cursus.
    process.env.YOUTUBE_API_KEY = "yt";
    stubProviders({ googleapis: YOUTUBE });
    await zoek({ term: "phishing", soorten: ["externe-video"] });
    const vraag = aanroepen.find((a) => a.url.includes("googleapis"))!;
    expect(vraag.url).toContain("videoEmbeddable=true");
    expect(vraag.url).toContain("safeSearch=strict");
  });

  it("levert een YouTube-keuze zonder bestand — die wordt ingesloten, niet gedownload", async () => {
    process.env.YOUTUBE_API_KEY = "yt";
    stubProviders({ googleapis: YOUTUBE });
    const body = await (await zoek({ term: "phishing", soorten: ["externe-video"] })).json();
    const k = body.kandidaten["externe-video"][0];
    expect(k.videoId).toBe("vid123");
    expect(k.bestandUrl).toBeUndefined();
  });

  it("belt alleen adressen die in de lijst staan", async () => {
    process.env.PEXELS_API_KEY = "pex";
    process.env.PIXABAY_API_KEY = "pix";
    process.env.YOUTUBE_API_KEY = "yt";
    stubProviders({ "api.pexels.com": PEXELS_FOTO, "pixabay.com/api": PIXABAY_FOTO, googleapis: YOUTUBE });

    await zoek({ term: "server", soorten: ["afbeelding", "video", "externe-video"] });
    const hosts = [...new Set(aanroepen.map((a) => new URL(a.url).hostname))];
    expect(hosts.sort()).toEqual(["api.pexels.com", "pixabay.com", "www.googleapis.com"]);
  });

  it("laat de andere bronnen doorgaan als er één stukgaat", async () => {
    process.env.PEXELS_API_KEY = "pex";
    process.env.PIXABAY_API_KEY = "pix";
    // Pixabay geeft niets terug (404 uit de stub); Pexels wel.
    stubProviders({ "api.pexels.com": PEXELS_FOTO });

    const body = await (await zoek({ term: "server", soorten: ["afbeelding"] })).json();
    expect(body.kandidaten.afbeelding).toHaveLength(1);
    expect(body.kandidaten.afbeelding[0].bron).toBe("pexels");
  });

  it("weigert zonder zoekopdracht", async () => {
    process.env.PEXELS_API_KEY = "pex";
    stubProviders({});
    expect((await zoek({ term: "   ", soorten: ["afbeelding"] })).status).toBe(400);
    expect((await zoek({})).status).toBe(400);
  });
});
