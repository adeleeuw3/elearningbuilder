/**
 * De huisstijl: komt elk pakket er hetzelfde uit te zien?
 *
 * De belofte is scherper dan "het ziet er netjes uit": de vormgeving komt uit `lib/thema.ts` en
 * nergens anders vandaan. Dat is te controleren, en deze tests doen dat op de enige manier die
 * standhoudt — niet door te kijken of het thema werkt, maar door te weigeren wat het thema zou
 * omzeilen. Een losse hexkleur in de stylesheet van de speler is geen schoonheidsfout; het is een
 * kleur die een volgend thema niet meer kan veranderen.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanText } from "../../../../packages/exporter/src/secret-scan";
import { APP_CSS, indexHtml, laadtitels, merkHtml } from "../shell";
import { HUISSTIJL, svgUrl, themaCss } from "../thema";

describe("het thema is de enige bron van vormgeving", () => {
  it("laat geen enkele kleur in de speler zelf staan", () => {
    const bron = readFileSync(join(__dirname, "..", "shell.ts"), "utf8");

    // `&#8635;` is een HTML-entiteit, geen kleur; daarom mag er geen `&` voor staan.
    const kleuren = [...bron.matchAll(/(^|[^&])(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?)\b/g)]
      .flatMap((m) => (m[2] ? [m[2]] : []))
      // Een anker in een url (`#merkverloop`) is geen kleur: die heeft geen hex-vorm van 3, 6 of 8.
      .filter((h) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(h));

    expect(kleuren).toEqual([]);
  });

  it("zet elke kleur uit het thema ook echt in de stylesheet", () => {
    const css = themaCss();
    const ontbreekt = Object.entries(HUISSTIJL.kleuren)
      .filter(([, waarde]) => !css.includes(waarde))
      .map(([naam]) => naam);

    // Een kleur die wel in het thema staat maar niet in de CSS komt, is een kleur waarvan je denkt
    // dat je hem kunt veranderen terwijl dat niet zo is.
    expect(ontbreekt).toEqual([]);
  });

  it("gebruikt de springs uit het ontwerpsysteem en vlakt ze af bij reduced-motion", () => {
    const css = themaCss();
    expect(css).toContain(HUISSTIJL.beweging.flow);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    // Na de media-query mag er geen overshoot meer staan: `linear(...)` is de spring-curve.
    const na = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(na).not.toContain("linear(");
  });

  it("laat de secret-scan niet afgaan op de tekeningen in de sfeerlaag", () => {
    // De figuren zijn percent-gecodeerd en niet base64, juist omdat `high-entropy-literal` een
    // lange base64-reeks tussen aanhalingstekens als mogelijke sleutel ziet. Zou dat veranderen,
    // dan blokkeert de export zichzelf — en dat merk je pas bij het zippen.
    expect(scanText("app.css", APP_CSS)).toEqual([]);
  });
});

describe("svgUrl", () => {
  it("codeert wat een CSS-url breekt en laat de rest met rust", () => {
    const uit = svgUrl("<svg fill='#0B6FBF'><path d='M0 0h1'/></svg>");
    expect(uit.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(uit).not.toContain("<");
    expect(uit).not.toContain(">");
    expect(uit).toContain("%23"); // de # van de kleur
    expect(uit).toContain("M0 0h1"); // paden blijven leesbaar
  });

  it("codeert een procentteken vóór zijn eigen ontsnappingen", () => {
    // Andersom zou `%3C` als `%253C` eindigen en tekent de browser niets.
    expect(svgUrl("<svg width='50%'/>")).toContain("50%25");
  });
});

describe("laadtitels", () => {
  it("splitst een titel met een dubbele punt", () => {
    expect(laadtitels("Cybercrime: inzicht & aanpak")).toEqual({
      titel: "Cybercrime",
      onder: "inzicht & aanpak",
    });
  });

  it("splitst ook op een gedachtestreepje of een streepje met spaties", () => {
    expect(laadtitels("Cybercrime – inzicht").onder).toBe("inzicht");
    expect(laadtitels("Cybercrime - inzicht").onder).toBe("inzicht");
    // Zonder spaties hoort het bij het woord: dit is geen splitsing.
    expect(laadtitels("Privacy-by-design").onder).toBe("");
  });

  it("laat een titel zonder scheidingsteken heel", () => {
    expect(laadtitels("Cybercrime")).toEqual({ titel: "Cybercrime", onder: "" });
  });

  it("splitst niet als de tweede helft een zin is", () => {
    const lang = "Cybercrime: " + "woord ".repeat(20);
    expect(laadtitels(lang).onder).toBe("");
    expect(laadtitels(lang).titel).toBe(lang.trim());
  });

  it("laat een eigen ondertitel voorgaan en de titel dan heel", () => {
    expect(laadtitels("Cybercrime: inzicht", "Module 3")).toEqual({
      titel: "Cybercrime: inzicht",
      onder: "Module 3",
    });
  });
});

describe("merkHtml", () => {
  it("gebruikt het logo als het er is", () => {
    expect(merkHtml("Cybercrime", "assets/logo.png")).toBe('<img src="assets/logo.png" alt="">');
  });

  it("valt terug op de beginletter van de titel", () => {
    expect(merkHtml("cybercrime")).toContain(">C<");
  });

  it("heeft altijd iets, ook zonder titel", () => {
    expect(merkHtml("   ")).toContain(">?<");
  });

  it("escapet wat uit het document komt", () => {
    expect(merkHtml('<script>')).not.toContain("<script>");
    expect(merkHtml("x", 'a.png" onerror="alert(1)')).not.toContain('onerror="alert(1)"');
  });
});

describe("indexHtml", () => {
  const html = indexHtml({ titel: "Cybercrime: inzicht & aanpak", taal: "nl-NL" });

  it("zet het laadscherm in de HTML zelf, niet in het script", () => {
    // Een laadscherm dat op `app.js` wacht verschijnt precies te laat om iets te overbruggen.
    expect(html).toContain('class="laadscherm"');
    expect(html.indexOf('class="laadscherm"')).toBeLessThan(html.indexOf("app.js"));
  });

  it("toont de gesplitste titel op het laadscherm en de hele titel in de tabbladnaam", () => {
    expect(html).toContain('<h1 class="laad-titel">Cybercrime</h1>');
    expect(html).toContain('<p class="laad-onder">inzicht &amp; aanpak</p>');
    expect(html).toContain("<title>Cybercrime: inzicht &amp; aanpak</title>");
  });

  it("zet de sfeerlaag neer en houdt hem buiten de schermlezer", () => {
    expect(html).toContain('<div class="decor" aria-hidden="true">');
  });

  it("escapet de taal en de titel", () => {
    const vuil = indexHtml({ titel: '</title><script>x</script>', taal: 'nl"onload="x' });
    expect(vuil).not.toContain("<script>");
    expect(vuil).toContain('lang="nl&quot;onload=&quot;x"');
  });
});
