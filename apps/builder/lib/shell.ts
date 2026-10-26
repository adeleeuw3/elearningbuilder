/**
 * De app-shell: wat er in het exportpakket zit en de module aan de cursist toont.
 *
 * Framework-vrij en zonder netwerkafhankelijkheden — het pakket moet offline draaien op een LMS dat
 * we niet kennen. Drie bestanden: `index.html`, `app.js` en `app.css`. De inhoud komt uit
 * `observation.json` ernaast; de LRS wordt door de runtime bij het starten ontdekt.
 *
 * **Geen geheimen.** Hier staat geen endpoint, geen sleutel en geen token. Dat is niet alleen beleid
 * (`CLAUDE.md` §3) maar ook praktisch: `assertNoSecrets()` scant het pakket vóór het zippen en
 * weigert anders.
 *
 * **Waarom `innerHTML` hier mag.** De `html` in het document is bij de export ge-escaped: alles wat
 * de auteur typte is platte tekst geworden, en de enige tags die er in zitten hebben wij zelf
 * gezet. `CLAUDE.md` §4 verbiedt `innerHTML` op *ongesanitiseerde* invoer. Omdat vertrouwen op een
 * eerdere stap precies is hoe zulke garanties verdampen, controleert de shell het alsnog: iets dat
 * naar een script of een event-handler ruikt wordt als platte tekst getoond.
 *
 * **Drie weergaven, één document.** Het menu laat de cursist kiezen waar hij begint; een pagina is
 * een reeks volle-breedte secties met links een vinkje per onderdeel; het slot toont wat eruit
 * kwam. De volgorde in het document is de volgorde op het scherm — er wordt niets herschikt, want
 * dat zou de auteur tegenspreken.
 *
 * **De vormgeving komt uit het thema, niet uit de inhoud.** Alle kleuren, de letter en de
 * leesbreedte staan in \`lib/thema.ts\` en worden hier als CSS-variabelen ingevoegd. Een blok zegt
 * alleen hoeveel nadruk het vraagt; wat dat visueel betekent bepaalt het thema. Daardoor ziet een
 * module er hetzelfde uit ongeacht het onderwerp, de prompt of de keuzes van de auteur — en
 * verandert één thema elk pakket tegelijk.
 *
 * **Voortgang overleeft een herlaadbeurt.** Hij gaat naar de xAPI State API als er een LRS is (dan
 * volgt hij de cursist naar een ander apparaat) en altijd óók naar `localStorage` (dan overleeft
 * hij een offline sessie). Lezen doet de LRS eerst: die weet meer dan dit apparaat.
 */

import { HUISSTIJL, themaCss, type Thema } from "./thema";

/**
 * De stylesheet van het pakket, voor één thema.
 *
 * Een functie en geen constante, omdat de auteur in het gesprek een thema kiest. De regels zijn
 * voor elk thema identiek — alleen de variabelen bovenaan verschillen. Daardoor verandert een
 * thema wel de kleur van een module en nooit zijn indeling.
 */
export function appCss(thema: Thema = HUISSTIJL): string {
  return `
${themaCss(thema)}
:root {
  /* Maten die bij de speler horen en niet bij de huisstijl: die staan in \`lib/thema.ts\`. */
  --r: var(--r-kaart);
  --rail: 34px; --balk: 57px; --chroom: 48px;
  /* De zijmarge van de leeskolom. Als variabele omdat het beeld er precies uit moet kunnen breken. */
  --marge: 24px;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--canvas); color: var(--ink);
  font: 16px/1.6 var(--letter);
}

/* ------------------------------------------------------------------- sfeerlaag
   De figuren achter de module: ambient-hoeken, een stippelraster en twee keer hetzelfde
   printplaat-figuur — rechtsonder zoals hij is, linksboven een halve slag gedraaid.

   Dit is Prisms \`--ambient\`-laag (DESIGN_SYSTEM.md §1b: "sfeer hoort waar de randen mogen
   vervagen"), met geometrie erbij. Hij ligt achter alles, vangt geen muis, en staat op \`fixed\`
   zodat hij niet met de pagina meeschuift — bij het scrollen krijgt hij een eigen, tragere drift
   van \`app.js\`. Dat is waar de beweging vandaan komt: de inhoud gaat, de achtergrond volgt
   langzamer. */
.decor { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; --drift: 0px; }
/* Raster en ambient zijn twee lagen en geen twee waarden in één \`background\`. \`--ambient\` is
   namelijk zélf een lijst van drie gradiënten die hun eigen maat en plek al meedragen; zet je daar
   één \`background-size\` naast, dan herhaalt CSS die waarden cyclisch over alle vier de lagen en
   worden de hoekgloeden over het hele scherm uitgerekt. */
.decor::before {
  content: ""; position: absolute; inset: -60px;
  background: var(--raster) repeat 0 0 / 26px 26px;
  transform: translate3d(0, var(--drift), 0); will-change: transform;
}
.decor::after { content: ""; position: absolute; inset: 0; background-image: var(--ambient); }
.decor i, .decor u {
  position: absolute; width: 460px; height: 460px;
  background: var(--figuur) no-repeat center / contain;
  will-change: transform;
}
.decor i { right: -90px; bottom: -90px; }
.decor u { left: -90px; top: -90px; transform: rotate(180deg); }

/* Alles wat de cursist leest of aanraakt ligt bóven de sfeerlaag. */
.chroom, .rail, main, .balk, .laadscherm { position: relative; z-index: 1; }
.chroom, .rail, .balk { z-index: 5; }

/* ----------------------------------------------------------------- laadscherm
   Dit staat als gewone HTML in \`index.html\`, niet in \`app.js\`. Een laadscherm dat pas verschijnt
   als het script geladen én uitgevoerd is, verschijnt precies te laat om nog iets te overbruggen:
   de cursist heeft dan al naar een leeg wit vlak gekeken. Zo is het er vanaf de eerste frame.

   \`app.js\` haalt hem weg zodra het document binnen is. Lukt dat niet — geen JavaScript, een
   kapotte \`observation.json\` — dan blijft hij staan met de foutmelding eronder, wat beter is dan
   een lege pagina die niets zegt. */
.laadscherm {
  position: fixed; inset: 0; z-index: 9;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;
  background: var(--flow-diep); color: var(--op-donker); text-align: center; padding: 24px;
  transition: opacity var(--spring-flow);
}
.laadscherm[hidden] { display: none; }
.laadscherm[data-weg="ja"] { opacity: 0; pointer-events: none; }
.laad-merk { width: 64px; height: 64px; margin-bottom: 30px; }
.laad-merk img { width: 100%; height: 100%; display: block; object-fit: contain; }
.laad-titel { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; }
.laad-onder { margin: 8px 0 0; font-size: 20px; font-weight: 600; letter-spacing: -.01em; opacity: .85; }
.laad-fout { margin: 22px 0 0; max-width: 42ch; font-size: 15px; opacity: .85; }

/* De ProgressRing uit DESIGN_SYSTEM.md §6: een draaiend conic-verloop in Flow. Het gat wordt
   gevuld met de paneelkleur in plaats van met een mask, zodat er geen losse kleur aan te pas komt
   die niet uit het thema komt. */
.laadring {
  position: relative; width: 36px; height: 36px; border-radius: 50%; margin-top: 38px;
  background: conic-gradient(from 0turn, transparent 0deg, var(--flow-from) 170deg, var(--flow-to) 340deg, transparent 360deg);
  animation: draai 900ms linear infinite;
}
.laadring::after { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: var(--flow-diep); }
@keyframes draai { to { transform: rotate(1turn); } }
/* Een eindeloos draaiend ding is precies wat \`reduced-motion\` bedoelt. De ring blijft staan; dat
   er geladen wordt staat er in woorden onder. */
@media (prefers-reduced-motion: reduce) { .laadring { animation: none; } }

/* Alleen voor een schermlezer: de ring zelf zegt niets. */
.alleen-lezer {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}

/* Het merkteken: een geüpload logo, of anders de beginletter van de titel op een Flow-verloop.
   De tekstkleur erop is \`--op-verloop\` — DESIGN_SYSTEM.md §1 schrijft die waarde voor op een
   gevuld verloop, en dat is geen detail: wit op dit verloop haalt de contrastdrempel niet. */
.merkteken {
  display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;
  border-radius: var(--r-kaart); background: var(--grad-flow); color: var(--op-verloop);
  font-weight: 700; font-size: 30px; letter-spacing: -.02em; line-height: 1;
}
.menu-merk .merkteken { font-size: 26px; }

/* --------------------------------------------------------------------- chroom */
.chroom {
  position: fixed; top: 0; left: 0; right: 0; height: var(--chroom); z-index: 6;
  display: flex; align-items: center; gap: 2px; padding: 0 10px;
  background: var(--card); border-bottom: 1px solid var(--stroke);
}
.merk {
  margin-right: auto; font-size: 14px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chroomknop {
  border: 0; background: transparent; color: var(--ink-soft);
  font: inherit; font-size: 17px; line-height: 1;
  width: 34px; height: 34px; border-radius: 4px; cursor: pointer;
}
.chroomknop:hover { background: var(--flow-wash); color: var(--flow); }
.chroomknop:focus-visible { outline: 2px solid var(--flow); outline-offset: 1px; }

/* ---------------------------------------------------------------- de voortgangsrail */
.rail {
  position: fixed; left: 0; top: var(--chroom); bottom: var(--balk); width: var(--rail); z-index: 5;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 10px 0; overflow-y: auto;
  background: var(--card); border-right: 1px solid var(--stroke);
}
.tik {
  width: 15px; height: 15px; flex: none;
  border: 1.5px solid var(--stroke-sterk); border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; line-height: 1; color: transparent;
}
.tik[data-af="ja"] { border-color: var(--flow); color: var(--flow); }

/* De rail hoort bij een pagina. Op het menu en het slot zegt hij niets, dus staat hij er niet. */
body[data-weergave="menu"] .rail, body[data-weergave="slot"] .rail { display: none; }
body[data-weergave="menu"] main, body[data-weergave="slot"] main { margin-left: 0; }
body[data-weergave="menu"] .balk, body[data-weergave="slot"] .balk { left: 0; }

/* ----------------------------------------------------------------------- menu */
.menu {
  display: grid; grid-template-columns: minmax(320px, 460px) 1fr;
  min-height: calc(100vh - var(--chroom) - var(--balk));
}
/* Het menupaneel is één diep Flow-vlak met lichte tekst erop. Flow omdat het menu is waar de
   cursist staat en kiest — in Prism is dat precies wat blauw betekent. */
.menu-info {
  padding: 48px var(--marge) 56px; background: var(--flow-diep); color: var(--op-donker);
  display: flex; flex-direction: column;
}
.menu-info h1 {
  margin: 0; text-align: center;
  font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15;
}
.menu-merk { align-self: center; width: 56px; height: 56px; margin-bottom: 28px; }
.menu-merk img, .menu-merk svg { width: 100%; height: 100%; display: block; }
.menu-beeld {
  background: linear-gradient(135deg, var(--flow-diep), var(--flow));
  background-size: cover; background-position: center;
}
.menu-lijn { border: 0; border-top: 1px solid currentColor; opacity: .35; margin: 18px 0 26px; }
.menu-info p { margin: 0 0 14px; text-align: center; font-size: 15px; }
.menu-info p strong { font-weight: 600; }
.paginas { list-style: none; margin: 34px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
/* Een rij in het menu is een klikbare tegel: aanwijzen tilt hem op (Flow-spring, de anticipatie),
   indrukken duwt hem terug (Snappy, de ontlading) — motion.md "Vloeiendheid: waar beweging hoort".
   De oplichting is \`currentColor\` met een alfa en niet een eigen kleur, zodat dezelfde regel werkt
   op het diepe paneel en op een licht vlak. */
.pagina-item {
  position: relative; width: 100%; text-align: left; background: transparent; border: 0;
  padding: 14px 10px 12px; font: inherit; color: inherit; cursor: pointer;
  border-radius: var(--r-control); transition: transform var(--spring-flow);
}
.pagina-item::before {
  content: ""; position: absolute; inset: 0; border-radius: var(--r-control);
  background: currentColor; opacity: 0; transition: opacity var(--spring-flow);
}
.pagina-item > * { position: relative; }
.pagina-item:hover { transform: translateY(-1px); }
.pagina-item:hover::before { opacity: .08; }
.pagina-item:active { transform: translateY(.5px); transition: transform var(--spring-snappy); }
.pagina-item:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.pagina-titel { display: block; font-size: 20px; font-weight: 600; letter-spacing: -.01em; line-height: 1.25; margin-bottom: 12px; }

/* De ProgressBar uit DESIGN_SYSTEM.md §6: 4px hoog, verloop van flow-from naar glow-from — van
   bezig naar bijna klaar. De vulling schaalt (\`transform\`), hij groeit niet in \`width\`: motion.md
   schrijft transform en opacity voor, en een breedte-animatie laat de browser hertekenen. */
.voortgang { position: relative; display: block; height: 4px; border-radius: 2px; overflow: hidden; }
.voortgang::before { content: ""; position: absolute; inset: 0; background: currentColor; opacity: .22; }
.voortgang > i {
  position: relative; display: block; height: 100%; width: 100%;
  background: var(--grad-voortgang); transform-origin: left center; transform: scaleX(0);
  transition: transform var(--spring-flow);
}

/* ------------------------------------------------------------- pagina en secties */
main { margin-left: var(--rail); padding-top: var(--chroom); padding-bottom: calc(var(--balk) + 16px); }
.kop { max-width: var(--kolom); margin: 0 auto; padding: 40px var(--marge) 4px; }
h1 { font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; margin: 0; }
h2 { font-size: 20px; line-height: 1.3; margin: 0 0 8px; }

.sectie {
  position: relative; width: 100%; padding: 36px 0; overflow: hidden;
  background-size: cover; background-position: center;
}

/* ---- het achtergrondbeeld als eigen laag ----
   Het beeld staat niet op de sectie zelf maar in een laag eronder, om twee dingen die de huisstijl
   vraagt. Een laag kan \`transform\` krijgen (de sectie niet: die zou zijn eigen inhoud meeslepen),
   en dat is waar de drift vandaan komt — de achtergrond schuift trager dan de tekst erlangs.
   En een laag kan \`opacity\` krijgen, waardoor twee secties die elkaar raken in elkaar overlopen
   in plaats van met een harde rand op elkaar te botsen.

   De laag is 118% hoog en staat 9% boven de sectie: de drift mag ±8% lopen zonder dat de rand van
   het beeld in beeld komt. */
.sectie > .beeld {
  position: absolute; left: 0; right: 0; top: -9%; height: 118%;
  background-size: cover; background-position: center;
  transform: translate3d(0, 0, 0); will-change: transform, opacity;
}
.sectie > .binnen { position: relative; max-width: var(--kolom); margin: 0 auto; padding: 0 var(--marge); }
/* Volle breedte geldt voor de achtergrond, niet voor de tekst: een regel die tegen de schermrand
   aan begint is op een telefoon niet te lezen. Alleen het beeld breekt echt uit. */
.sectie[data-vol="ja"] > .binnen { max-width: none; }
.sectie[data-hoog="ja"] { display: flex; align-items: center; }
.sectie[data-hoog="ja"] > .binnen { width: 100%; }
.sectie[data-donker="ja"] { color: var(--op-donker); }
/* Nadruk is intentie; het thema kiest de kleur. Daarom hangt dit aan \`data-nadruk\` en niet aan
   de soort van het blok: wat een citaat visueel doet moet in het thema te veranderen zijn, niet in
   de speler. Een achtergrondbeeld overschrijft dit met een inline-stijl. */
.sectie[data-nadruk="accent"] { background-color: var(--nadruk-accent); }
.sectie[data-nadruk="rustig"] { background-color: var(--nadruk-rustig); }
/* Van een achtergrondbeeld kennen we de helderheid niet; een sluier maakt tekst er altijd leesbaar
   op. Zonder die sluier hangt de leesbaarheid af van welke foto de auteur toevallig koos. */
.sectie[data-sluier="ja"] > .beeld::after { content: ""; position: absolute; inset: 0; background: var(--sluier); }

.sectie img, .sectie video { max-width: 100%; height: auto; display: block; border-radius: 4px; }
.sectie[data-vol="ja"] img, .sectie[data-vol="ja"] video {
  width: calc(100% + var(--marge) * 2); max-width: none;
  margin-left: calc(var(--marge) * -1); border-radius: 0;
}
.sectie audio { width: 100%; }

/* Lijsten en nadruk uit de tekst. De marge links houdt de bolletjes binnen de leeskolom in plaats
   van ze er links buiten te laten hangen. */
.sectie ul, .sectie ol { margin: 0 0 12px; padding-left: 22px; }
.sectie li { margin: 0 0 6px; }
.sectie li:last-child { margin-bottom: 0; }
.sectie strong { font-weight: 600; }
.lijn { border: 0; border-top: 1px solid currentColor; opacity: .25; margin: 20px 0 0; }

/* --------------------------------------------------------------------- citaat */
/* De balk achter een citaat.

   Een citaat staat over een foto heen, en dan vecht elke letter met wat erachter gebeurt. De balk
   loopt over de volle breedte en is maar zo hoog als de zin: de foto blijft erboven en eronder te
   zien, en de zin komt er los van. Dat is de vorm uit de referentiemodule, en de reden dat hij
   werkt is dat de sluier een foto *gelijkmatig* dempt terwijl de balk hem *lokaal* wegneemt.

   De balk is \`--band\`: dezelfde ink als de sluier, dichter. Geen tweede kleur dus. */
.citaatbalk {
  position: relative; width: 100%; background: var(--band); color: var(--op-donker);
  padding: 44px var(--marge); margin: 0;
}
.citaat {
  margin: 0 auto; max-width: 34ch; text-align: center;
  font-size: 21px; line-height: 1.5; font-style: italic;
}
.bron { display: block; margin-top: 14px; font-size: 14px; font-style: normal; opacity: .8; }

/* Een citaatsectie plaatst zijn balk zelf; de leeskolom zit binnen de balk. */
.sectie[data-soort="quote"] > .binnen { max-width: none; padding: 0; }

/* ------------------------------------------------------------------ carrousel */
.carrousel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; align-items: center; }
.carrousel-beeld { display: flex; align-items: center; gap: 10px; }
.carrousel-beeld img { flex: 1 1 auto; min-width: 0; }
.carrousel-leeg {
  flex: 1 1 auto; aspect-ratio: 4 / 3; border-radius: var(--r);
  background: var(--flow-wash); border: 1px dashed var(--stroke-sterk);
}
/* Zonder beeldkolom: de tekst krijgt de volle breedte en de pijlen staan eronder, naast de
   stipjes. Het gestippelde vlak vervalt — dat zou een beeld beloven dat er niet is. */
.carrousel-geen { display: none; }
.carrousel[data-zonder-beeld="ja"] { grid-template-columns: 1fr; gap: 16px; }
.carrousel[data-zonder-beeld="ja"] > div:first-child { order: 2; }
.carrousel[data-zonder-beeld="ja"] .carrousel-beeld { justify-content: center; gap: 16px; }
.carrousel[data-zonder-beeld="ja"] .bolletjes { margin-top: 12px; }
.stap {
  border: 0; background: var(--card); color: var(--ink); border-radius: 4px;
  width: 40px; height: 44px; flex: none; font: inherit; font-size: 18px; cursor: pointer;
  border: 1px solid var(--stroke);
}
.stap:hover:not([disabled]) { background: var(--flow-wash); border-color: var(--flow); }
.stap[disabled] { opacity: .4; cursor: default; }
.stap:focus-visible { outline: 2px solid var(--flow); outline-offset: 2px; }
.bolletjes { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
.bol {
  width: 10px; height: 10px; border-radius: 50%; padding: 0; border: 0;
  background: var(--stroke-sterk); cursor: pointer;
}
.bol[data-hier="ja"] { background: var(--flow); }
.bol[data-gezien="ja"] { background: var(--flow); opacity: .45; }
.bol[data-hier="ja"] { opacity: 1; }
.bol:focus-visible { outline: 2px solid var(--flow); outline-offset: 2px; }
.uitgelicht {
  margin: 16px 0 0; padding: 12px 14px; border-left: 4px solid var(--flow);
  background: var(--flow-wash); color: var(--ink); font-style: italic;
}
@media (max-width: 720px) { .carrousel { grid-template-columns: 1fr; } }

/* --------------------------------------------------------------------- vragen */
.opties { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.optie {
  display: flex; gap: 10px; align-items: flex-start; width: 100%; text-align: left;
  background: var(--card); border: 1px solid var(--stroke); border-radius: 4px;
  padding: 10px 12px; font: inherit; color: var(--ink); cursor: pointer;
}
.optie:hover:not([disabled]) { background: var(--flow-wash); }
.optie:focus-visible { outline: 2px solid var(--flow); outline-offset: 2px; }
.optie[aria-pressed="true"] { background: var(--flow-wash); border-color: var(--flow); }
.optie[data-juist="ja"] { background: var(--glow-wash); border-color: var(--glow-ink); }
.feedback { margin-top: 12px; padding: 12px; border-radius: 4px; background: var(--glow-wash); color: var(--glow-ink); }

.open textarea {
  width: 100%; min-height: 96px; resize: vertical; font: inherit; color: var(--ink);
  background: var(--card); border: 1px solid var(--stroke); border-radius: 4px; padding: 10px 12px;
}
.open textarea:focus-visible { outline: 2px solid var(--flow); outline-offset: 1px; }
.open textarea[disabled] { opacity: .7; }
.open .rest { font-size: 13px; margin: 8px 0 0; opacity: .75; }
.open .knop { margin: 10px 0 0; }
.vastgelegd { margin-top: 12px; padding: 12px; border-radius: 4px; background: var(--flow-wash); color: var(--ink); }
/* De toelichting bij een open vraag is geen beoordeling, dus geen Glow: die betekent in Prism
   "goed/voltooid". Een rustig vlak met een streep ernaast zegt "lees dit even", en laat de
   bevestiging erboven de enige gekleurde melding zijn. */
.toelichting {
  margin-top: 8px; padding: 12px 14px; border-radius: 4px;
  background: var(--nadruk-rustig); color: var(--ink-soft);
  border-left: 3px solid var(--stroke-sterk); font-size: 14.5px;
}

/* ------------------------------------------------------------------ onderbalk */
.balk {
  position: fixed; left: var(--rail); right: 0; bottom: 0; z-index: 5;
  background: var(--card); border-top: 1px solid var(--stroke);
}
.balk > div { max-width: var(--kolom); margin: 0 auto; padding: 12px var(--marge); display: flex; align-items: center; gap: 12px; }
.knop {
  margin-left: auto; background: var(--flow); color: var(--op-merk); border: 0; border-radius: var(--r-control);
  padding: 10px 18px; font: inherit; font-weight: 600; cursor: pointer;
}
.knop[disabled] { opacity: .5; cursor: default; }
.knop:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.tel { color: var(--ink-soft); font-size: 14px; }
.klaar { max-width: var(--kolom); margin: 0 auto; padding: 48px var(--marge); }

@media (max-width: 860px) {
  .menu { grid-template-columns: 1fr; }
  .menu-beeld { min-height: 180px; order: -1; }
}
@media (max-width: 640px) {
  :root { --rail: 26px; --marge: 16px; }
}
@media (prefers-reduced-motion: no-preference) {
  .sectie { animation: op 240ms ease-out both; }
  @keyframes op { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
}
`.trim();
}

/** De stylesheet in het standaardthema, voor plekken die er geen kiezen. */
export const APP_CSS = appCss();

/** HTML-escape. Alles wat uit het document komt gaat hier doorheen voordat het in de pagina staat. */
function esc(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Het merkteken: een geüpload logo, of anders de beginletter van de titel.
 *
 * Er is altijd iets. "Het laadscherm heeft een logo" is een belofte van de huisstijl, en een
 * belofte die afhangt van of de auteur eraan dacht een bestand te uploaden is geen belofte. De
 * terugval is geen plaatsvervanger-grijs blokje maar een echte letter op het Flow-verloop: hij
 * hoort bij de module omdat hij uit de titel komt.
 *
 * Los van \`indexHtml\` omdat het menu hem ook gebruikt, en omdat een pure functie te testen is.
 */
export function merkHtml(titel: string, logoPad?: string): string {
  if (logoPad) return `<img src="${esc(logoPad)}" alt="">`;
  const letter = (titel.trim()[0] || "?").toUpperCase();
  return `<span class="merkteken" aria-hidden="true">${esc(letter)}</span>`;
}

/** Scheidingstekens die een titel in een titel en een ondertitel splitsen. */
const SPLITSER = /\s*[:–—]\s+|\s+-\s+/;

/**
 * De twee regels op het laadscherm.
 *
 * Heeft het document een eigen ondertitel, dan is die het — dan heeft iemand er een bedoeling mee.
 * Anders splitst dit een titel als "Cybercrime: inzicht & aanpak" in zijn twee helften, want dat
 * is wat auteurs schrijven en het laadscherm vraagt precies om die vorm.
 *
 * **De titel in het document verandert hier niet van.** Die gaat ongesplitst naar het menu en naar
 * het manifest: een module die in het LMS "Cybercrime" heet terwijl de auteur hem "Cybercrime:
 * inzicht & aanpak" noemde, is informatie kwijt die niemand erom gevraagd heeft kwijt te raken.
 * Dit is alleen hoe één scherm hem zet.
 *
 * Een lange tweede helft is geen ondertitel maar een zin, en die hoort niet in 20px halfvet onder
 * een titel te staan.
 */
export function laadtitels(titel: string, ondertitel?: string): { titel: string; onder: string } {
  const heel = titel.trim();
  const eigen = ondertitel?.trim();
  if (eigen) return { titel: heel, onder: eigen };

  const delen = heel.split(SPLITSER);
  if (delen.length !== 2) return { titel: heel, onder: "" };
  const [kop, staart] = delen.map((d) => d.trim());
  if (!kop || !staart || staart.length > 60) return { titel: heel, onder: "" };
  return { titel: kop, onder: staart };
}

export interface ShellOpties {
  titel: string;
  taal: string;
  /** De regel onder de titel op het laadscherm. Leeg = afgeleid uit de titel. */
  ondertitel?: string;
  /** Het pad van het logo in het pakket, bv. \`assets/logo.png\`. Leeg = letter uit de titel. */
  logoPad?: string;
}

export function indexHtml(opties: ShellOpties): string {
  const veilig = esc(opties.titel);
  const laad = laadtitels(opties.titel, opties.ondertitel);
  const ondertitel = laad.onder ? `\n<p class="laad-onder">${esc(laad.onder)}</p>` : "";
  return `<!doctype html>
<html lang="${esc(opties.taal)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${veilig}</title>
<link rel="stylesheet" href="app.css">
</head>
<body data-weergave="menu">
<div class="laadscherm" id="laadscherm">
<div class="laad-merk">${merkHtml(opties.titel, opties.logoPad)}</div>
<h1 class="laad-titel">${esc(laad.titel)}</h1>${ondertitel}
<div class="laadring" aria-hidden="true"></div>
<p class="alleen-lezer" role="status">Bezig met laden…</p>
<p class="laad-fout" id="laadfout"></p>
</div>
<div class="decor" aria-hidden="true"><i></i><u></u></div>
<header class="chroom">
<span class="merk" id="merk"></span>
<button class="chroomknop" id="herstart" type="button" title="Opnieuw beginnen" aria-label="Opnieuw beginnen">&#8635;</button>
<button class="chroomknop" id="overzicht" type="button" title="Inhoudsopgave" aria-label="Inhoudsopgave">&#9776;</button>
<button class="chroomknop" id="afsluiten" type="button" title="Afsluiten" aria-label="Afsluiten">&#8677;</button>
</header>
<nav class="rail" id="rail" aria-label="Voortgang op deze pagina"></nav>
<main id="app" aria-live="polite"></main>
<div class="balk"><div><span class="tel" id="tel"></span><button class="knop" id="verder">Volgende</button></div></div>
<script src="xapi_client_min.js"></script>
<script src="xapi-bootstrap.js"></script>
<script src="app.js"></script>
</body>
</html>`;
}

export const APP_JS = `
/**
 * Toont het observatiedocument en meldt aan de LRS wat de cursist doet.
 *
 * De volgorde in het document IS de volgorde op het scherm: pagina's in het menu, secties eronder.
 * Er wordt niets herschikt, want dat zou de auteur tegenspreken.
 */
(function () {
  "use strict";

  var VERSIE = 1;

  var doc = null, sessie = null, sleutel = "";
  var weergave = "menu", paginaIndex = 0, begonnen = Date.now();
  var afgerondGemeld = false;

  // Wat de cursist gedaan heeft. Drie kaarten in plaats van één, omdat ze verschillende dingen
  // betekenen: een blok dat je gezien hebt, een vraag met een oordeel, en een antwoord zonder.
  var gezien = {};      // blok-id -> true
  var antwoorden = {};  // blok-id -> { keuze, goed }
  var vastgelegd = {};  // blok-id -> de ingediende tekst
  var bekeken = {};     // blok-id -> { item-id: true } voor een carrousel
  var tikken = {};      // blok-id -> het vinkje in de rail

  var app = document.getElementById("app");
  var rail = document.getElementById("rail");
  var verder = document.getElementById("verder");
  var tel = document.getElementById("tel");
  var merk = document.getElementById("merk");

  /**
   * De html uit het document is bij de export ge-escaped; hier staat alleen wat wij zelf plaatsten.
   * Vertrouwen op een eerdere stap is precies hoe zulke garanties verdampen, dus dit kijkt alsnog.
   */
  function veiligeHtml(html) {
    if (!html) return "";
    if (/<\\s*script|\\son\\w+\\s*=|javascript:/i.test(html)) return "";
    return html;
  }

  function tekst(kaart) {
    if (!kaart) return "";
    for (var k in kaart) if (Object.prototype.hasOwnProperty.call(kaart, k)) return kaart[k];
    return "";
  }

  function el(tag, klasse, inhoud) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (inhoud != null) e.textContent = inhoud;
    return e;
  }

  function verstreken() {
    return Math.round((Date.now() - begonnen) / 1000);
  }

  /**
   * Het laadscherm weghalen.
   *
   * Eerst doorzichtig maken, dan pas uit de boom: anders klapt het menu er hard in. De \`hidden\`
   * volgt na de overgang, zodat het scherm ook echt geen muis meer vangt.
   */
  function verbergLaadscherm() {
    var scherm = document.getElementById("laadscherm");
    if (!scherm) return;
    scherm.setAttribute("data-weg", "ja");
    window.setTimeout(function () { scherm.hidden = true; }, 400);
  }

  // ------------------------------------------------------------------ beweging
  //
  // De achtergronden bewegen trager dan de inhoud en lopen bij hun randen in elkaar over. Dat is
  // één rekenlus op \`scroll\`, afgeschermd met \`requestAnimationFrame\` zodat hij hooguit één keer
  // per frame draait — een scroll-event kan vaker vuren dan het scherm ververst, en dan rekent de
  // pagina werk uit dat niemand ziet.
  //
  // Alleen \`transform\` en \`opacity\`: die kan de browser zonder hertekenen verwerken. Een
  // achtergrond die in \`top\` of \`background-position\` beweegt laat elke frame opnieuw tekenen en
  // dat is precies waar scrollen schokkerig van wordt.

  var rustigeBeweging =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var driftWacht = false;
  var decorLagen = null;

  function drift() {
    driftWacht = false;
    var hoogte = window.innerHeight || 1;

    // De sfeerlaag schuift het traagst: zij is het verst weg.
    if (!decorLagen) {
      var decor = document.querySelector(".decor");
      decorLagen = decor ? [decor.querySelector("i"), decor.querySelector("u"), decor] : [];
    }
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (decorLagen[0]) decorLagen[0].style.transform = "translate3d(0," + (-y * 0.04).toFixed(1) + "px,0)";
    if (decorLagen[1]) decorLagen[1].style.transform = "rotate(180deg) translate3d(0," + (-y * 0.07).toFixed(1) + "px,0)";
    // Het raster is een pseudo-element en heeft dus geen eigen \`style\`; het leest zijn verschuiving
    // uit een variabele op de ouder.
    if (decorLagen[2]) decorLagen[2].style.setProperty("--drift", (-y * 0.02).toFixed(1) + "px");

    Array.prototype.forEach.call(document.querySelectorAll(".sectie > .beeld"), function (laag) {
      var vak = laag.parentNode.getBoundingClientRect();
      if (vak.bottom < -hoogte || vak.top > hoogte * 2) return; // ver buiten beeld: niets te zien

      // Hoe ver de sectie door het venster gereisd is: 0 als hij net onderaan verschijnt,
      // 1 als hij er bovenlangs uit loopt.
      var reis = (hoogte - vak.top) / (hoogte + vak.height);
      var klem = reis < 0 ? 0 : reis > 1 ? 1 : reis;
      laag.style.transform = "translate3d(0," + ((klem - 0.5) * -56).toFixed(1) + "px,0)";

      // En het overlopen: de randen van de sectie zijn doorzichtiger dan het midden, zodat twee
      // achtergronden die elkaar raken in elkaar overgaan in plaats van tegen elkaar aan te staan.
      var rand = 0.18;
      var dek = klem < rand ? klem / rand : klem > 1 - rand ? (1 - klem) / rand : 1;
      laag.style.opacity = (0.35 + 0.65 * dek).toFixed(3);
    });
  }

  function vraagDrift() {
    if (rustigeBeweging || driftWacht) return;
    driftWacht = true;
    window.requestAnimationFrame(drift);
  }

  if (!rustigeBeweging) {
    window.addEventListener("scroll", vraagDrift, { passive: true });
    window.addEventListener("resize", vraagDrift);
  }

  /** Het pad in het pakket. De naam staat in het document; zonder naam is het het kale id. */
  function assetPad(m) {
    return "assets/" + (m.filename || m.assetId);
  }

  function mediaVan(m) {
    var pad = assetPad(m);
    if (m.kind === "image") {
      var img = document.createElement("img");
      img.src = pad;
      return img;
    }
    var v = document.createElement(m.kind === "video" ? "video" : "audio");
    v.src = pad;
    v.controls = true;
    return v;
  }

  function blokkenVan(pagina) {
    return (pagina.blocks || []).slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
  }

  /* ---------------------------------------------------------------- voortgang */

  function voortgangNu() {
    return {
      v: VERSIE,
      gezien: gezien,
      antwoorden: antwoorden,
      vastgelegd: vastgelegd,
      bekeken: bekeken,
    };
  }

  /**
   * Bewaren doet beide kanten: de LRS als die er is, en altijd ook dit apparaat.
   *
   * De LRS volgt de cursist naar een andere computer; \`localStorage\` overleeft een sessie zonder
   * netwerk. Alleen het eerste zou voortgang laten verdampen zodra de verbinding wegvalt, alleen
   * het tweede zou hem op één apparaat opsluiten.
   */
  function bewaarVoortgang() {
    var pak = voortgangNu();
    try { localStorage.setItem(sleutel, JSON.stringify(pak)); } catch (e) { /* vol of uit */ }
    if (sessie && sessie.state) sessie.state.write(pak);
  }

  function leesLokaal() {
    try {
      var ruw = localStorage.getItem(sleutel);
      return ruw ? JSON.parse(ruw) : null;
    } catch (e) {
      return null;
    }
  }

  function pasToe(pak) {
    if (!pak || pak.v !== VERSIE) return;
    gezien = pak.gezien || {};
    antwoorden = pak.antwoorden || {};
    vastgelegd = pak.vastgelegd || {};
    bekeken = pak.bekeken || {};
  }

  /** De LRS eerst: die weet meer dan dit apparaat. Geen LRS of niets daar? Dan lokaal. */
  function laadVoortgang() {
    if (sessie && sessie.state) {
      return sessie.state.read().then(function (pak) {
        pasToe(pak || leesLokaal());
      }, function () {
        pasToe(leesLokaal());
      });
    }
    pasToe(leesLokaal());
    return Promise.resolve();
  }

  /* ------------------------------------------------------------------ vinkjes */

  /** Is dit blok af? Wat dat betekent hangt af van wat het blok van de cursist vraagt. */
  function afgerond(blok) {
    if (blok.kind === "open") return vastgelegd[blok.id] !== undefined;
    if (blok.assessment) return antwoorden[blok.id] !== undefined;
    // Een carrousel is pas af als élke stap bekeken is. Alleen "in beeld geweest" zou hem afvinken
    // zodra de cursist het eerste item ziet, en dan zegt het vinkje niets.
    if (blok.kind === "carousel") {
      var stappen = bekeken[blok.id] || {};
      return (blok.items || []).every(function (item) { return !!stappen[item.id]; });
    }
    return !!gezien[blok.id];
  }

  function werkTikBij(blok) {
    var t = tikken[blok.id];
    if (t) t.setAttribute("data-af", afgerond(blok) ? "ja" : "nee");
  }

  function maakTik(blok) {
    var t = el("div", "tik", "\\u2713");
    t.setAttribute("role", "img");
    t.setAttribute("aria-label", tekst(blok.label) || "Onderdeel");
    t.setAttribute("data-af", afgerond(blok) ? "ja" : "nee");
    tikken[blok.id] = t;
    return t;
  }

  /** Welk deel van deze pagina is af, van 0 tot 1. */
  function paginaVoortgang(pagina) {
    var blokken = pagina.blocks || [];
    if (blokken.length === 0) return 1;
    var af = 0;
    blokken.forEach(function (b) { if (afgerond(b)) af += 1; });
    return af / blokken.length;
  }

  function allesAf() {
    return doc.pages.every(function (p) { return paginaVoortgang(p) >= 1; });
  }

  /* --------------------------------------------------------------------- menu */

  /**
   * Het beeld naast het menu: het eerste plaatje uit de module.
   *
   * Er is geen apart omslagveld in het document, dus dit is een keuze en geen instelling. Beter dan
   * een leeg vlak, en beter dan een veld verzinnen dat de auteur nergens kan invullen.
   */
  /**
   * Het merkteken in een houder zetten: het geüploade logo, of de beginletter van de titel.
   *
   * Dezelfde terugval als in \`index.html\` — zie \`merkHtml\` daar. Hij staat twee keer omdat het
   * laadscherm al bestaat voordat dit script draait; dat is de prijs van een laadscherm dat op tijd
   * verschijnt.
   */
  function merkIn(houder) {
    var merkje = doc.metadata && doc.metadata.branding && doc.metadata.branding.logo;
    if (merkje && merkje.assetId) {
      var img = document.createElement("img");
      img.src = assetPad(merkje);
      img.alt = "";
      houder.appendChild(img);
      return;
    }
    var letter = (tekst(doc.metadata.title).trim().charAt(0) || "?").toUpperCase();
    var teken = el("span", "merkteken", letter);
    teken.setAttribute("aria-hidden", "true");
    houder.appendChild(teken);
  }

  /**
   * Het beeld naast het menu.
   *
   * Eerst wat de auteur koos, dan het eerste beeld dat in de module voorkomt. Vindt hij niets, dan
   * blijft het Flow-verloop staan dat in de stylesheet op \`.menu-beeld\` zit — het vlak is er dus
   * altijd, ook in een module die helemaal uit tekst bestaat.
   */
  function menuBeeld() {
    var gekozen = doc.metadata && doc.metadata.branding && doc.metadata.branding.image;
    if (gekozen && gekozen.assetId) return assetPad(gekozen);
    for (var i = 0; i < doc.pages.length; i++) {
      var blokken = doc.pages[i].blocks || [];
      for (var j = 0; j < blokken.length; j++) {
        var b = blokken[j];
        var p = b.presentation;
        if (p && p.background && p.background.assetId) return assetPad(p.background);
        var media = (b.content && b.content.media) || [];
        for (var k = 0; k < media.length; k++) {
          if (media[k].kind === "image") return assetPad(media[k]);
        }
      }
    }
    return null;
  }

  function toonMenu() {
    weergave = "menu";
    document.body.setAttribute("data-weergave", "menu");
    app.innerHTML = "";
    rail.innerHTML = "";
    tikken = {};

    var raam = el("div", "menu");
    var info = el("div", "menu-info");

    var merkvak = el("div", "menu-merk");
    merkIn(merkvak);
    info.appendChild(merkvak);
    info.appendChild(el("h1", null, tekst(doc.metadata.title)));
    info.appendChild(el("hr", "menu-lijn"));

    var intro = tekst(doc.metadata.description);
    if (intro) info.appendChild(el("p", null, intro));

    var minuten = doc.metadata.estimatedMinutes;
    if (minuten) {
      var duur = el("p");
      duur.appendChild(document.createTextNode("Deze module duurt ongeveer "));
      var vet = el("strong", null, minuten + " minuten");
      duur.appendChild(vet);
      duur.appendChild(document.createTextNode(" om te doorlopen."));
      info.appendChild(duur);
    }
    info.appendChild(el("p", null, "Kies hieronder waar je wilt beginnen."));

    var lijst = el("ul", "paginas");
    doc.pages.forEach(function (pagina, i) {
      var li = document.createElement("li");
      var knop = el("button", "pagina-item");
      knop.type = "button";
      var deel = paginaVoortgang(pagina);
      // Titel en voortgang in één naam: een schermlezer leest de knop als één ding, en een los
      // "40% afgerond" achter de titel aan zegt niet waar het over gaat.
      knop.setAttribute(
        "aria-label",
        tekst(pagina.title) + ", " + Math.round(deel * 100) + "% afgerond",
      );
      knop.appendChild(el("span", "pagina-titel", tekst(pagina.title)));
      var balk = el("span", "voortgang");
      balk.setAttribute("aria-hidden", "true");
      var vul = document.createElement("i");
      // Schalen in plaats van de breedte zetten: een \`transform\` kost de browser geen hertekening.
      vul.style.transform = "scaleX(" + deel + ")";
      balk.appendChild(vul);
      knop.appendChild(balk);
      knop.addEventListener("click", function () { toonPagina(i); });
      li.appendChild(knop);
      lijst.appendChild(li);
    });
    info.appendChild(lijst);

    var beeld = el("div", "menu-beeld");
    var bron = menuBeeld();
    if (bron) beeld.style.backgroundImage = 'url("' + bron + '")';

    raam.appendChild(info);
    raam.appendChild(beeld);
    app.appendChild(raam);
    window.scrollTo(0, 0);
    werkBalkBij();
  }

  /* ------------------------------------------------------------------ secties */

  function maakSectie(blok) {
    var sectie = el("section", "sectie");
    sectie.id = "blok-" + blok.id;
    sectie.setAttribute("data-soort", blok.kind || "text");

    var p = blok.presentation || {};
    // De nadruk die het blok vraagt; welke kleur daarbij hoort staat in het thema.
    sectie.setAttribute("data-nadruk", p.nadruk || "normaal");
    if (p.fullBleed) sectie.setAttribute("data-vol", "ja");
    if (p.minHeight) {
      sectie.style.minHeight = p.minHeight * 100 + "vh";
      sectie.setAttribute("data-hoog", "ja");
    }
    if (p.background && p.background.assetId) {
      // Het beeld gaat in een eigen laag en niet op de sectie: alleen een laag kan driften en
      // overvloeien zonder de tekst mee te nemen. Zie \`drift()\`.
      var laag = el("div", "beeld");
      laag.style.backgroundImage = 'url("' + assetPad(p.background) + '")';
      sectie.appendChild(laag);
      sectie.setAttribute("data-sluier", "ja");
      sectie.setAttribute("data-donker", "ja");
    }

    var binnen = el("div", "binnen");
    sectie.appendChild(binnen);
    vulSectie(blok, binnen);
    return sectie;
  }

  function vulSectie(blok, binnen) {
    if (blok.kind === "quote") return toonCitaat(blok, binnen);

    var naam = tekst(blok.label);
    if (naam) binnen.appendChild(el("h2", null, (blok.icon ? blok.icon + " " : "") + naam));

    var html = veiligeHtml(blok.content && blok.content.html);
    if (html) {
      var houder = document.createElement("div");
      houder.innerHTML = html;
      binnen.appendChild(houder);
    }

    ((blok.content && blok.content.media) || []).forEach(function (m) {
      var node = mediaVan(m);
      if (m.kind === "image" && blok.altText) node.alt = tekst(blok.altText);
      else if (m.kind === "image") node.alt = "";
      binnen.appendChild(node);
    });

    if (blok.divider) binnen.appendChild(el("hr", "lijn"));

    if (blok.kind === "carousel") toonCarrousel(blok, binnen);

    if (blok.assessment) {
      if (blok.kind === "open") toonOpenVraag(blok, binnen);
      else toonVraag(blok, binnen);
    }
  }

  /**
   * Het citaat staat in een balk over de volle breedte.
   *
   * De balk is de vorm uit de huisstijl: de foto blijft erboven en eronder zichtbaar, en de zin
   * komt los van wat erachter gebeurt. Een sluier dempt een foto gelijkmatig; de balk neemt hem
   * lokaal weg, en dat is wat één regel tekst nodig heeft om te staan.
   */
  function toonCitaat(blok, binnen) {
    var balk = el("div", "citaatbalk");
    var citaat = el("blockquote", "citaat");
    var html = veiligeHtml(blok.content && blok.content.html);
    if (html) citaat.innerHTML = html;
    else citaat.textContent = tekst(blok.label);
    var bron = tekst(blok.attribution);
    if (bron) citaat.appendChild(el("cite", "bron", bron));
    balk.appendChild(citaat);
    binnen.appendChild(balk);
  }

  /**
   * De carrousel: één component met een reeks stappen, beeld links en tekst rechts.
   *
   * De stappen zijn geen aparte activiteiten in de LRS. Per item een statement sturen blaast de
   * rapportage op met regels die niemand leest, terwijl de vraag die iemand wél stelt — heeft de
   * cursist dit doorgenomen — beantwoord wordt door het blok als geheel.
   */
  function toonCarrousel(blok, binnen) {
    var items = blok.items || [];
    if (items.length === 0) return;
    if (!bekeken[blok.id]) bekeken[blok.id] = {};
    var stappen = bekeken[blok.id];
    var index = 0;

    /*
     * Heeft geen enkele stap een beeld, dan vervalt de beeldkolom.
     *
     * De carrousel toonde altijd een gestippeld vlak op de plek van het beeld. Met een geüpload
     * beeld per stap klopt dat; sinds de generator carrousels máákt — en die hebben geen
     * stapbeelden — staat er bij elke stap een groot leeg vak naast de tekst. Dat leest als een
     * plaatje dat niet laadt, terwijl er niets mis is.
     */
    var heeftBeeld = items.some(function (item) {
      var m = (item.content && item.content.media) || [];
      return m.length > 0 && m[0].kind === "image";
    });

    var raam = el("div", "carrousel");
    if (!heeftBeeld) raam.setAttribute("data-zonder-beeld", "ja");
    var links = el("div");
    var beeld = el("div", "carrousel-beeld");

    var vorige = el("button", "stap", "\\u2039");
    vorige.type = "button";
    vorige.setAttribute("aria-label", "Vorige stap");
    var volgende = el("button", "stap", "\\u203a");
    volgende.type = "button";
    volgende.setAttribute("aria-label", "Volgende stap");

    beeld.appendChild(vorige);
    beeld.appendChild(el("div", "carrousel-leeg"));
    beeld.appendChild(volgende);

    var bolletjes = el("div", "bolletjes");
    links.appendChild(beeld);
    links.appendChild(bolletjes);

    var rechts = el("div");
    rechts.setAttribute("aria-live", "polite");
    raam.appendChild(links);
    raam.appendChild(rechts);

    var bollen = items.map(function (item, i) {
      var b = el("button", "bol");
      b.type = "button";
      b.setAttribute("aria-label", "Stap " + (i + 1) + " van " + items.length);
      b.addEventListener("click", function () { toon(i); });
      bolletjes.appendChild(b);
      return b;
    });

    function toon(n) {
      index = n;
      var item = items[n];
      var nieuw = !stappen[item.id];
      stappen[item.id] = true;

      var media = (item.content && item.content.media) || [];
      var vervanger;
      if (media.length && media[0].kind === "image") {
        vervanger = document.createElement("img");
        vervanger.src = assetPad(media[0]);
        vervanger.alt = item.altText ? tekst(item.altText) : "";
      } else {
        // Zonder beeldkolom is dit een onzichtbare tussenruimte, geen gestippeld vlak.
        vervanger = el("div", heeftBeeld ? "carrousel-leeg" : "carrousel-geen");
      }
      beeld.replaceChild(vervanger, beeld.children[1]);

      rechts.innerHTML = "";
      rechts.appendChild(el("h3", null, tekst(item.heading)));
      var html = veiligeHtml(item.content && item.content.html);
      if (html) {
        var houder = document.createElement("div");
        houder.innerHTML = html;
        rechts.appendChild(houder);
      }
      var licht = tekst(item.highlight);
      if (licht) rechts.appendChild(el("blockquote", "uitgelicht", licht));

      vorige.disabled = n === 0;
      volgende.disabled = n === items.length - 1;
      bollen.forEach(function (b, i) {
        b.setAttribute("data-hier", i === n ? "ja" : "nee");
        b.setAttribute("data-gezien", stappen[items[i].id] ? "ja" : "nee");
      });

      if (nieuw) {
        werkTikBij(blok);
        bewaarVoortgang();
        werkBalkBij();
      }
    }

    vorige.addEventListener("click", function () { if (index > 0) toon(index - 1); });
    volgende.addEventListener("click", function () { if (index < items.length - 1) toon(index + 1); });

    binnen.appendChild(raam);
    toon(0);
  }

  /* ------------------------------------------------------------------- vragen */

  function toonVraag(blok, binnen) {
    var a = blok.assessment;
    var eerder = antwoorden[blok.id];
    var lijst = el("ul", "opties");
    lijst.setAttribute("role", "group");
    lijst.setAttribute("aria-label", tekst(a.prompt));

    (a.choices || []).forEach(function (keuze) {
      var li = document.createElement("li");
      var knop = el("button", "optie", tekst(keuze.text));
      knop.type = "button";
      knop.setAttribute("aria-pressed", "false");

      // Een eerder gegeven antwoord staat er meteen weer bij: de cursist komt terug op een pagina
      // die hij al deed, en die dan leeg aantreffen leest als "je bent het kwijt".
      if (eerder) {
        knop.disabled = true;
        if (eerder.keuze === keuze.id) knop.setAttribute("aria-pressed", "true");
        if ((a.correctResponsesPattern || []).indexOf(keuze.id) >= 0) knop.setAttribute("data-juist", "ja");
      }

      knop.addEventListener("click", function () {
        if (antwoorden[blok.id] !== undefined) return;
        var goed = (a.correctResponsesPattern || []).indexOf(keuze.id) >= 0;
        antwoorden[blok.id] = { keuze: keuze.id, goed: goed };
        knop.setAttribute("aria-pressed", "true");
        Array.prototype.forEach.call(lijst.querySelectorAll(".optie"), function (b) {
          b.disabled = true;
        });
        if (goed) knop.setAttribute("data-juist", "ja");
        if (sessie) {
          sessie.answer(blok.id, {
            name: blok.label,
            response: keuze.id,
            success: goed,
            interactionType: a.interactionType,
            correctResponsesPattern: a.correctResponsesPattern,
          });
        }
        var fb = a.feedback && (goed ? a.feedback.correct : a.feedback.incorrect);
        if (fb) binnen.appendChild(el("div", "feedback", tekst(fb)));
        werkTikBij(blok);
        bewaarVoortgang();
        werkBalkBij();
      });
      li.appendChild(knop);
      lijst.appendChild(li);
    });

    binnen.appendChild(el("p", null, tekst(a.prompt)));
    binnen.appendChild(lijst);

    if (eerder) {
      var fb = a.feedback && (eerder.goed ? a.feedback.correct : a.feedback.incorrect);
      if (fb) binnen.appendChild(el("div", "feedback", tekst(fb)));
    }
  }

  /**
   * Een open vraag: een invoerveld met een aftellende limiet en een indienknop.
   *
   * Bewust geen \`<form>\`: een submit herlaadt de pagina, en in een LMS-frame is dat het einde van
   * de sessie — inclusief alles wat nog in de wachtrij van de LRS-client stond.
   */
  function toonOpenVraag(blok, binnen) {
    var a = blok.assessment;
    var limiet = blok.maxLength || 500;
    var eerder = vastgelegd[blok.id];
    var doos = el("div", "open");
    doos.appendChild(el("p", null, tekst(a.prompt)));

    var veld = document.createElement("textarea");
    veld.maxLength = limiet;
    veld.placeholder = "Vul hier je antwoord in";
    veld.setAttribute("aria-label", tekst(a.prompt));

    var teller = el("p", "rest", limiet + " tekens over");
    var knop = el("button", "knop", "Indienen");
    knop.type = "button";
    knop.disabled = true;

    veld.addEventListener("input", function () {
      teller.textContent = limiet - veld.value.length + " tekens over";
      knop.disabled = veld.value.trim().length === 0;
    });

    knop.addEventListener("click", function () {
      if (vastgelegd[blok.id] !== undefined) return;
      vastgelegd[blok.id] = veld.value.trim();
      veld.disabled = true;
      knop.disabled = true;
      if (sessie) {
        // Geen \`success\`: hier valt niets goed of fout aan. Zie de open vraag in het schema.
        sessie.answer(blok.id, {
          name: blok.label,
          response: vastgelegd[blok.id],
          interactionType: a.interactionType,
        });
      }
      doos.appendChild(el("div", "vastgelegd", "Je antwoord is vastgelegd."));
      toonToelichting(doos, a);
      werkTikBij(blok);
      bewaarVoortgang();
      werkBalkBij();
    });

    doos.appendChild(veld);
    doos.appendChild(teller);
    doos.appendChild(knop);

    if (eerder !== undefined) {
      veld.value = eerder;
      veld.disabled = true;
      teller.textContent = limiet - eerder.length + " tekens over";
      doos.appendChild(el("div", "vastgelegd", "Je antwoord is vastgelegd."));
      toonToelichting(doos, a);
    }

    binnen.appendChild(doos);
  }

  /**
   * De toelichting bij een open vraag.
   *
   * Hij staat in \`feedback.correct\` omdat het schema geen derde vak kent, maar hij betekent hier
   * niet "je antwoord was goed": bij een open vraag valt er niets goed of fout. Hij beschrijft waar
   * een sterk antwoord aan voldoet, en wordt daarom altijd getoond zodra er is ingediend — ook bij
   * het terugkomen op een eerder antwoord, anders zou hij na een herlaadbeurt verdwijnen.
   */
  function toonToelichting(doos, a) {
    var tekstje = a && a.feedback && tekst(a.feedback.correct);
    if (!tekstje) return;
    doos.appendChild(el("div", "toelichting", tekstje));
  }

  /* ------------------------------------------------------------------- pagina */

  function toonPagina(i) {
    weergave = "pagina";
    paginaIndex = i;
    document.body.setAttribute("data-weergave", "pagina");
    var pagina = doc.pages[i];
    app.innerHTML = "";
    rail.innerHTML = "";
    tikken = {};

    var kop = el("div", "kop");
    kop.appendChild(el("h1", null, tekst(pagina.title)));
    app.appendChild(kop);

    blokkenVan(pagina).forEach(function (blok) {
      var sectie = maakSectie(blok);
      app.appendChild(sectie);
      rail.appendChild(maakTik(blok));
      volgBlok(blok, sectie);
    });

    if (sessie) sessie.page(pagina.id, pagina.title);
    window.scrollTo(0, 0);
    werkBalkBij();
    // Eén keer rekenen vóór de eerste scroll, anders staan de lagen pas goed zodra de cursist
    // beweegt — en de eerste sectie is precies de sectie die hij meteen ziet.
    vraagDrift();
  }

  /**
   * Een blok meldt zich pas als de cursist het echt in beeld heeft gehad.
   *
   * Zonder \`IntersectionObserver\` valt er niets te meten. Dan geldt alles als gezien: een vinkje
   * dat nooit vult zou de cursist laten denken dat hij iets vergeten is.
   */
  function volgBlok(blok, sectie) {
    function meld() {
      var nieuw = !gezien[blok.id];
      gezien[blok.id] = true;
      werkTikBij(blok);
      if (nieuw) {
        bewaarVoortgang();
        werkBalkBij();
      }
      if (sessie) sessie.component(blok.id, blok.label, blok.xapi && blok.xapi.activityType);
    }

    if (typeof IntersectionObserver === "undefined") return meld();

    var gemeld = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!gemeld && e.isIntersecting) {
          gemeld = true;
          io.disconnect();
          meld();
        }
      });
    }, { threshold: 0.4 });
    io.observe(sectie);
  }

  function openVragen() {
    var pagina = doc.pages[paginaIndex];
    return (pagina.blocks || []).filter(function (b) {
      if (!b.assessment) return false;
      return b.kind === "open" ? vastgelegd[b.id] === undefined : antwoorden[b.id] === undefined;
    }).length;
  }

  /* -------------------------------------------------------------------- balk */

  function werkBalkBij() {
    if (weergave === "slot") {
      tel.textContent = "";
      verder.style.display = "none";
      return;
    }
    verder.style.display = "";

    if (weergave === "menu") {
      var af = 0;
      doc.pages.forEach(function (p) { if (paginaVoortgang(p) >= 1) af += 1; });
      tel.textContent = af + " van " + doc.pages.length + " onderdelen afgerond";
      verder.textContent = "Afronden";
      verder.disabled = !allesAf();
      verder.title = allesAf() ? "Rondt de module af en meldt het resultaat" : "Eerst alle onderdelen doorlopen";
      return;
    }

    var open = openVragen();
    var laatste = paginaIndex >= doc.pages.length - 1;
    verder.disabled = open > 0;
    verder.title = "";
    verder.textContent = laatste ? "Terug naar overzicht" : "Volgende";
    tel.textContent = open > 0
      ? "Nog " + open + " vraag" + (open === 1 ? "" : "en") + " te beantwoorden"
      : "Onderdeel " + (paginaIndex + 1) + " van " + doc.pages.length;
  }

  /* -------------------------------------------------------------------- slot */

  function toonSlot(kop, regel) {
    weergave = "slot";
    document.body.setAttribute("data-weergave", "slot");
    app.innerHTML = "";
    rail.innerHTML = "";
    var klaar = el("div", "klaar");
    klaar.appendChild(el("h1", null, kop));
    if (regel) klaar.appendChild(el("p", null, regel));
    app.appendChild(klaar);
    window.scrollTo(0, 0);
    werkBalkBij();
  }

  function afronden() {
    var ids = Object.keys(antwoorden);
    var goed = 0;
    ids.forEach(function (id) { if (antwoorden[id] && antwoorden[id].goed) goed += 1; });
    var duur = verstreken();

    // Eén keer. cmi5 staat maar één oordeel per sessie toe, en een tweede zou het eerste
    // tegenspreken zonder dat iemand kan zien welke gold.
    if (sessie && !afgerondGemeld) {
      afgerondGemeld = true;
      if (ids.length > 0) {
        sessie.complete({
          durationSeconds: duur,
          score: { raw: goed, min: 0, max: ids.length, scaled: goed / ids.length },
        });
        sessie.result(goed / ids.length >= 0.7, {
          durationSeconds: duur,
          scaled: goed / ids.length,
          raw: goed,
          min: 0,
          max: ids.length,
        });
      } else {
        sessie.complete({ durationSeconds: duur });
      }
    }

    toonSlot("Klaar", ids.length > 0
      ? goed + " van " + ids.length + " vragen goed."
      : "Je hebt de module doorlopen.");
  }

  function herstart() {
    var zeker = window.confirm(
      "Opnieuw beginnen? Je voortgang en je antwoorden op dit apparaat verdwijnen.",
    );
    if (!zeker) return;
    gezien = {};
    antwoorden = {};
    vastgelegd = {};
    bekeken = {};
    afgerondGemeld = false;
    try { localStorage.removeItem(sleutel); } catch (e) { /* niets aan te doen */ }
    // De statements blijven staan. Opnieuw beginnen wist wat jij ziet, niet wat er gebeurd is:
    // een cursusgeschiedenis in de LRS hoort niet uitwisbaar te zijn vanuit de cursus zelf.
    if (sessie && sessie.state) sessie.state.write(voortgangNu());
    toonMenu();
  }

  function afsluiten() {
    if (sessie) sessie.terminate(verstreken());
    toonSlot("Afgesloten", "Je kunt dit venster nu sluiten.");
  }

  /* ------------------------------------------------------------------ knoppen */

  verder.addEventListener("click", function () {
    if (weergave === "menu") return afronden();
    if (paginaIndex >= doc.pages.length - 1) return toonMenu();
    toonPagina(paginaIndex + 1);
  });
  document.getElementById("overzicht").addEventListener("click", toonMenu);
  document.getElementById("herstart").addEventListener("click", herstart);
  document.getElementById("afsluiten").addEventListener("click", afsluiten);

  /* ------------------------------------------------------------------- starten */

  fetch("observation.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      doc = d;
      sleutel = "ob:" + d.artifactId + ":voortgang";
      document.documentElement.lang = (d.metadata && d.metadata.language) || "nl-NL";
      merk.textContent = tekst(d.metadata && d.metadata.title);

      var maak = window.OBxapi && window.OBxapi.createSession;
      if (!maak) return laadVoortgang().then(toonMenu);
      return maak({
        iriBase: d.iriBase,
        artifactId: d.artifactId,
        courseName: d.metadata && d.metadata.title,
        revision: String(d.version),
      }).then(function (s) {
        sessie = s;
        // De runtime meldt zelf \`terminated\` bij het sluiten van het venster; hier nog een keer
        // zou een tweede afsluiting sturen voor dezelfde sessie.
        return laadVoortgang().then(toonMenu);
      });
    })
    .then(function () { verbergLaadscherm(); })
    .catch(function (e) {
      // Het laadscherm blijft staan en draagt de melding: dit is het enige moment waarop de
      // cursist nog niets anders op het scherm heeft om naar te kijken.
      var vak = document.getElementById("laadfout");
      if (vak) vak.textContent = "De module kon niet geladen worden.";
      else app.textContent = "De module kon niet geladen worden.";
      if (window.console) console.error(e);
    });
})();
`.trim();
