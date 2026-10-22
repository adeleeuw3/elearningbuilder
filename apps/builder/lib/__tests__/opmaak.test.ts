/**
 * Van modeltekst naar HTML.
 *
 * Dit ging stil fout: het model schrijft Markdown, de export escapete die netjes, en de cursist
 * kreeg `**Cliënt**` op zijn scherm te zien. In één geëxporteerd pakket stonden vijftien van die
 * sterretjesparen. Niets faalde — het zag er alleen slordig uit, en dat merk je pas in het LMS.
 *
 * De tweede helft van dit bestand gaat over de volgorde escapen→omzetten. Die volgorde is de hele
 * beveiliging: de tekst komt van een taalmodel en het pakket draait zonder sanitizer.
 */
import { describe, it, expect } from "vitest";
import { alsHtml } from "../export";

describe("alsHtml", () => {
  it("maakt alinea's van lege regels", () => {
    expect(alsHtml("Een.\n\nTwee.")).toBe("<p>Een.</p><p>Twee.</p>");
  });

  it("houdt een enkele regelovergang binnen de alinea", () => {
    expect(alsHtml("Een.\nTwee.")).toBe("<p>Een.<br>Twee.</p>");
  });

  it("zet vet en cursief om", () => {
    expect(alsHtml("**Cliënt** — de mens.")).toBe("<p><strong>Cliënt</strong> — de mens.</p>");
    expect(alsHtml("*zou ik dit ook zo doen?*")).toBe("<p><em>zou ik dit ook zo doen?</em></p>");
    expect(alsHtml("_nadruk_")).toBe("<p><em>nadruk</em></p>");
  });

  it("laat sterretjes met rust waar geen opmaak bedoeld is", () => {
    // Een los sterretje is geen cursief; en snake_case mag geen cursief worden.
    expect(alsHtml("3 * 4 = 12")).toBe("<p>3 * 4 = 12</p>");
    expect(alsHtml("de variabele some_name_here")).toBe("<p>de variabele some_name_here</p>");
  });

  it("maakt een genummerde lijst", () => {
    const uit = alsHtml("1. **Samen doen.** De coach doet mee.\n2. **Echt en nuttig.** Zichtbaar resultaat.");
    expect(uit).toBe(
      "<ol><li><strong>Samen doen.</strong> De coach doet mee.</li>" +
        "<li><strong>Echt en nuttig.</strong> Zichtbaar resultaat.</li></ol>",
    );
  });

  it("maakt een opsomming met streepjes", () => {
    expect(alsHtml("- Minder prikkels.\n- Meer nabijheid.")).toBe(
      "<ul><li>Minder prikkels.</li><li>Meer nabijheid.</li></ul>",
    );
  });

  it("zet een inleidende zin met bolletjes eronder goed", () => {
    // Dit is de vorm die het model het vaakst schrijft. Een regel die eist dat élke regel een
    // opsommingsteken draagt liet hier de hele lijst als alinea staan.
    const uit = alsHtml("Bij oplopende spanning:\n- Verlaag de prikkels.\n- Bied nabijheid.");
    expect(uit).toBe(
      "<p>Bij oplopende spanning:</p><ul><li>Verlaag de prikkels.</li><li>Bied nabijheid.</li></ul>",
    );
  });

  it("laat tekst ná een lijst weer een alinea zijn", () => {
    const uit = alsHtml("- Eén punt.\nMaar dit is gewoon tekst eronder.");
    expect(uit).toBe("<ul><li>Eén punt.</li></ul><p>Maar dit is gewoon tekst eronder.</p>");
  });

  it("houdt een genummerde en een ongenummerde lijst uit elkaar", () => {
    const uit = alsHtml("1. eerst\n- los\n2. weer genummerd");
    expect(uit).toBe(
      "<ol><li>eerst</li></ol><ul><li>los</li></ul><ol><li>weer genummerd</li></ol>",
    );
  });
});

describe("alsHtml laat niets van het model een tag worden", () => {
  it("escapet tags uit de tekst", () => {
    const uit = alsHtml("<script>alert(1)</script>");
    expect(uit).not.toContain("<script");
    expect(uit).toContain("&lt;script&gt;");
  });

  it("maakt ook van opmaak rond een tag geen tag", () => {
    // De volgorde is escapen en dán omzetten; andersom zou dit een echte <img> opleveren.
    const uit = alsHtml('**<img src=x onerror=alert(1)>**');
    expect(uit).toContain("<strong>");
    // De tekens blijven staan — als zichtbare tekst. Waar het om gaat is dat er geen `<` meer voor
    // staat, zodat de browser er nooit een element van maakt.
    expect(uit).toBe("<p><strong>&lt;img src=x onerror=alert(1)&gt;</strong></p>");
  });

  it("laat in een lijstregel evenmin een tag door", () => {
    const uit = alsHtml('- <a href="javascript:alert(1)">klik</a>');
    expect(uit).toContain("<li>");
    expect(uit).not.toContain("<a ");
    expect(uit).toContain("&lt;a href=&quot;javascript:alert(1)&quot;&gt;");
  });

  it("levert alleen tags op die wij zelf zetten", () => {
    const uit = alsHtml(
      "Kop\n\n**vet** en *cursief*\n\n1. een\n2. twee\n\n- drie\n\n<b>niet van ons</b>",
    );
    const tags = [...uit.matchAll(/<\/?([a-z]+)/g)].flatMap((m) => (m[1] ? [m[1]] : []));
    expect([...new Set(tags)].sort()).toEqual(["em", "li", "ol", "p", "strong", "ul"]);
  });
});
