# Prism Builder — Generation Page

Een gestuurd interview dat je conversationeel door het bouwen van één leermodule praat — één
vraag per beurt — en aan het eind bewerkbare lescontent genereert.

Dit is **geen vrije chat**. Een vast schema (`ModuleSpec`) bepaalt *wat* bekend moet worden; het
model stelt de vragen conversationeel en mag doorvragen of voorstellen doen.

## Stack en waarom

**Next.js 15 (App Router) + TypeScript + Tailwind.** Één deployable levert zowel de React-frontend
als de server-side route handlers waarmee `ANTHROPIC_API_KEY` buiten de clientbundel blijft.

De app leeft in deze monorepo als `apps/builder` en hergebruikt de bestaande Prism-laag in plaats
van die te dupliceren:

| Hergebruikt | Waarvoor |
|---|---|
| `design/prism/tokens.css` | Kleuren, radius, schaduw, ambient glow, springs |
| `design/prism/tailwind.preset.js` | Dezelfde tokens als Tailwind-theme |
| `@ob/ui` (`packages/ui`) | Button, Chip, Card, PipsPager, ProgressRing, InfoBar, Expander |

De tokenlaag wordt nooit geforkt (zie `CLAUDE.md`).

## Opzetten

```bash
pnpm install
```

Zet je API-key (server-side, nooit `NEXT_PUBLIC_`):

```bash
cp apps/builder/.env.example apps/builder/.env.local
```

Vul `ANTHROPIC_API_KEY` in. Daarna:

```bash
pnpm --filter @ob/builder dev
```

De app draait op **http://localhost:3001** (poort 3000 is `@ob/studio`).

### Productiebuild

`next dev` en `next build` schrijven standaard beide naar `.next`. Bouw je terwijl de dev-server
draait, dan raakt de chunk-graph van de dev-server corrupt. Geef de build daarom een eigen map:

```bash
NEXT_DIST_DIR=.next-build pnpm --filter @ob/builder build
```

## Fasen

| Fase | Inhoud | Status |
|---|---|---|
| 0 | Stack, scaffold, tokens, `.env.example`, README | ✅ |
| 1 | Types (`ModuleSpec`, contract) + `/api/interview` en `/api/generate` | ✅ |
| 2 | Interview-lus: thread, vier invoer-types, voortgangspips | ✅ |
| 3 | Generatiestap: ProgressRing, bewerkbare contentblokken | ✅ |
| 4 | Styling afronden: glow, springs, reduced-motion, mobiel, foutstaten | ✅ |

## De API

Model: **`claude-opus-5`**. Beide routes gebruiken **structured outputs** — de API dwingt af dat het
antwoord het JSON Schema volgt dat uit de Zod-schema's in `lib/types.ts` komt. Dat is sterker dan
"antwoord alleen met JSON" en vervolgens parsen. De fence-strip (`lib/json-repair.ts`) plus één
retry blijven als vangnet bestaan, maar horen niet te vuren.

| Route | Effort | max_tokens | Waarom |
|---|---|---|---|
| `POST /api/interview` | `low` | 4000 | Eén klein besluit per beurt; laag effort houdt het gesprek snel |
| `POST /api/generate` | `high` | 16000 | Het inhoudelijke werk — kwaliteit boven snelheid |
| `POST /api/regenerate` | `medium` | 4000 | Eén blok herschrijven; het schema wisselt per bloktype |

`max_tokens` dekt op Opus 5 ook het denken (adaptive thinking staat daar standaard aan), vandaar de
ruimte. Beide routes vragen `fallbacks: "default"` aan, zodat een geweigerd verzoek server-side op
een ander model wordt herkanst in plaats van als fout terug te komen.

### Gemeten latency (live, Opus 5)

| Aanroep | Gemeten |
|---|---|
| Interviewbeurt | ~8-9s (eerste van een sessie ~21s door route- en schemacompilatie) |
| Hele module genereren | **~70s** (3 secties + 6 vragen) |
| Eén blok opnieuw | ~12-18s |

De ~70s is waarom "Opnieuw" per blok een eigen route heeft: één blok herschrijven kost een
kwart van de tijd en laat de blokken die de auteur al goedkeurde ongemoeid.

Denken uitzetten helpt hier **niet**: gemeten ~8,3s zonder tegen ~8,9s mét — binnen de ruis. De
tijd zit in het genereren van de vraag plus de optieteksten, niet in het denken. Daarom staat
adaptive thinking aan; dat vermijdt de twee bekende faalmodi van thinking-uit op Opus 5 zonder
iets te kosten.

Wil je het gesprek sneller, dan is een **lichter model voor alleen `/api/interview`** de knop
(bijvoorbeeld `claude-sonnet-5` of `claude-haiku-4-5`). De beurt is een klein besluit — welk veld
is leeg, en formuleer één vraag — en structured outputs dwingt de vorm toch al af. De
generatiestap hoort op Opus 5 te blijven. Dat is een bewuste afweging, dus die keuze ligt bij jou:
`MODEL` staat in `lib/claude.ts`.

### Uitproberen met curl

Zonder `ANTHROPIC_API_KEY` geven beide routes een nette `geen_api_key`-fout — de validatie ervoor
werkt wel. Start de server (`pnpm --filter @ob/builder dev`) en dan:

```bash
curl -s -X POST http://localhost:3001/api/interview -H "content-type: application/json" -d '{"moduleSpec":{"onderwerp":null,"doelgroep":null,"leerdoelen":[],"toon":null,"vraagvormen":[],"lengte":null,"context":null},"gesprek":[]}'
```

Verwacht (eerste beurt): `{"status":"vraag","veld":"onderwerp","bericht":"…","invoer":{"type":"text"}}`

Een latere beurt, met historie:

```bash
curl -s -X POST http://localhost:3001/api/interview -H "content-type: application/json" -d '{"moduleSpec":{"onderwerp":"Veilig werken op hoogte","doelgroep":null,"leerdoelen":[],"toon":null,"vraagvormen":[],"lengte":null,"context":null},"gesprek":[{"rol":"ai","bericht":"Waar gaat de module over?"},{"rol":"user","bericht":"Veilig werken op hoogte"}]}'
```

Content genereren uit een volledige spec:

```bash
curl -s -X POST http://localhost:3001/api/generate -H "content-type: application/json" -d '{"moduleSpec":{"onderwerp":"Veilig werken op hoogte","doelgroep":"Nieuwe monteurs","leerdoelen":["Valgevaren herkennen","Harnas correct aanleggen"],"toon":"professioneel-toegankelijk","vraagvormen":["Meerkeuze"],"lengte":"~10 min","context":null}}'
```

### Foutvorm

Elke fout heeft dezelfde vorm, zodat de frontend `bericht` letterlijk kan tonen:

```json
{ "fout": true, "bericht": "…", "code": "geen_api_key" }
```

Codes: `geen_api_key` · `ongeldige_invoer` · `model_weigering` · `ongeldig_json` · `rate_limit` ·
`onbekend`. Alles behalve `ongeldige_invoer` mag de gebruiker opnieuw proberen.

## Het startscherm

De app opent op een aurora met één vraag: **"Wat wil je maken?"** plus een pil-vormig tekstveld.

Dit scherm *ís* de eerste interviewbeurt. Het onderwerp is altijd het eerste veld (zie de veldorde
in `lib/spec.ts`), dus daar hoeft het model niet om gevraagd te worden: het antwoord gaat lokaal in
de spec en het model denkt pas vanaf beurt twee mee. Dat scheelt de gemeten ~9-21s die de eerste
aanroep kostte — de pagina staat er nu direct in plaats van met een spinner. De vraag die het
startscherm stelt gaat wél mee in de historie, anders begint het gesprek voor het model met een
antwoord op niets.

Prism-verantwoording van de gloed:

| Keuze | Waarom |
|---|---|
| Aurora alleen in **Flow + Bloom** | Flow = hier ga je iets doen, Bloom = een AI genereert het. Glow betekent "voltooid" en heeft op een startpagina niets te melden. Kleur = betekenis, ook in een achtergrond. |
| Kleuren via `color-mix()` op de tokens | Geen overgetypte hexwaarden; één bron blijft één bron. |
| Titel 46px op `sm`+, 30px daaronder | Display XL en Titel zijn beide gedocumenteerde typerollen; 46px past niet op 375px. |
| Pil in rust op `--elevation` | Glow verdient zijn plek. Op een leeg startscherm is de accentknop uitgeschakeld en heeft de pagina géén enkele glow behalve het logo. Zodra je typt licht de knop op. |
| Focus is een outline, geen tweede glow | Zoals elk ander bedieningselement in deze app. |
| Drift alleen op `transform`, achter `motion-safe` | `motion.md`. Bij `prefers-reduced-motion` staat de aurora stil. |

Let op bij `focus-within`: `outline-2` zet alléén de breedte. Bij `focus-visible` vult de browser de
stijl zelf in (`outline-style: auto`), maar `focus-within` krijgt die hulp niet — zonder de losse
`outline`-klasse blijft `outline-style: none` en is er dus geen zichtbare focus.

## De interview-lus

Elke beurt komt er gestructureerde JSON terug. Bij `vraag` of `bevestig` rendert de frontend de
invoer en gebeurt er niets meer tot de gebruiker antwoordt — zo "stopt het programma om een vraag
te stellen", zonder vrije tekst te parsen.

De statelogica staat als pure module in `lib/spec.ts`, los van React. Het subtiele geval zit bij
de lijstvelden: bood het model keuzes aan, dan ís het antwoord de hele set (**vervangen**); bij
vrije tekst gaat het om één toevoeging (**aanvullen**). Anders wist een verdiepingsvraag ("nog een
derde leerdoel?") de eerder gegeven leerdoelen.

Bij "Ik wil iets aanpassen" kiest de gebruiker een veld uit de al gevulde velden; dat veld wordt
leeggemaakt en het interview hervat daar.

### Bekende valkuil: box-shadow niet mee-transitionen

Tailwind's `box-shadow`-declaratie is byte-identiek tussen alle shadow-klassen (dezelfde
`var()`-keten). Zet je `box-shadow` in `transition-property`, dan ziet Chromium geen wijziging,
start geen transitie **en blijft op de oude waarde hangen** — een geselecteerde chip kreeg dan de
Flow-gradient zonder de glow. Animeer hier dus alleen `transform`, `opacity` en kleuren, precies
wat `design/prism/motion.md` al voorschrijft.

## Tests

```bash
pnpm test
```

162 tests voor deze app, geen API-key nodig — het contract, de statelogica en de layout zijn pure logica:

- **`contract.test.ts`** — de drie antwoordvormen, de moduleSpec, de request-bodies. Controleert
  ook dat het contract *dicht* is: een verzonnen extra veld wordt afgewezen.
- **`json-schema.test.ts`** — controleert de gegenereerde JSON Schema tegen de eisen van structured
  outputs (`additionalProperties: false` overal, geen niet-ondersteunde keywords, geen `$ref`).
  Dit is geen theorie: het ving een echte bug waarbij een `name`-optie het schema in een
  `$ref`-omhulsel wikkelde, wat pas als 400 bij de eerste interviewbeurt zichtbaar was geworden.
- **`spec.test.ts`** — de statelogica: vervangen vs. aanvullen bij lijstvelden, velden wissen,
  pipstatussen, en de defaults voor toon en lengte.
- **`graph.test.ts`** — het leerpad op het whiteboard: geen knoop die naar zichzelf wijst, geen blok
  dat los blijft liggen, knopen blijven binnen het canvas, en een rij loopt door op de volgende regel.
- **`content.test.ts`** — het bewerken van blokken. Het gevaarlijke geval is `correct`: dat is een
  index in `opties`, en JSON Schema kan daar geen numerieke grens op zetten. Verwijder je een optie
  vóór het juiste antwoord, dan moet de index meeschuiven; verwijder je het juiste antwoord zelf,
  dan moet er een ander geldig antwoord komen. `normaliseerContent()` trekt een index van buiten
  bereik recht zodra content binnenkomt.
- **`annotaties.test.ts`** — het tekenen op het canvas. De valkuil is de zoomfactor: een
  pointerpositie moet door de zoom gedeeld worden voordat je hem opslaat, anders tekent de stift
  naast de cursor en verschuift bestaand werk zodra je zoomt — zonder dat iets faalt. Verder:
  ids worden nooit hergebruikt (het whiteboard wordt ontkoppeld bij het wisselen van weergave, dus
  een oplopende teller in dat component zou opnieuw bij 1 beginnen).

## Zelf beginnen, zonder interview

Op twee plekken staat dezelfde uitweg: op het startscherm ("Begin met een leeg whiteboard") en in
het chatscherm onder de invoer ("Naar het whiteboard, leeg beginnen"). Je komt dan direct op het
storyboard met een lege module: een intro- en een samenvattingsblok, aan elkaar geknoopt, en het
palet ernaast.

Drie keuzes daarin:

- **Wat je al typte gaat mee als titel.** Dat zijn je eigen woorden; opnieuw intikken is onnodig.
  Typte je niets, dan heet de module "Naamloze module" — een zichtbare plaatsvervanger, geen
  verzonnen inhoud. Intro en samenvatting blijven leeg en worden dus als "nog niet af" gemeld.
- **Er is geen spec, en dat heeft gevolgen.** De spec komt uit het interview. Zonder spec is er
  niets om een herschrijving op te baseren, dus vervalt **"Opnieuw"** bij de blokken, met een regel
  eronder die uitlegt waarom. Liever geen knop dan een knop die iets anders doet dan hij belooft.
- **De uitweg in het chatscherm staat nooit uit**, ook niet terwijl het model aan een beurt werkt.
  Juist tijdens die ~9 seconden wachten wil iemand eruit. De knop doet geen aanroep, hij wisselt
  alleen van fase; een antwoord dat daarna binnenkomt schrijft naar state die niet meer getoond
  wordt.

## Het storyboard

De e-learning is **één pagina die van boven naar beneden scrolt**. Het canvas is het storyboard
daarvan: de blokken staan in **één keten**, en die keten dicteert de stapelvolgorde op de pagina.
Het nummer op elke kaart is zijn plek in die stapel. Wie de lijnen verlegt, verlegt de pagina.

Dat is een belofte, dus hij wordt afgedwongen in plaats van gedocumenteerd en gehoopt:

> elk blok heeft maximaal één uitgaande en maximaal één inkomende schakel.

`verbindKnopen` weigert een vork, een samenvoeging, een lus en een blok-aan-zichzelf. Verbind je A
met B terwijl A al een opvolger had, dan wordt die schakel **vervangen** — dat is wat "hier komt dit
blok onder" betekent. `controleerLeerpad` controleert de invariant alsnog, want een invariant die
alleen bij de ingang wordt bewaakt is er geen; die tweede controle vangt data die niet door
`verbindKnopen` ging (de eerste keten uit `verbindKetting`, en straks opgeslagen data).

| Onderdeel | Waar |
|---|---|
| Model, volgorde, secties, controle | `lib/leerpad.ts` (puur, 58 tests) |
| Canvas, palet, schakels, sneltoetsen | `components/whiteboard/Whiteboard.tsx` |
| Canvas + inhoudsopgave + doellijnen | `components/whiteboard/Storyboard.tsx` |
| Het paneel rechts | `components/whiteboard/Inhoudsopgave.tsx` |
| Wat er nog mis is | `components/whiteboard/Controlelijst.tsx` |

### Blokken plaatsen

Het palet boven het canvas heeft Tekst, Video, Afbeelding, Audio en Vraag. Slepen naar een plek op
het canvas werkt, en **klikken werkt ook** — dat is geen luxe: WCAG 2.2 vraagt bij 2.5.7 (Dragging
Movements) om een alternatief voor elke handeling die alleen met slepen kan. Met alleen slepen is
het palet onbruikbaar met een toetsenbord.

Een nieuw blok komt er **los** bij en wordt niet stil achter de reeks geplakt. Een blok ertussen
proppen verandert de pagina zonder dat iemand daarom vroeg. De kaart zegt dan "los" in plaats van
een nummer, de controlelijst meldt het, en het paneel heeft één knop om het achteraan te zetten.

Video, afbeelding en audio zijn **plaatsvervangers**: het storyboard mag zeggen "hier komt een
video", maar het bestand zelf kan nog niet worden toegevoegd. Uploads zijn niet gebouwd, en
`CLAUDE.md` stelt daar eisen aan (magic-byte-controle, hercoderen, EXIF strippen) die hun eigen werk
zijn.

### De inhoudsopgave

Het paneel rechts is een **weergave van de pagina**, geen tweede plek waar de volgorde bepaald
wordt. De groepen komen uit `groepeerPerSectie`, die de paginavolgorde afloopt en een nieuwe groep
begint zodra de sectie wisselt. Springt de reeks uit een sectie en er weer in, dan staat die sectie
er twee keer met een waarschuwing — de weergave hoort niet netter te zijn dan de werkelijkheid.

De doellijnen worden **gemeten** en niet berekend: het canvas schuift, zoomt en pant, en kaarten
veranderen van hoogte, dus er is geen formule die de plek van een kaart op het scherm kent. Elke
scroll, zoom, versleep en resize meet opnieuw, achter één `requestAnimationFrame`. Onder `lg` staat
het paneel ónder het canvas en worden er geen lijnen getekend — een lijn dwars over de pagina wijst
daar niets aan.

Kleur: Prism noemt bij Flow expliciet *verbinding*. Een doellijn is precies dat, dus Flow op lage
dekking, iets steviger voor de groep met het geselecteerde blok.

### Content versus structuur

De regel is: **de content bepaalt de tekst, de auteur bepaalt de structuur.** Na een contentwijziging
(een veld bewerkt, of "Opnieuw" op een blok) trekt `synchroniseerMetContent` de reeks bij: titels,
fragmenten, duur en klaar-status lopen mee; posities, secties, schakels en zelf geplaatste blokken
blijven staan. Een verdwenen blok wordt verwijderd en de keten **geheeld** — anders valt de pagina
in twee stukken uiteen door één regeneratie.

## Het whiteboard

De gegenereerde module verschijnt eerst als leerpad: een kaart per blok, verbonden in de volgorde
waarin een cursist ze doorloopt. Twee dingen zijn de moeite om te weten.

**Categorie en state botsen niet.** Prism heeft drie kleurenparen, de kaarten hebben vijf
categorieën. Dat lost zich op door de kanalen te splitsen: de categorie zit in de **rand** plus de
pil in de kop, de state in de **glow** (selectie = Flow, nog niet af = Bloom). Zo blijft "max één
glow per element" overeind.

**Tekenwerk staat in `Resultaat`, niet in `Whiteboard`.** Wissel je naar de blokkenweergave, dan
wordt het whiteboard ontkoppeld en zou lokale state verdwijnen. Knoopposities stonden al in de
ouder; streken en handgelegde verbindingen nu ook. Zoomniveau, raster en het gekozen gereedschap
blijven wél lokaal — dat is een kijkinstelling, geen auteurswerk.

Wat nog niet bestaat: **exporteren**. De bewerkte content leeft in het scherm. De brug naar de
xAPI/cmi5-exporter van `apps/studio` is nog niet gebouwd.

## Kwaliteitsvloer

Geverifieerd in de browser, in een écht gefocust venster:

| Eis | Status |
|---|---|
| Zichtbare keyboard-focus | ✓ 58 bedieningselementen in bewerkmodus, **nul** zonder ring; 2px Flow-ink outline, 2px offset |
| Doelgrootte ≥ 24px (WCAG 2.2 AA) | ✓ kleinste 24px — de "markeer als juist"-toggle stond op 20px en is verhoogd |
| Mobiel 375px | ✓ geen zijwaartse scroll in interview, blokken, bewerkmodus én whiteboard |
| Breed canvas op mobiel | ✓ het whiteboard scrollt in zijn eigen container, niet de pagina |
| `prefers-reduced-motion` | ✓ alle vier animaties achter `no-preference`; springs klappen terug naar `120ms ease-out` zonder overshoot |
| Geen HTML `<form>` | ✓ nul form-elementen; Enter verstuurt via `onKeyDown` |
| Foutstaten | ✓ alle zes codes tonen de juiste tekst met Bloom-glow |
| Uitweg bij elke fout | ✓ retry waar dat helpt, "Begin opnieuw" waar niet — geen doodlopende weg |
| Eén tokenlaag | ✓ geen hardcoded Prism-hexwaarden meer; het logo gebruikt de CSS-variabelen |

## Veiligheid

- `ANTHROPIC_API_KEY` wordt **uitsluitend** in `app/api/*` gelezen. Nooit `NEXT_PUBLIC_`, nooit
  importeren in een client component: alles wat vanuit de client bereikbaar is, belandt in de
  browserbundel.
- `.env.local` staat in `.gitignore`.
