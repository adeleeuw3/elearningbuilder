/**
 * Bijzondere vormen bij een sectie: citaat, carrousel en volle-breedte beeld.
 *
 * De generator kende drie bouwstenen — proza, meerkeuze, open vraag — terwijl de speler er zes
 * kan tonen. Het resultaat was altijd dezelfde vorm: lezen, lezen, lezen, toets.
 *
 * Twee dingen gaan hier stil fout. Een extra waarvan het model de velden leeg liet levert een blok
 * op dat er is maar niets toont; en een carrousel die náást zijn eigen uitleg komt te staan laat
 * de cursist dezelfde inhoud twee keer doornemen.
 */
import { describe, it, expect } from "vitest";
import { bouwLeerpad, bruikbareExtra } from "../graph";
import { contentMetTekst, controleerLeerpad, leesTekst, leerpadUitContent } from "../leerpad";
import { naarObservatieDocument } from "../export";
import type { Extra, GeneratedContent } from "../types";

const sectie = (kop: string, extra?: Extra) => ({
  type: "uitleg" as const,
  kop,
  tekst: `De uitleg bij ${kop}.`,
  ...(extra ? { extra } : {}),
});

const content = (secties: ReturnType<typeof sectie>[]): GeneratedContent => ({
  titel: "Veilig werken",
  intro: "Een inleiding.",
  secties,
  vragen: [],
  samenvatting: "Een slot.",
});

const CITAAT: Extra = { vorm: "citaat", citaat: "De relatie staat niet ter discussie." };
const CARROUSEL: Extra = {
  vorm: "carrousel",
  stappen: [
    { kop: "Stap 1", tekst: "Eerst dit." },
    { kop: "Stap 2", tekst: "Dan dat." },
  ],
};
const BEELD: Extra = { vorm: "beeld", beeldterm: "warehouse safety" };

describe("bruikbareExtra", () => {
  it("laat een citaat zonder tekst vallen", () => {
    expect(bruikbareExtra({ vorm: "citaat" })).toBeUndefined();
    expect(bruikbareExtra({ vorm: "citaat", citaat: "   " })).toBeUndefined();
    expect(bruikbareExtra(CITAAT)).toEqual(CITAAT);
  });

  it("laat een carrousel van één stap vallen", () => {
    // Eén stap is geen carrousel: er valt niets door te klikken. De exporter weigert hem ook, maar
    // dat is te laat — dan staat het blok al op het canvas.
    expect(bruikbareExtra({ vorm: "carrousel", stappen: [{ kop: "A", tekst: "B" }] })).toBeUndefined();
    expect(bruikbareExtra({ vorm: "carrousel", stappen: [] })).toBeUndefined();
    expect(bruikbareExtra(CARROUSEL)?.stappen).toHaveLength(2);
  });

  it("gooit lege stappen weg voordat hij telt", () => {
    const met = bruikbareExtra({
      vorm: "carrousel",
      stappen: [{ kop: "A", tekst: "B" }, { kop: "  ", tekst: "  " }],
    });
    expect(met).toBeUndefined();
  });
});

describe("de generator zet de extra's in de keten", () => {
  it("zet een citaat ná zijn sectie, met dezelfde index", () => {
    const knopen = bouwLeerpad(content([sectie("Eerste", CITAAT), sectie("Tweede")])).knopen;
    const ids = knopen.filter((k) => /^[se]\d/.test(k.id)).map((k) => k.id);
    expect(ids).toEqual(["s0", "e0", "s1"]);

    const citaat = knopen.find((k) => k.id === "e0")!;
    expect(citaat.soort).toBe("citaat");
    // Dezelfde index als zijn sectie: zo blijft de koppeling staan als de keten herschikt wordt.
    expect(citaat.index).toBe(0);
  });

  it("laat de alinea vóór een carrousel staan in plaats van hem te vervangen", () => {
    // Eerst verving de carrousel de uitleg. Een echte generatie liet zien wat dat weggooit: het
    // model schrijft een korte kadering, en die hoort vóór de stappen te staan. Een stappenreeks
    // zonder aanloop is een lijst, geen uitleg.
    const knopen = bouwLeerpad(content([sectie("Procedure", CARROUSEL)])).knopen;
    expect(knopen.find((k) => k.id === "s0")?.soort).toBe("uitleg");
    const car = knopen.find((k) => k.id === "e0")!;
    expect(car.soort).toBe("carrousel");
    expect(car.items).toHaveLength(2);
    // En in die volgorde: eerst lezen, dan doorklikken.
    expect(knopen.findIndex((k) => k.id === "s0")).toBeLessThan(
      knopen.findIndex((k) => k.id === "e0"),
    );
  });

  it("laat een beeld-extra náást de uitleg staan", () => {
    const knopen = bouwLeerpad(content([sectie("Werkplek", BEELD)])).knopen;
    expect(knopen.find((k) => k.id === "s0")?.soort).toBe("uitleg");
    expect(knopen.find((k) => k.id === "e0")?.soort).toBe("afbeelding");
    // Zonder bestand is hij niet af; de beeldkeuze of het whiteboard moet er nog een bij zoeken.
    expect(knopen.find((k) => k.id === "e0")?.klaar).toBe(false);
  });

  it("negeert een onbruikbare extra in plaats van een leeg blok te maken", () => {
    const knopen = bouwLeerpad(content([sectie("Eerste", { vorm: "citaat" })])).knopen;
    expect(knopen.some((k) => k.id === "e0")).toBe(false);
    expect(knopen.find((k) => k.id === "s0")?.soort).toBe("uitleg");
  });

  it("houdt de extra's op de inhoudsbaan, niet bij de toets", () => {
    const knopen = bouwLeerpad(content([sectie("Eerste", CITAAT)])).knopen;
    const sectieY = knopen.find((k) => k.id === "s0")!.y;
    expect(knopen.find((k) => k.id === "e0")!.y).toBe(sectieY);
  });
});

describe("de tekst van het citaat staat op één plek", () => {
  it("leest hem uit de content en niet van de knoop", () => {
    const c = content([sectie("Eerste", CITAAT)]);
    const citaat = bouwLeerpad(c).knopen.find((k) => k.soort === "citaat")!;
    expect(leesTekst(citaat, c)).toBe(CITAAT.citaat);
  });

  it("schrijft een wijziging terug naar de extra van die sectie", () => {
    const c = content([sectie("Eerste", CITAAT)]);
    const citaat = bouwLeerpad(c).knopen.find((k) => k.soort === "citaat")!;
    const na = contentMetTekst(citaat, c, "Een ander principe.");
    expect(na?.secties[0]?.extra?.citaat).toBe("Een ander principe.");
    // En de sectie zelf blijft staan.
    expect(na?.secties[0]?.tekst).toBe(c.secties[0]!.tekst);
  });
});

describe("afwisseling is een streefgetal, geen eis", () => {
  const veel = (extras: (Extra | undefined)[]) =>
    content(extras.map((e, i) => sectie(`Sectie ${i + 1}`, e)));

  it("meldt het als er te weinig afwisseling is, maar blokkeert niet", () => {
    const l = leerpadUitContent(veel([undefined, undefined, undefined, undefined]));
    const problemen = controleerLeerpad(l);
    const melding = problemen.find((p) => p.code === "weinig-afwisseling");
    expect(melding?.ernst).toBe("let-op");
    expect(problemen.filter((p) => p.ernst === "blokkeert")).toEqual([]);
  });

  it("zwijgt zodra het er drie zijn mét een citaat", () => {
    const l = leerpadUitContent(veel([CITAAT, BEELD, CARROUSEL, undefined]));
    expect(controleerLeerpad(l).some((p) => p.code === "weinig-afwisseling")).toBe(false);
  });

  it("meldt het ook bij drie vormen zonder citaat", () => {
    // Het citaat is apart gevraagd; drie beelden halen het streefgetal niet.
    const l = leerpadUitContent(veel([BEELD, BEELD, BEELD, undefined]));
    const melding = controleerLeerpad(l).find((p) => p.code === "weinig-afwisseling");
    expect(melding?.bericht).toContain("geen citaat");
  });

  it("zwijgt over een module die nog te klein is om af te wisselen", () => {
    const l = leerpadUitContent(content([sectie("Enige")]));
    expect(controleerLeerpad(l).some((p) => p.code === "weinig-afwisseling")).toBe(false);
  });
});

describe("het pakket", () => {
  it("weigert een beeld-extra waar nog geen afbeelding bij gezocht is", () => {
    // `content.html` is bij een beeldblok leeg — de tekst staat in de sectie ernaast. Zonder
    // bestand exporteert dit dus als een sectie waar niets in staat. Niets faalt; er is alleen
    // niets te zien. Dezelfde fout als een citaat zonder tekst, en die werd al geweigerd.
    const c = content([sectie("Werkplek", BEELD)]);
    const uit = naarObservatieDocument({
      leerpad: leerpadUitContent(c),
      content: c,
      artifactId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      iriBase: "https://xapi.example.com/acme",
    });
    expect(uit.ok).toBe(false);
    if (uit.ok) return;
    expect(uit.redenen.join(" ")).toContain("heeft nog geen afbeelding");
  });


  it("zet het citaat als eigen blok neer, met zijn tekst", () => {
    const c = content([sectie("Eerste", CITAAT), sectie("Tweede", CARROUSEL)]);
    const uit = naarObservatieDocument({
      leerpad: leerpadUitContent(c),
      content: c,
      artifactId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      iriBase: "https://xapi.example.com/acme",
    });
    if (!uit.ok) throw new Error(uit.redenen.join(" | "));

    const blokken = uit.doc.pages.flatMap((p) => (p.kind === "stack" ? p.blocks : []));
    const citaat = blokken.find((b) => b.kind === "quote");
    if (citaat?.kind !== "quote") throw new Error("verwachtte een citaatblok");
    expect(citaat.content.html).toContain(CITAAT.citaat!);
    // Zonder naam, dus zonder bronvermelding: anders suggereert het dat iemand dit gezegd heeft.
    expect(citaat.attribution).toBeUndefined();

    const carrousel = blokken.find((b) => b.kind === "carousel");
    if (carrousel?.kind !== "carousel") throw new Error("verwachtte een carrouselblok");
    expect(carrousel.items).toHaveLength(2);
  });
});
