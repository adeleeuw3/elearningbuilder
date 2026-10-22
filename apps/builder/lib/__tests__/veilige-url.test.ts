/**
 * De SSRF-poort. Dit is een beveiligingsgrens, dus staat hier niet alleen wat er door mag maar
 * vooral wat er níét door mag — en de omzeilingen die daar in de praktijk voor gebruikt worden.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { haalVeilig, isLetterlijkIp, keurUrl, MEDIA_HOSTS } from "../veilige-url";

const HOSTS = ["images.pexels.com", "pixabay.com"] as const;

afterEach(() => vi.unstubAllGlobals());

describe("keurUrl", () => {
  it("laat een adres van een toegestane host door", () => {
    const uit = keurUrl("https://images.pexels.com/photos/1/x.jpg", HOSTS);
    expect(uit.ok).toBe(true);
    expect(uit.ok && uit.url.hostname).toBe("images.pexels.com");
  });

  it("laat een subdomein van een toegestane host door", () => {
    expect(keurUrl("https://cdn.pixabay.com/photo/x.jpg", HOSTS).ok).toBe(true);
  });

  it("weigert een host die er alleen op lijkt", () => {
    // De klassieker: `pixabay.com.kwaadaardig.example` eindigt niet op `.pixabay.com`.
    expect(keurUrl("https://pixabay.com.kwaadaardig.example/x.jpg", HOSTS).ok).toBe(false);
    expect(keurUrl("https://nietpixabay.com/x.jpg", HOSTS).ok).toBe(false);
  });

  it("weigert alles wat geen https is", () => {
    expect(keurUrl("http://images.pexels.com/x.jpg", HOSTS).ok).toBe(false);
    expect(keurUrl("file:///etc/passwd", HOSTS).ok).toBe(false);
    expect(keurUrl("gopher://images.pexels.com/x", HOSTS).ok).toBe(false);
  });

  it("weigert inloggegevens in de URL", () => {
    // `https://images.pexels.com@intern.example/` wijst naar intern.example, niet naar Pexels.
    const uit = keurUrl("https://images.pexels.com:wachtwoord@intern.example/x", HOSTS);
    expect(uit.ok).toBe(false);
  });

  it("weigert een andere poort", () => {
    expect(keurUrl("https://images.pexels.com:8080/x.jpg", HOSTS).ok).toBe(false);
  });

  it("weigert letterlijke adressen, in welke notatie dan ook", () => {
    for (const adres of [
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data/",
      "https://2130706433/x", // decimaal voor 127.0.0.1
      "https://0x7f.1/x", // hexadecimaal
      "https://[::1]/x",
      "https://[fd00::1]/x",
    ]) {
      expect(keurUrl(adres, [...HOSTS, "127.0.0.1"]).ok, adres).toBe(false);
    }
  });

  it("trapt niet in hoofdletters of een punt aan het eind", () => {
    // Voor DNS zijn dit dezelfde host; zonder normaliseren staat er één van de twee niet in de lijst.
    expect(keurUrl("https://IMAGES.PEXELS.COM/x.jpg", HOSTS).ok).toBe(true);
    expect(keurUrl("https://images.pexels.com./x.jpg", HOSTS).ok).toBe(true);
  });

  it("weigert wat geen URL is", () => {
    expect(keurUrl("images.pexels.com/x.jpg", HOSTS).ok).toBe(false);
    expect(keurUrl("", HOSTS).ok).toBe(false);
  });

  it("heeft geen host in de eigen lijst staan die naar onszelf wijst", () => {
    for (const h of MEDIA_HOSTS) {
      expect(isLetterlijkIp(h), h).toBe(false);
      expect(h).not.toContain("localhost");
    }
  });
});

describe("haalVeilig", () => {
  const bytes = (n: number) => new Uint8Array(n).fill(65);

  function stub(antwoorden: ((url: string) => Response)[]) {
    let i = 0;
    vi.stubGlobal("fetch", (url: URL | string) => {
      const maker = antwoorden[Math.min(i, antwoorden.length - 1)]!;
      i += 1;
      return Promise.resolve(maker(String(url)));
    });
  }

  it("haalt bytes op van een toegestane host", async () => {
    stub([() => new Response(bytes(10), { status: 200, headers: { "content-type": "image/png" } })]);
    const uit = await haalVeilig("https://images.pexels.com/x.png", HOSTS, 1000);
    expect(uit.ok).toBe(true);
    expect(uit.ok && uit.bytes.byteLength).toBe(10);
    expect(uit.ok && uit.mime).toBe("image/png");
  });

  it("keurt een omleiding opnieuw in plaats van hem te volgen", async () => {
    // Dit is waarom `redirect: "manual"` erin staat: een toegestane host die doorstuurt naar een
    // intern adres zou anders de hele poort omzeilen.
    stub([
      () => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/" } }),
    ]);
    const uit = await haalVeilig("https://images.pexels.com/x.png", HOSTS, 1000);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.reden).toContain("letterlijk IP");
  });

  it("volgt een omleiding die binnen de lijst blijft", async () => {
    stub([
      () => new Response(null, { status: 301, headers: { location: "https://cdn.pixabay.com/y.png" } }),
      () => new Response(bytes(4), { status: 200, headers: { "content-type": "image/png" } }),
    ]);
    const uit = await haalVeilig("https://images.pexels.com/x.png", HOSTS, 1000);
    expect(uit.ok).toBe(true);
  });

  it("stopt bij een omleidingslus", async () => {
    stub([
      () => new Response(null, { status: 302, headers: { location: "https://pixabay.com/rond" } }),
    ]);
    const uit = await haalVeilig("https://pixabay.com/rond", HOSTS, 1000);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.reden).toContain("doorsturen");
  });

  it("kapt af op de bovengrens tijdens het lezen, niet op de content-length", async () => {
    // De kop komt van de andere kant; wie hem vertrouwt kan een pakket van gigabytes binnenhalen.
    stub([
      () =>
        new Response(bytes(5000), {
          status: 200,
          headers: { "content-type": "image/png", "content-length": "10" },
        }),
    ]);
    const uit = await haalVeilig("https://images.pexels.com/x.png", HOSTS, 1000);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.reden).toContain("groter");
  });

  it("meldt een fout van de bron in plaats van te werpen", async () => {
    stub([() => new Response(null, { status: 503 })]);
    const uit = await haalVeilig("https://images.pexels.com/x.png", HOSTS, 1000);
    expect(uit.ok).toBe(false);
    expect(!uit.ok && uit.reden).toContain("503");
  });

  it("raakt het netwerk niet eens voor een host buiten de lijst", async () => {
    // Dit is de kern: de weigering komt vóór het verzoek. Weigeren ná het ophalen zou de
    // aanvraag alsnog verstuurd hebben, en dat is precies wat SSRF nodig heeft.
    const nep = vi.fn(() => Promise.resolve(new Response(bytes(10), { status: 200 })));
    vi.stubGlobal("fetch", nep);
    const uit = await haalVeilig("https://intern.example/geheim", HOSTS, 1000);
    expect(uit.ok).toBe(false);
    expect(nep).not.toHaveBeenCalled();
  });
});
