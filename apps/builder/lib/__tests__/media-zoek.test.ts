/**
 * De vertaling van providerantwoorden naar één vorm.
 *
 * De voorbeelden hieronder zijn de echte veldnamen uit de documentatie van Pexels en Pixabay en uit
 * een echte respons van de YouTube Data API. Dat is het punt van deze tests: als een van die vormen
 * verandert, faalt hier iets — in plaats van dat er een kandidaat zonder plaatje in het
 * keuzevenster verschijnt, wat je pas ziet als een auteur er tegenaan loopt.
 */
import { describe, it, expect } from "vitest";
import {
  alsZin,
  besteVideobestand,
  mengEnBeperk,
  uitPexelsFotos,
  uitPexelsVideos,
  uitPixabayFotos,
  uitPixabayVideos,
  uitYoutube,
  zoekterm,
  type Kandidaat,
} from "../media-zoek";

describe("Pexels", () => {
  const foto = {
    photos: [
      {
        id: 2014422,
        width: 3024,
        height: 3024,
        url: "https://www.pexels.com/photo/brown-rocks-2014422/",
        photographer: "Joey Farina",
        photographer_url: "https://www.pexels.com/@joey",
        alt: "Brown Rocks During Golden Hour",
        src: {
          original: "https://images.pexels.com/photos/2014422/pexels-photo.jpeg",
          large2x: "https://images.pexels.com/photos/2014422/pexels-photo.jpeg?w=1880",
          large: "https://images.pexels.com/photos/2014422/pexels-photo.jpeg?w=940",
          medium: "https://images.pexels.com/photos/2014422/pexels-photo.jpeg?h=350",
          tiny: "https://images.pexels.com/photos/2014422/pexels-photo.jpeg?h=130",
        },
      },
    ],
  };

  it("neemt maker, licentie en alt-voorstel over", () => {
    const [k] = uitPexelsFotos(foto);
    expect(k).toMatchObject({
      id: "pexels:2014422",
      bron: "pexels",
      soort: "afbeelding",
      maker: "Joey Farina",
      makerUrl: "https://www.pexels.com/@joey",
      alt: "Brown Rocks During Golden Hour",
      breedte: 3024,
    });
    expect(k!.licentie).toContain("Pexels");
  });

  it("pakt niet het origineel maar een schermformaat", () => {
    // Origineel is bij Pexels regelmatig 5000px en tientallen megabytes; dat moet de cursist
    // straks downloaden.
    const [k] = uitPexelsFotos(foto);
    expect(k!.bestandUrl).toContain("w=1880");
    expect(k!.voorbeeld).toContain("h=350");
  });

  it("kiest het grootste mp4-bestand dat niet breder is dan het scherm", () => {
    const bestanden = [
      { link: "a", file_type: "video/mp4", width: 640, height: 360, quality: "sd" },
      { link: "b", file_type: "video/mp4", width: 1920, height: 1080, quality: "hd" },
      { link: "c", file_type: "video/mp4", width: 3840, height: 2160, quality: "uhd" },
      { link: "d", file_type: "video/webm", width: 1920, height: 1080, quality: "hd" },
    ];
    expect(besteVideobestand(bestanden)).toBe("b");
  });

  it("valt terug op het kleinste dat er is als alles te groot is", () => {
    const bestanden = [
      { link: "groot", file_type: "video/mp4", width: 3840, height: 2160, quality: "uhd" },
    ];
    expect(besteVideobestand(bestanden)).toBe("groot");
  });

  it("laat een video zonder bruikbaar bestand weg", () => {
    // Een kandidaat zonder bestand is een knop die niets doet.
    const uit = uitPexelsVideos({
      videos: [
        { id: 1, width: 1, height: 1, url: "u", image: "i", duration: 5, video_files: [] },
        {
          id: 2,
          width: 1920,
          height: 1080,
          url: "https://www.pexels.com/video/2/",
          image: "https://images.pexels.com/videos/2/thumb.jpg",
          duration: 12,
          user: { name: "Ruvim", url: "https://www.pexels.com/@ruvim" },
          video_files: [{ link: "https://videos.pexels.com/2.mp4", file_type: "video/mp4", width: 1280, height: 720, quality: "hd" }],
        },
      ],
    });
    expect(uit).toHaveLength(1);
    expect(uit[0]).toMatchObject({ id: "pexels:v2", maker: "Ruvim", seconden: 12 });
  });
});

describe("Pixabay", () => {
  it("maakt van de trefwoordenlijst een leesbare omschrijving", () => {
    expect(alsZin("cyber security, hacker, laptop")).toBe("Cyber security, hacker, laptop");
    expect(alsZin("  ")).toBe("");
  });

  it("neemt de grote versie als bestand en de webformat als voorbeeld", () => {
    const [k] = uitPixabayFotos({
      hits: [
        {
          id: 195893,
          pageURL: "https://pixabay.com/photos/blossom-bloom-flower-195893/",
          previewURL: "https://cdn.pixabay.com/photo/2013/klein.jpg",
          webformatURL: "https://pixabay.com/get/web.jpg",
          largeImageURL: "https://pixabay.com/get/groot.jpg",
          tags: "blossom, bloom, flower",
          user: "Josch13",
          imageWidth: 4000,
          imageHeight: 2667,
        },
      ],
    });
    expect(k).toMatchObject({
      id: "pixabay:195893",
      bestandUrl: "https://pixabay.com/get/groot.jpg",
      voorbeeld: "https://pixabay.com/get/web.jpg",
      maker: "Josch13",
      alt: "Blossom, bloom, flower",
      breedte: 4000,
    });
  });

  it("kiest bij video de middenmaat, niet de grootste", () => {
    const [k] = uitPixabayVideos({
      hits: [
        {
          id: 125,
          pageURL: "https://pixabay.com/videos/id-125/",
          duration: 12,
          tags: "flowers, nature",
          user: "Coverr-Free-Footage",
          videos: {
            large: { url: "https://cdn.pixabay.com/groot.mp4", width: 1920, height: 1080, thumbnail: "g.jpg" },
            medium: { url: "https://cdn.pixabay.com/midden.mp4", width: 1280, height: 720, thumbnail: "m.jpg" },
            small: { url: "https://cdn.pixabay.com/klein.mp4", width: 640, height: 360, thumbnail: "k.jpg" },
          },
        },
      ],
    });
    expect(k!.bestandUrl).toContain("midden.mp4");
    expect(k!.voorbeeld).toBe("m.jpg");
    expect(k!.seconden).toBe(12);
  });
});

describe("YouTube", () => {
  const antwoord = {
    items: [
      {
        id: { kind: "youtube#video", videoId: "aBcD1234efg" },
        snippet: {
          title: "Wat is phishing?",
          description: "Uitleg in drie minuten.",
          channelTitle: "Politie",
          thumbnails: {
            default: { url: "https://i.ytimg.com/vi/aBcD1234efg/default.jpg" },
            medium: { url: "https://i.ytimg.com/vi/aBcD1234efg/mqdefault.jpg" },
          },
        },
      },
      { id: { kind: "youtube#channel", channelId: "UC123" }, snippet: { title: "Kanaal" } },
    ],
  };

  it("levert een externe video zonder bestand — downloaden mag niet", () => {
    const [k] = uitYoutube(antwoord);
    expect(k).toMatchObject({
      id: "youtube:aBcD1234efg",
      soort: "externe-video",
      videoId: "aBcD1234efg",
      maker: "Politie",
      paginaUrl: "https://www.youtube.com/watch?v=aBcD1234efg",
    });
    // Geen `bestandUrl`: een veld dat er wél staat maar niet gebruikt mag worden nodigt uit om
    // het toch te gebruiken.
    expect(k!.bestandUrl).toBeUndefined();
    expect(k!.licentie).toContain("niet downloaden");
  });

  it("laat resultaten zonder video-id weg", () => {
    expect(uitYoutube(antwoord)).toHaveLength(1);
  });
});

describe("mengEnBeperk", () => {
  const k = (id: string): Kandidaat => ({
    id,
    bron: "pexels",
    soort: "afbeelding",
    titel: id,
    voorbeeld: "",
    paginaUrl: "",
    maker: "",
    licentie: "",
  });

  it("pakt om de beurt uit elke bron", () => {
    const uit = mengEnBeperk([[k("a1"), k("a2"), k("a3")], [k("b1"), k("b2")]], 5);
    expect(uit.map((x) => x.id)).toEqual(["a1", "b1", "a2", "b2", "a3"]);
  });

  it("houdt er precies zoveel over als gevraagd", () => {
    expect(mengEnBeperk([[k("a1"), k("a2"), k("a3")]], 2)).toHaveLength(2);
  });

  it("toont hetzelfde resultaat niet twee keer", () => {
    const uit = mengEnBeperk([[k("x")], [k("x")], [k("y")]], 5);
    expect(uit.map((x) => x.id)).toEqual(["x", "y"]);
  });

  it("valt niet om als een bron niets teruggaf", () => {
    expect(mengEnBeperk([[], [k("b1")]], 5).map((x) => x.id)).toEqual(["b1"]);
    expect(mengEnBeperk([], 5)).toEqual([]);
  });
});

describe("zoekterm", () => {
  it("maakt van een zin een trefwoordenreeks", () => {
    expect(zoekterm("Cybercrime aanpakken doe je niet alleen, samen met de keten!")).toBe(
      "Cybercrime aanpakken doe je niet alleen",
    );
  });

  it("haalt leestekens weg die de bronnen niet begrijpen", () => {
    expect(zoekterm('"phishing" & e-mail')).toBe("phishing e-mail");
  });

  it("levert een lege term op bij lege invoer", () => {
    expect(zoekterm("   ")).toBe("");
  });
});
