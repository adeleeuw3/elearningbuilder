/**
 * Het thema van het exportpakket: één plek waar de vormgeving vandaan komt.
 *
 * **Waarom dit bestaat.** De vraag was: komt een module er altijd hetzelfde uit te zien, wat de
 * auteur ook prompt of kiest? Dat was al grotendeels zo — de prompt raakt alleen tekst, en de
 * stylesheet van de speler stond vast. Maar het schema liet een vrije achtergrondkleur per blok
 * toe. Niets schreef hem, maar hij was bereikbaar: zodra er ooit een kleurkiezer in de UI komt
 * draagt elk blok zijn eigen hex en is "altijd hetzelfde" niet meer waar.
 *
 * Nu loopt het andersom. Een blok zegt alleen hoeveel **nadruk** het vraagt (rustig, normaal,
 * accent) en het thema bepaalt wat dat betekent. Een auteur kan de vormgeving dus niet raken, ook
 * niet per ongeluk — en een nieuw thema verandert elke module in één keer, in plaats van per blok.
 *
 * **Elke waarde hieronder komt uit `design/prism/tokens.css`.** Er staat geen enkele kleur in die
 * niet in het ontwerpsysteem voorkomt; `CLAUDE.md` verbiedt verzonnen kleuren, radii en easings, en
 * die regel geldt hier net zo goed als in de app. Waar het pakket iets nodig heeft wat Prism niet
 * als token kent — de sluier over een foto, de balk achter een citaat — is dat afgeleid van `ink`
 * (`#1B1E28` = `rgb(27,30,40)`) met een alfa, precies zoals `--elevation` dat doet. Afgeleid, niet
 * verzonnen: verandert `ink`, dan verandert de sluier mee.
 *
 * **Wat Prism hier betekent.** De drie paren dragen in de speler dezelfde betekenis als in de app:
 * Flow is waar de cursist nú is en wat hij kan aanraken, Glow is wat af of goed is, Bloom raakt de
 * speler niet aan (er wordt in een pakket niets gegenereerd) en zit alleen in de sfeerlaag. De
 * voortgangsbalk loopt van `flow-from` naar `glow-from` — van bezig naar bijna klaar — precies
 * zoals `DESIGN_SYSTEM.md` §6 de ProgressBar beschrijft.
 */

export interface Thema {
  /** De naam die in het pakket terechtkomt, voor herkenbaarheid in een diff. */
  naam: string;
  kleuren: {
    /** De pagina zelf. */
    canvas: string;
    /** Vlakken die boven de pagina liggen: chrome-balk, rail, kaarten. */
    vlak: string;
    /** Een sectie die om aandacht vraagt. */
    accent: string;
    /** Een sectie die juist rust geeft. */
    rustig: string;
    /** De accentkleur: knoppen, voortgang, de lijn van de keten. */
    merk: string;
    /** Tekst. */
    tekst: string;
    tekstZacht: string;
    tekstFlauw: string;
    /** Randen en scheidingen. */
    rand: string;
    randZacht: string;
    /**
     * Het diepe vlak: het laadscherm en het menupaneel.
     *
     * Dit is Prisms `--flow-on` — de kleur die het systeem voorschrijft voor tekst óp een gevuld
     * Flow-verloop. Als vlak gebruikt is het de donkerste Flow die het systeem kent, en daarmee de
     * enige legitieme manier om in de speler een donker blauw vlak te maken.
     */
    diep: string;
    /** Tekst op het diepe vlak, en op een foto. */
    opDiep: string;
    /** Tekst op een gevuld Flow-verloop (§1 van het ontwerpsysteem schrijft deze waarde voor). */
    opVerloop: string;
    /**
     * De sluier over een achtergrondbeeld, en de balk achter een citaat.
     *
     * Allebei `ink` met een alfa. De balk is dichter dan de sluier omdat hij één regel moet dragen
     * in plaats van een hele sectie: daar mag de foto doorheen, hier moet de zin los komen van wat
     * erachter gebeurt.
     */
    sluier: string;
    band: string;
    /** Terugkoppeling bij een goed antwoord. */
    goedVlak: string;
    goedTekst: string;
  };
  /** De twee tinten van elk paar. Ze lopen altijd onder 135°, nooit als harde vlakken. */
  verloop: {
    flowVan: string;
    flowNaar: string;
    glowVan: string;
    glowNaar: string;
    bloomVan: string;
    bloomNaar: string;
  };
  schaduw: {
    /** Rust: platte, neutrale schaduw. */
    rust: string;
    /** Betekenisvolle state: de glow vervangt de rand. */
    flow: string;
  };
  sfeer: {
    /** De ambient-hoeken van de app-root, hier op het canvas van de speler. */
    ambient: string;
    /** Het stippelraster dat over het canvas ligt. */
    raster: string;
    /** Het figuur in de hoek: cirkels en lijnen, zoals een printplaat. */
    figuur: string;
  };
  typografie: {
    /**
     * De letterfamilie, als CSS-stack.
     *
     * Nooit van een CDN laden (`CLAUDE.md`): het pakket draait offline op een LMS dat we niet
     * kennen, en een lettertype dat niet laadt is een pagina die er anders uitziet dan bedoeld.
     * HK Grotesk is gelicentieerd en gaat daarom niet mee; dit is de fallback-stack die
     * `DESIGN_SYSTEM.md` §5 ervoor aanwijst. Wil je de echte letter, dan moet die als bestand mee
     * in de ZIP.
     */
    stack: string;
    /** De leesbreedte van een alinea. */
    kolom: string;
  };
  vorm: {
    /** Hoekstraal van knoppen en invoervelden. */
    control: string;
    /** Hoekstraal van kaarten en vlakken. */
    kaart: string;
    /** Hoekstraal van grote panelen. */
    groot: string;
  };
  /**
   * De drie springs, als `duur easing`.
   *
   * Letterlijk de waarden uit `tokens.css`. `motion.md` zegt erbij waar ze horen: snappy op een
   * control, flow op selectie en hover, bloom alleen op een viering.
   */
  beweging: {
    snappy: string;
    flow: string;
    bloom: string;
  };
}

/**
 * Een SVG als CSS-waarde.
 *
 * Percent-gecodeerd en niet base64, om twee redenen. De leesbare vorm blijft leesbaar in een diff,
 * en — belangrijker — `assertNoSecrets()` kent een regel `high-entropy-literal` die een lange
 * base64-reeks tussen aanhalingstekens als mogelijke sleutel ziet. Een tekening die de secret-scan
 * laat afgaan is een tekening die de export blokkeert.
 *
 * Alleen de tekens die in een CSS-`url()` echt moeten: `%` eerst, anders codeert hij zijn eigen
 * ontsnappingen dubbel.
 */
export function svgUrl(svg: string): string {
  const compact = svg.replace(/\s+/g, " ").trim();
  const gecodeerd = compact
    .replace(/%/g, "%25")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/#/g, "%23")
    .replace(/"/g, "%22");
  return `url("data:image/svg+xml,${gecodeerd}")`;
}

/** Flow-ink, als los nummer, voor de tekeningen hieronder. */
const FLOW_INK = "#0B6FBF";

/**
 * Het stippelraster. Eén tegel van 26px die zichzelf herhaalt over het hele canvas.
 *
 * Zo licht dat je hem pas ziet als je ernaar zoekt — dat is de bedoeling: `DESIGN_SYSTEM.md` §1b
 * zegt dat sfeer hoort waar het contrast laag is, en dat tekst en controls daarbuiten vallen.
 */
const RASTER = `
<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'>
  <circle cx='1.5' cy='1.5' r='1.1' fill='${FLOW_INK}' fill-opacity='.10'/>
</svg>`;

/**
 * Het figuur in de hoek: concentrische ringen met lijnen eruit, als een printplaat.
 *
 * Eén tekening die het pakket twee keer gebruikt — rechtsonder zoals hij is, linksboven gespiegeld
 * — zodat de twee hoeken bij elkaar horen zonder dat er een tweede bestand bij komt.
 */
const FIGUUR = `
<svg xmlns='http://www.w3.org/2000/svg' width='460' height='460' fill='none'
     stroke='${FLOW_INK}' stroke-opacity='.13' stroke-width='1.4'>
  <circle cx='330' cy='330' r='128'/>
  <circle cx='330' cy='330' r='84'/>
  <circle cx='330' cy='330' r='40'/>
  <circle cx='330' cy='330' r='7' fill='${FLOW_INK}' fill-opacity='.13' stroke='none'/>
  <path d='M0 330h202M330 0v202'/>
  <path d='M202 330l40-40h88M330 202l-40 40v88'/>
  <rect x='44' y='44' width='62' height='62'/>
  <rect x='76' y='76' width='62' height='62'/>
  <path d='M106 75h60M75 106v60'/>
</svg>`;

/**
 * Het basisthema: Flow. Koel blauw, zakelijk.
 *
 * De andere twee zijn hier varianten op — ze wisselen alleen de kleur die de module *draagt*: het
 * diepe paneel van het laadscherm en het menu, de accentsectie, de lijn en de tekeningen. Alles
 * wat een *toestand* aangeeft blijft overal gelijk: de voortgangsbalk loopt van Flow naar Glow, en
 * een goed antwoord krijgt de Glow-wash. Dat is geen gemakzucht maar de regel uit
 * `DESIGN_SYSTEM.md` §1: kleur is betekenis. Als de hele module al geel is, zegt geel niets meer
 * als bevestiging.
 *
 * **Daarom is er geen Glow-thema**, hoewel het het derde paar is. Een module in Glow laat de
 * terugkoppeling bij een goed antwoord in zijn eigen achtergrond verdwijnen. De derde variant is
 * daarom neutraal — Prisms eigen inkt — en die botst met niets.
 */
const BASIS: Thema = {
  naam: "flow",
  kleuren: {
    canvas: "#F5F6F9",
    vlak: "#FFFFFF",
    accent: "#EAF6FF",
    rustig: "#F1F3F7",
    merk: FLOW_INK,
    tekst: "#1B1E28",
    tekstZacht: "#5C6272",
    tekstFlauw: "#9AA0AE",
    rand: "#E2E5EC",
    randZacht: "#EBEDF2",
    diep: "#04314F",
    opDiep: "#FFFFFF",
    opVerloop: "#04314F",
    sluier: "rgba(27,30,40,.55)",
    band: "rgba(27,30,40,.82)",
    goedVlak: "#FFF6E0",
    goedTekst: "#B57A12",
  },
  verloop: {
    flowVan: "#5AB8FF",
    flowNaar: "#7DE3FF",
    glowVan: "#FFD854",
    glowNaar: "#FFB07A",
    bloomVan: "#FF8AD8",
    bloomNaar: "#C77DFF",
  },
  schaduw: {
    rust: "0 1px 2px rgba(27,30,40,.05), 0 6px 18px -10px rgba(27,30,40,.18)",
    flow: "0 0 0 1px rgba(90,184,255,.35), 0 6px 22px -6px rgba(90,184,255,.60)",
  },
  sfeer: {
    ambient: [
      "radial-gradient(700px 460px at 0% -8%, rgba(125,227,255,.20), transparent 60%)",
      "radial-gradient(760px 520px at 105% 4%, rgba(255,216,84,.14), transparent 55%)",
      "radial-gradient(680px 620px at 85% 108%, rgba(199,125,255,.13), transparent 60%)",
    ].join(", "),
    raster: svgUrl(RASTER),
    figuur: svgUrl(FIGUUR),
  },
  typografie: {
    stack: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    kolom: "720px",
  },
  vorm: {
    control: "4px",
    kaart: "8px",
    groot: "12px",
  },
  beweging: {
    snappy: "180ms linear(0, 0.24 4%, 0.66 10%, 0.9 16%, 1.0 24%, 1 100%)",
    flow: "280ms linear(0, 0.18 4%, 0.55 9%, 0.9 15%, 1.06 22%, 1.02 30%, 1 44%, 1 100%)",
    bloom: "420ms linear(0, 0.14 4%, 0.5 9%, 0.94 15%, 1.12 21%, 1.14 25%, 1.02 34%, 0.98 42%, 1 54%, 1 100%)",
  },
};

/** De drie thema's die de chat kan kiezen. */
export const THEMA_NAMEN = ["flow", "bloom", "neutraal"] as const;
export type ThemaNaam = (typeof THEMA_NAMEN)[number];

/** Wat de auteur in de chat te zien krijgt. */
export const THEMA_OMSCHRIJVING: Record<ThemaNaam, string> = {
  flow: "Koel blauw — zakelijk en rustig",
  bloom: "Roze-magenta — creatief en uitnodigend",
  neutraal: "Inkt en grijs — sober en hoog contrast",
};

/**
 * Een variant op het basisthema.
 *
 * Alleen de dragende kleuren wisselen; de rest — tekst, randen, de twee toestandkleuren, de vorm,
 * de letter en de springs — komt ongewijzigd uit `BASIS`. Zo kan een thema de vormgeving verzetten
 * zonder dat het de betekenis van een kleur kan verzetten.
 */
function variant(
  naam: ThemaNaam,
  dragend: { diep: string; accent: string; merk: string; tekening: string },
): Thema {
  return {
    ...BASIS,
    naam,
    kleuren: {
      ...BASIS.kleuren,
      diep: dragend.diep,
      accent: dragend.accent,
      merk: dragend.merk,
      opVerloop: dragend.diep,
    },
    verloop:
      naam === "bloom"
        ? { ...BASIS.verloop, flowVan: BASIS.verloop.bloomVan, flowNaar: BASIS.verloop.bloomNaar }
        : BASIS.verloop,
    sfeer: {
      ...BASIS.sfeer,
      raster: svgUrl(RASTER.split(FLOW_INK).join(dragend.tekening)),
      figuur: svgUrl(FIGUUR.split(FLOW_INK).join(dragend.tekening)),
    },
  };
}

export const THEMAS: Record<ThemaNaam, Thema> = {
  flow: BASIS,
  // Bloom-ink, Bloom-wash, Bloom-on — het derde paar uit DESIGN_SYSTEM.md §1.
  bloom: variant("bloom", {
    diep: "#3D0A38",
    accent: "#FCEBFA",
    merk: "#A5299B",
    tekening: "#A5299B",
  }),
  // Geen paar maar de neutralen: ink als vlak, card-sub als accent.
  neutraal: variant("neutraal", {
    diep: "#1B1E28",
    accent: "#F1F3F7",
    merk: "#1B1E28",
    tekening: "#5C6272",
  }),
};

/** Het standaardthema. Een onbekende of ontbrekende naam valt hierop terug. */
export const HUISSTIJL: Thema = THEMAS.flow;

/** De naam uit de modulespec naar een thema, met een terugval die nooit faalt. */
export function themaVan(naam: string | null | undefined): Thema {
  const gekozen = THEMA_NAMEN.find((n) => n === naam);
  return gekozen ? THEMAS[gekozen] : HUISSTIJL;
}

/**
 * Het thema als CSS-variabelen.
 *
 * Alleen variabelen, geen regels: de regels staan in `shell.ts` en verwijzen hiernaar. Zo is er
 * precies één plek waar een kleur een waarde krijgt, en één plek waar hij gebruikt wordt — in
 * plaats van zestig losse hexwaarden door een stylesheet heen. Een test bewaakt dat: hij weigert
 * elke hexkleur in `shell.ts`.
 *
 * De `prefers-reduced-motion`-regel staat hier en niet in de stylesheet, omdat hij over de springs
 * gaat: wie minder beweging wil krijgt dezelfde overgangen zonder overshoot, niet een pagina die
 * ineens anders is ingedeeld.
 */
export function themaCss(thema: Thema = HUISSTIJL): string {
  const k = thema.kleuren;
  const v = thema.verloop;
  return `/* thema: ${thema.naam} — afgeleid van design/prism/tokens.css */
:root {
  --canvas: ${k.canvas};
  --card: ${k.vlak};
  --nadruk-accent: ${k.accent};
  --nadruk-rustig: ${k.rustig};
  --flow: ${k.merk};
  --flow-wash: ${k.accent};
  --ink: ${k.tekst};
  --ink-soft: ${k.tekstZacht};
  --ink-faint: ${k.tekstFlauw};
  --stroke: ${k.rand};
  --stroke-sterk: ${k.tekstFlauw};
  --stroke-soft: ${k.randZacht};
  --flow-diep: ${k.diep};
  --op-donker: ${k.opDiep};
  --op-merk: ${k.opDiep};
  --op-verloop: ${k.opVerloop};
  --sluier: ${k.sluier};
  --band: ${k.band};
  --glow-wash: ${k.goedVlak};
  --glow-ink: ${k.goedTekst};

  --flow-from: ${v.flowVan};
  --flow-to: ${v.flowNaar};
  --glow-from: ${v.glowVan};
  --glow-to: ${v.glowNaar};
  --bloom-from: ${v.bloomVan};
  --bloom-to: ${v.bloomNaar};
  --grad-flow: linear-gradient(135deg, var(--flow-from), var(--flow-to));
  --grad-glow: linear-gradient(135deg, var(--glow-from), var(--glow-to));
  --grad-voortgang: linear-gradient(90deg, var(--flow-from), var(--glow-from));

  --elevation: ${thema.schaduw.rust};
  --glow-flow: ${thema.schaduw.flow};

  --ambient: ${thema.sfeer.ambient};
  --raster: ${thema.sfeer.raster};
  --figuur: ${thema.sfeer.figuur};

  --letter: ${thema.typografie.stack};
  --kolom: ${thema.typografie.kolom};
  --r-control: ${thema.vorm.control};
  --r-kaart: ${thema.vorm.kaart};
  --r-groot: ${thema.vorm.groot};

  --spring-snappy: ${thema.beweging.snappy};
  --spring-flow: ${thema.beweging.flow};
  --spring-bloom: ${thema.beweging.bloom};
}
@media (prefers-reduced-motion: reduce) {
  :root {
    --spring-snappy: 120ms ease-out;
    --spring-flow: 120ms ease-out;
    --spring-bloom: 120ms ease-out;
  }
}`;
}
