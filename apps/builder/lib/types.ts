/**
 * Het contract tussen model, backend en frontend.
 *
 * Zod is hier de bron van waarheid: dezelfde schema's leveren (a) de TypeScript-types,
 * (b) de JSON Schema die het model dwingt geldig te antwoorden (structured outputs), en
 * (c) runtime-validatie van wat er daadwerkelijk terugkomt.
 *
 * Waarom structured outputs en niet "antwoord alleen met JSON" + parsen: de API garandeert
 * dan dat het antwoord het schema volgt. De fence-strip + retry in lib/claude.ts blijft als
 * vangnet bestaan, maar hoort in de praktijk nooit te vuren.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ moduleSpec */

export const ModuleSpecSchema = z
  .object({
    onderwerp: z.string().nullable(),
    doelgroep: z.string().nullable(),
    leerdoelen: z.array(z.string()),
    toon: z.string().nullable(),
    vraagvormen: z.array(z.string()),
    lengte: z.string().nullable(),
    context: z.string().nullable(),
    /**
     * De drie ontwerpvelden. `.default(null)` en niet alleen `.nullable()`: het model levert deze
     * spec aan, en een model dat er één vergeet mag de generatie niet laten mislukken. Een
     * ontbrekend ontwerpveld heeft een terugval; een ontbrekend leerdoel niet.
     */
    /** Welk van de drie thema's de module draagt. Zie `THEMA_NAMEN` in `lib/thema.ts`. */
    thema: z.string().nullable().default(null),
    /** Hoeveel beeld de module gebruikt: weinig, gemiddeld of beeldrijk. */
    beeldgebruik: z.string().nullable().default(null),
    /** Of er video in mag, en van welke soort. */
    video: z.string().nullable().default(null),
  })
  .strict();

export type ModuleSpec = z.infer<typeof ModuleSpecSchema>;

/** De volledige spec die het model bij `genereer` teruggeeft — geen null-velden meer. */
export const CompleteModuleSpecSchema = z
  .object({
    onderwerp: z.string(),
    doelgroep: z.string(),
    leerdoelen: z.array(z.string()),
    toon: z.string(),
    vraagvormen: z.array(z.string()),
    lengte: z.string(),
    context: z.string().nullable(),
    thema: z.string().nullable().default(null),
    beeldgebruik: z.string().nullable().default(null),
    video: z.string().nullable().default(null),
  })
  .strict();

export type CompleteModuleSpec = z.infer<typeof CompleteModuleSpecSchema>;

export const LEGE_MODULE_SPEC: ModuleSpec = {
  onderwerp: null,
  doelgroep: null,
  leerdoelen: [],
  toon: null,
  vraagvormen: [],
  lengte: null,
  context: null,
  thema: null,
  beeldgebruik: null,
  video: null,
};

/**
 * Velden zonder welke er niet gegenereerd kan worden.
 *
 * De ontwerpvelden staan hier bewust **niet** bij: thema, beeldgebruik en video hebben allemaal een
 * terugval, dus een auteur die ze overslaat hoort gewoon een module te krijgen. Alleen inhoud kan
 * ontbreken op een manier die niet op te lossen is.
 */
export const VERPLICHTE_VELDEN = [
  "onderwerp",
  "doelgroep",
  "leerdoelen",
  "vraagvormen",
] as const;

export type VerplichtVeld = (typeof VERPLICHTE_VELDEN)[number];

/**
 * Wat het interview uitvraagt, in volgorde — en dus wat de voortgangsbalk moet tellen.
 *
 * Los van `VERPLICHTE_VELDEN` omdat de twee verschillende vragen beantwoorden: deze lijst gaat over
 * "hoeveel vragen krijg ik nog", die lijst over "kan dit gegenereerd worden". Toen het één lijst
 * was stond er `4 / 4` boven een gesprek dat daarna nog drie vragen stelde.
 */
export const UITVRAAGVELDEN = [
  ...VERPLICHTE_VELDEN,
  "thema",
  "beeldgebruik",
  "video",
] as const;

export type Uitvraagveld = (typeof UITVRAAGVELDEN)[number];

/** Alle velden die het model als `veld` kan noemen. */
export const MODULE_SPEC_VELDEN = [
  "onderwerp",
  "doelgroep",
  "leerdoelen",
  "toon",
  "vraagvormen",
  "lengte",
  "context",
  "thema",
  "beeldgebruik",
  "video",
] as const;

export type ModuleSpecVeld = (typeof MODULE_SPEC_VELDEN)[number];

/** Velden die als lijst in de spec staan — bepaalt of een antwoord append of overschrijft. */
export const ARRAY_VELDEN: readonly ModuleSpecVeld[] = ["leerdoelen", "vraagvormen"];

export const DEFAULT_TOON = "professioneel-toegankelijk";
export const DEFAULT_LENGTE = "~10 min";

/* ------------------------------------------------------- de drie antwoordvormen */

export const InvoerTypeSchema = z.enum([
  "single_select",
  "multi_select",
  "text",
  "text_of_keuze",
]);
export type InvoerType = z.infer<typeof InvoerTypeSchema>;

export const InvoerSchema = z
  .object({
    type: InvoerTypeSchema,
    /** Weggelaten bij type "text". */
    opties: z.array(z.string()).optional(),
  })
  .strict();
export type Invoer = z.infer<typeof InvoerSchema>;

export const VraagAntwoordSchema = z
  .object({
    status: z.literal("vraag"),
    veld: z.enum(MODULE_SPEC_VELDEN),
    bericht: z.string(),
    invoer: InvoerSchema,
  })
  .strict();

export const BevestigAntwoordSchema = z
  .object({
    status: z.literal("bevestig"),
    bericht: z.string(),
    invoer: InvoerSchema,
  })
  .strict();

export const GenereerAntwoordSchema = z
  .object({
    status: z.literal("genereer"),
    moduleSpec: CompleteModuleSpecSchema,
  })
  .strict();

/** Wat /api/interview teruggeeft. Discriminated union op `status`. */
export const InterviewAntwoordSchema = z.discriminatedUnion("status", [
  VraagAntwoordSchema,
  BevestigAntwoordSchema,
  GenereerAntwoordSchema,
]);

export type VraagAntwoord = z.infer<typeof VraagAntwoordSchema>;
export type BevestigAntwoord = z.infer<typeof BevestigAntwoordSchema>;
export type GenereerAntwoord = z.infer<typeof GenereerAntwoordSchema>;
export type InterviewAntwoord = z.infer<typeof InterviewAntwoordSchema>;

/* ------------------------------------------------------------ gegenereerde content */

/**
 * Een bijzondere vorm bij een sectie.
 *
 * **Waarom dit er is.** De generator kende drie bouwstenen: proza, meerkeuze en open vraag. De
 * speler kan meer — citaat, carrousel, volle-breedte beeld — maar het model kon er niet om vragen,
 * dus kwam het er nooit in. Het resultaat was altijd dezelfde vorm: lezen, lezen, lezen, toets.
 *
 * **Plat met optionele velden, geen discriminated union.** Dit schema gaat als JSON Schema naar
 * structured outputs, en die is kieskeurig over wat hij accepteert. Eén object met een `vorm` en
 * velden die per vorm gevuld worden is saaier maar werkt; de route en `bouwLeerpad` controleren
 * wat er bij welke vorm hoort te staan.
 *
 * **Geen `.min()` of `.max()` op `stappen`.** Structured outputs weigert `minItems` boven 1 en
 * `maxItems`; het aantal wordt afgedwongen waar de knopen gemaakt worden. Zie de toelichting bij
 * `SchrijfAntwoordSchema`.
 */
export const ExtraSchema = z
  .object({
    vorm: z.enum(["citaat", "carrousel", "beeld", "scenario"]),
    /**
     * Bij `citaat`: het uitgelichte kernprincipe.
     *
     * **Zonder naam, en dus zonder bronvermelding.** Een uitspraak verzinnen en aan een echt
     * persoon toeschrijven is het soort fout dat een module ongeloofwaardig maakt zodra iemand het
     * natrekt. Een principe zonder naam doet visueel precies hetzelfde.
     */
    citaat: z.string().optional(),
    /** Bij `carrousel`: de stappen. Minstens twee, anders valt hij terug op tekst. */
    stappen: z.array(z.object({ kop: z.string(), tekst: z.string() }).strict()).optional(),
    /** Bij `beeld`: waar het volle-breedte beeld over moet gaan, in het Engels. */
    beeldterm: z.string().optional(),
    /**
     * Bij `scenario`: een situatie waarin de cursist kiest en ziet wat daarvan komt.
     *
     * Dit is het enige blok waarin iemand iets dóét in plaats van leest. `situatie` schetst het
     * geval, elke optie draagt zijn eigen `gevolg` — wat er gebeurt als je dít doet — en
     * `nabespreking` is wat je eruit meeneemt, ongeacht je keuze.
     *
     * `voorkeur` wijst de beste reactie aan. Niet omdat de rest "fout" is, maar omdat de LRS iets
     * moet kunnen rapporteren: zonder juist antwoord is er geen `success` te melden en wordt de
     * uitkomst van een scenario onzichtbaar in elke rapportage.
     */
    situatie: z.string().optional(),
    opties: z
      .array(
        z
          .object({
            tekst: z.string(),
            gevolg: z.string(),
            voorkeur: z.boolean(),
          })
          .strict(),
      )
      .optional(),
    nabespreking: z.string().optional(),
  })
  .strict();

export type Extra = z.infer<typeof ExtraSchema>;

export const SectieSchema = z
  .object({
    kop: z.string(),
    tekst: z.string(),
    type: z.literal("uitleg"),
    /**
     * Waar een afbeelding bij deze sectie over moet gaan — in het Engels.
     *
     * Pexels en Pixabay indexeren vrijwel alleen Engelse trefwoorden. Een Nederlandse kop levert
     * daardoor ruis: "begin stoel basis houding" gaf flamingo, law, button en winter; "office
     * chair posture" gaf een bureaustoel. Het model levert de term daarom mee, want het kent de
     * inhoud van de sectie en de vertaling kost niets extra.
     *
     * `.optional()` en niet `.default()`: een module die van vóór dit veld komt mist hem gewoon,
     * en dan valt de beeldkeuze terug op de kop.
     */
    beeldterm: z.string().optional(),
    /**
     * De bijzondere vorm die bij deze sectie hoort. Zie `ExtraSchema`.
     *
     * Optioneel: niet elke sectie krijgt er een, en een module van vóór dit veld heeft ze niet.
     */
    extra: ExtraSchema.optional(),
  })
  .strict();

export const VraagSchema = z
  .object({
    vraagvorm: z.string(),
    /**
     * Keuzevraag of open vraag.
     *
     * Bestaat omdat het interview "open reflectievragen" aanbiedt en het model die dan netjes
     * levert: een vraag zonder opties en zonder goed antwoord. Zonder dit veld gold zo'n vraag als
     * onaf, weigerde de export de hele module, en zei de melding "heeft nog geen vraag met
     * antwoorden" — terwijl het ontbreken van antwoorden nu juist de bedoeling was.
     *
     * `.default("keuze")` zodat een model dat het veld vergeet een gewone keuzevraag oplevert.
     */
    vorm: z.enum(["keuze", "open"]).default("keuze"),
    vraag: z.string(),
    opties: z.array(z.string()),
    /** Index in `opties` van het juiste antwoord. Zonder betekenis bij een open vraag. */
    correct: z.number().int(),
    feedback: z.string(),
    /**
     * Per antwoordoptie waarom die goed of mis is, in dezelfde volgorde als `opties`.
     *
     * Eén feedbacktekst voor élk fout antwoord bevestigt alleen het oordeel. Uitleg per optie
     * vertelt waaróm juist dít antwoord aantrekkelijk was en waar het misgaat — dat is wat een
     * docent doet. Optioneel, want een model dat het veld overslaat levert nog steeds een
     * bruikbare vraag.
     */
    uitlegPerOptie: z.array(z.string()).optional(),
  })
  .strict();

export const GeneratedContentSchema = z
  .object({
    titel: z.string(),
    intro: z.string(),
    secties: z.array(SectieSchema),
    vragen: z.array(VraagSchema),
    samenvatting: z.string(),
  })
  .strict();

export type Sectie = z.infer<typeof SectieSchema>;
export type Vraag = z.infer<typeof VraagSchema>;
export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

/* ------------------------------------------------------------------ gesprek & state */

export const GesprekRegelSchema = z
  .object({
    rol: z.enum(["ai", "user"]),
    bericht: z.string(),
  })
  .strict();
export type GesprekRegel = z.infer<typeof GesprekRegelSchema>;

export type Fase = "interview" | "genereren" | "beeld" | "resultaat";

export interface GenerationState {
  fase: Fase;
  moduleSpec: ModuleSpec;
  gesprek: GesprekRegel[];
  wachtOpAntwoord: boolean;
  content: GeneratedContent | null;
}

/* ------------------------------------------------------------------ request bodies */

export const InterviewRequestSchema = z
  .object({
    moduleSpec: ModuleSpecSchema,
    gesprek: z.array(GesprekRegelSchema).max(200),
  })
  .strict();

export const GenerateRequestSchema = z
  .object({
    moduleSpec: CompleteModuleSpecSchema,
  })
  .strict();

/**
 * Eén blok opnieuw laten genereren. Het huidige blok gaat mee zodat het model iets ánders
 * kan maken in plaats van bij toeval hetzelfde, en de rest van de module gaat mee als context
 * zodat de toon en het niveau blijven kloppen.
 */
export const RegenerateRequestSchema = z
  .object({
    moduleSpec: CompleteModuleSpecSchema,
    blokType: z.enum(["sectie", "vraag"]),
    huidig: z.union([SectieSchema, VraagSchema]),
    /** Koppen van de andere secties, zodat het model niet in herhaling valt. */
    andereKoppen: z.array(z.string()).max(20).default([]),
  })
  .strict();

export type RegenerateRequest = z.infer<typeof RegenerateRequestSchema>;

/** De invoer van één knoop op het canvas: zijn opdracht plus wat de vorige knoop opleverde. */
/**
 * Hoeveel versies je in één keer kunt laten schrijven.
 *
 * Vier en niet vijf zoals bij de mediazoeker: een variant is hier een alinea, geen miniatuur. Vijf
 * lappen tekst naast elkaar lees je niet meer, en dan kies je de bovenste in plaats van de beste.
 */
export const VARIANTEN_MAX = 4;

export const SchrijfRequestSchema = z
  .object({
    opdracht: z.string().min(1).max(4000),
    titel: z.string().max(200),
    /** Wat er nu in de uitvoer staat; leeg bij een eerste keer. */
    huidig: z.string().max(8000),
    /** De uitvoer van de knoop ervóór, zodat dit blok erop aansluit. */
    context: z.string().max(8000),
    /** Hoeveel versies er geschreven moeten worden om uit te kiezen. */
    aantal: z.number().int().min(1).max(VARIANTEN_MAX).default(1),
  })
  .strict();

/**
 * Altijd een lijst, ook bij één versie.
 *
 * Eén vorm voor beide gevallen: zodra "één uitkomst" en "meerdere uitkomsten" verschillende
 * antwoorden opleveren, krijgt de aanroeper twee paden die uit elkaar gaan lopen — en dan is het
 * pad dat zelden draait het pad dat stukgaat.
 *
 * **Geen `.min()` of `.max()` hier.** Dit schema gaat als JSON Schema naar structured outputs, en
 * die accepteert `minLength` en `maxItems` niet — het verzoek komt dan terug als een 400 die pas
 * zichtbaar wordt als een auteur op Schrijven drukt. Het aantal wordt in de route afgekapt en een
 * leeg antwoord wordt daar als fout behandeld. `json-schema.test.ts` bewaakt deze regel.
 */
export const SchrijfAntwoordSchema = z.object({ varianten: z.array(z.string()) }).strict();

export type SchrijfRequest = z.infer<typeof SchrijfRequestSchema>;
export type SchrijfAntwoord = z.infer<typeof SchrijfAntwoordSchema>;

/* ------------------------------------------------------------------ media zoeken */

/**
 * Eén zoekresultaat van een stockbron.
 *
 * Dit schema staat hier en niet in `media-zoek.ts`: dat bestand is pure vertaling zonder
 * afhankelijkheden, en de contracten van de API horen bij elkaar te staan.
 *
 * **Waarom het succespad óók gevalideerd wordt.** Dit antwoord komt van onze eigen route, maar die
 * route bouwt het uit wat drie externe bronnen teruggeven. Verandert een provider een veldnaam,
 * dan komt er geen foutmelding maar een kandidaat zonder plaatje — en zoiets zie je pas als een
 * auteur ertegenaan loopt. Niet `.strict()`, want een bron die een veld bíjzet mag de hele lijst
 * niet laten sneuvelen.
 */
export const KandidaatSchema = z.object({
  id: z.string(),
  bron: z.enum(["pexels", "pixabay", "youtube"]),
  soort: z.enum(["afbeelding", "video", "externe-video"]),
  titel: z.string(),
  voorbeeld: z.string(),
  bestandUrl: z.string().optional(),
  paginaUrl: z.string(),
  maker: z.string(),
  makerUrl: z.string().optional(),
  licentie: z.string(),
  breedte: z.number().optional(),
  hoogte: z.number().optional(),
  seconden: z.number().optional(),
  alt: z.string().optional(),
  videoId: z.string().optional(),
});

export const ZoekantwoordSchema = z.object({
  term: z.string(),
  kandidaten: z.record(z.string(), z.array(KandidaatSchema)),
  bronnen: z.array(z.enum(["pexels", "pixabay", "youtube"])),
  ontbrekend: z.array(z.enum(["pexels", "pixabay", "youtube"])),
});

export type Zoekantwoord = z.infer<typeof ZoekantwoordSchema>;

/** Foutvorm die beide routes teruggeven — de frontend toont `bericht` letterlijk. */
export interface ApiFout {
  fout: true;
  bericht: string;
  /** Machineleesbaar, voor de frontend om te beslissen of opnieuw proberen zin heeft. */
  code:
    | "geen_api_key"
    | "ongeldige_invoer"
    | "model_weigering"
    | "ongeldig_json"
    | "rate_limit"
    | "onbekend";
}
