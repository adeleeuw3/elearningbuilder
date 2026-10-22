/**
 * De schrijfroute levert versies om uit te kiezen.
 *
 * Wat hier vastligt: dat er altijd een lijst terugkomt (ook bij één versie), dat de opdracht van
 * de auteur en de context van het vorige blok er echt in gaan, en dat een model dat te veel of te
 * weinig stuurt geen kapot venster oplevert.
 *
 * Het model zelf wordt gestubd. Wat deze test bewaakt is de vorm en de randen, niet of de tekst
 * goed is — dat laatste is geen eigenschap die een test kan vaststellen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const OUD = { ...process.env };

/** Wat er aan `callGestructureerd` werd meegegeven, per aanroep. */
let aanroepen: { system: string; inhoud: string; maxTokens: number }[] = [];
/** Wat de stub teruggeeft. */
let antwoord: unknown = { varianten: ["Eén versie."] };

vi.mock("../../../../lib/claude", async () => {
  const echt = await vi.importActual<typeof import("../../../../lib/claude")>(
    "../../../../lib/claude",
  );
  return {
    ...echt,
    callGestructureerd: vi.fn((opties: Record<string, unknown>) => {
      const berichten = opties.messages as { content: string }[];
      aanroepen.push({
        system: String(opties.system),
        inhoud: berichten[0]!.content,
        maxTokens: Number(opties.maxTokens),
      });
      return Promise.resolve(antwoord);
    }),
  };
});

async function schrijf(body: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("http://localhost/api/schrijf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const BASIS = {
  opdracht: "Leg uit wat valgevaar is, voor nieuwe medewerkers.",
  titel: "Valgevaar",
  huidig: "",
  context: "",
};

beforeEach(() => {
  aanroepen = [];
  antwoord = { varianten: ["Eén versie."] };
  process.env.ANTHROPIC_API_KEY = "test";
});

afterEach(() => {
  process.env = { ...OUD };
});

describe("POST /api/schrijf", () => {
  it("levert ook bij één versie een lijst", async () => {
    // Eén vorm voor beide gevallen: anders krijgt de aanroeper twee paden die uit elkaar lopen.
    const body = await (await schrijf({ ...BASIS, aantal: 1 })).json();
    expect(body.varianten).toEqual(["Eén versie."]);
  });

  it("vraagt om zoveel versies als de auteur koos", async () => {
    antwoord = { varianten: ["A", "B", "C"] };
    const body = await (await schrijf({ ...BASIS, aantal: 3 })).json();
    expect(body.varianten).toHaveLength(3);
    expect(aanroepen[0]!.inhoud).toContain("3 versies");
    expect(aanroepen[0]!.system).toContain("verschillen die versies echt");
  });

  it("kapt af als het model er meer stuurt dan gevraagd", async () => {
    // Anders staan er zes kaarten in een venster waar je er twee vroeg.
    antwoord = { varianten: ["A", "B", "C", "D"] };
    const body = await (await schrijf({ ...BASIS, aantal: 2 })).json();
    expect(body.varianten).toEqual(["A", "B"]);
  });

  it("valt niet om als het model er minder stuurt", async () => {
    antwoord = { varianten: ["A"] };
    const res = await schrijf({ ...BASIS, aantal: 4 });
    expect(res.status).toBe(200);
    expect((await res.json()).varianten).toEqual(["A"]);
  });

  it("geeft de context van het vorige blok mee, en de huidige tekst om te herschrijven", async () => {
    await schrijf({
      ...BASIS,
      huidig: "Vanaf 2,5 meter geldt valgevaar.",
      context: "Werken op hoogte is de grootste oorzaak van ongevallen.",
      aantal: 1,
    });
    const inhoud = aanroepen[0]!.inhoud;
    expect(inhoud).toContain("Werken op hoogte is de grootste oorzaak");
    expect(inhoud).toContain("Vanaf 2,5 meter geldt valgevaar.");
    expect(inhoud).toContain(BASIS.opdracht);
  });

  it("neemt ruimte naar het aantal versies — afkappen midden in een variant is onbruikbaar", async () => {
    await schrijf({ ...BASIS, aantal: 1 });
    const bijEen = aanroepen[0]!.maxTokens;
    aanroepen = [];
    antwoord = { varianten: ["A", "B", "C", "D"] };
    await schrijf({ ...BASIS, aantal: 4 });
    expect(aanroepen[0]!.maxTokens).toBeGreaterThan(bijEen);
  });

  it("weigert zonder opdracht", async () => {
    expect((await schrijf({ ...BASIS, opdracht: "" })).status).toBe(400);
  });

  it("weigert een aantal buiten het bereik", async () => {
    expect((await schrijf({ ...BASIS, aantal: 0 })).status).toBe(400);
    expect((await schrijf({ ...BASIS, aantal: 9 })).status).toBe(400);
  });

  it("weigert een verzonnen veld — het schema is dicht", async () => {
    expect((await schrijf({ ...BASIS, aantal: 1, stiekem: true })).status).toBe(400);
  });
});
