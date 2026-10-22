/**
 * The "observation document" — the single source of truth for an artifact version.
 *
 * This Zod schema is authoritative. It:
 *   - validates author input at the API boundary (reject unknown fields = security),
 *   - generates the TS types used across studio + exporter + runtime,
 *   - is exported to JSON Schema (see ./index.ts `toJsonSchema`) for the spec contract.
 *
 * Coordinates are ALWAYS normalized fractions (0..1) of the scene so they survive any
 * render size (authoring canvas, learner desktop, mobile). The renderer maps 0..1 -> px.
 */
import { z } from "zod";

/** BCP-47 locale, e.g. "en-US". */
export const Locale = z.string().min(2).max(35);
/** An absolute IRI (we validate as URL; xAPI requires an IRI). */
export const Iri = z.string().url();
/** Stable seed id (UUID) assigned at creation, carried across versions. */
export const SeedId = z.string().uuid();
/** A language map: { "en-US": "text", ... } — at least one entry. */
export const LangMap = z.record(Locale, z.string()).refine(
  (m) => Object.keys(m).length > 0,
  { message: "language map must have at least one locale" },
);

/** Normalized coordinate in [0,1]. */
const Norm = z.number().min(0).max(1);

export const RectRegion = z
  .object({ kind: z.literal("rect"), x: Norm, y: Norm, w: Norm, h: Norm })
  .strict();
export const CircleRegion = z
  .object({ kind: z.literal("circle"), cx: Norm, cy: Norm, r: Norm })
  .strict();
export const PolygonRegion = z
  .object({
    kind: z.literal("polygon"),
    points: z.array(z.object({ x: Norm, y: Norm }).strict()).min(3).max(200),
  })
  .strict();
export const Region = z.discriminatedUnion("kind", [
  RectRegion,
  CircleRegion,
  PolygonRegion,
]);
export type Region = z.infer<typeof Region>;

/**
 * The background of a section: a flat colour or an asset that ships inside the package.
 *
 * Deliberately not a URL. The package must run offline on an LMS we do not know, so anything it
 * renders has to be in the ZIP; a URL would also be one more thing the secret scan has to reason
 * about.
 */
/**
 * How much a section should stand out.
 *
 * An intent, never a colour. The theme decides what "accent" looks like, so two modules built by
 * two authors from two prompts cannot drift apart visually: the only thing an author picks is
 * whether a section is a breather, an ordinary one, or one that asks for attention.
 *
 * This replaced a free-form background colour. The bridge never wrote that field, but it was
 * reachable: the moment a colour picker appears in the UI, every block can carry its own hex and
 * "the export always looks the same" stops being true. Colour is meaning, not decoration — the
 * same rule the authoring app lives by (design/prism/DESIGN_SYSTEM.md §1).
 */
export const Nadruk = z.enum(["rustig", "normaal", "accent"]);
export type Nadruk = z.infer<typeof Nadruk>;

/**
 * A picture behind the section.
 *
 * Still allowed, because a photo behind a quote is content and not styling — the author chose that
 * image for what it shows. The theme keeps it in line: the player lays a scrim over it and switches
 * to light text, so the result stays readable whatever the photo looks like.
 */
export const Achtergrond = z
  .object({
    assetId: z.string().min(1),
    /** The file's name inside the package; same reasoning as `filename` on media. */
    filename: z.string().max(120).regex(/^[A-Za-z0-9._-]+$/).optional(),
  })
  .strict();
export type Achtergrond = z.infer<typeof Achtergrond>;

/**
 * The two pictures that belong to the module as a whole rather than to one section: the logo on
 * the loading screen, and the image beside the menu.
 *
 * Both are optional, and the player has an answer for either being absent — it draws a monogram
 * from the title instead of a logo, and falls back to the first image in the module, then to a
 * plain gradient panel, for the menu. That matters because the house style promises a loading
 * screen and a menu image *always*; a promise that depends on the author remembering to upload
 * something is not a house style, it is a suggestion.
 */
export const Branding = z
  .object({
    /** Shown on the loading screen. Absent = the player draws a monogram. */
    logo: Achtergrond.optional(),
    /** The picture beside the menu. Absent = the player looks for one in the module. */
    image: Achtergrond.optional(),
  })
  .strict();
export type Branding = z.infer<typeof Branding>;

/**
 * How a block occupies the page.
 *
 * `minHeight` is a fraction of the viewport, not a pixel value - same reason as the coordinates
 * above. 320px is half a phone screen and a sixth of a desktop one, so a pixel height means
 * something different on every device the module lands on.
 */
export const Presentation = z
  .object({
    /** How much this section stands out. The theme turns it into colour. */
    nadruk: Nadruk.default("normaal"),
    /** A picture behind the section. Content, not styling. */
    background: Achtergrond.optional(),
    /** Edge to edge, or inside the reading column? */
    fullBleed: z.boolean().default(false),
    /** Minimum height as a fraction of the viewport. 0 = as tall as its own content. */
    minHeight: Norm.default(0),
  })
  .strict();
export type Presentation = z.infer<typeof Presentation>;

/** How a component maps to xAPI when a learner interacts with it. */
export const ComponentXapi = z
  .object({
    activityType: Iri.default("http://adlnet.gov/expapi/activities/interaction"),
    verbOnInteract: Iri.default("http://adlnet.gov/expapi/verbs/experienced"),
  })
  .strict();

export const InteractionType = z.enum([
  "choice",
  "true-false",
  "fill-in",
  "long-fill-in",
  "matching",
  "sequencing",
  "numeric",
  "hotspot-identify",
  "other",
]);

export const Choice = z.object({ id: z.string().min(1), text: LangMap }).strict();

/** Sanitized rich content. `html` MUST be sanitized on save AND on render — never trusted. */
export const RichContent = z
  .object({
    html: z.string().max(50_000).default(""),
    media: z
      .array(
        z
          .object({
            assetId: z.string().min(1),
            kind: z.enum(["image", "audio", "video"]),
            /**
             * The file's name inside the package, e.g. "a1b2.png".
             *
             * The document names the file so the exporter and the player cannot disagree about it.
             * They did: the exporter wrote `assets/<id>.<ext>` while the player asked for
             * `assets/<id>`, so every packaged image 404'd on an LMS. The extension has to stay —
             * static servers derive the Content-Type from it, and `<video>`/`<audio>` need one.
             * Absent means the file is stored under the bare `assetId`.
             */
            filename: z.string().max(120).regex(/^[A-Za-z0-9._-]+$/).optional(),
            /** IRI suffix so media completion statements are addressable. */
            iriSuffix: z.string().max(200).optional(),
            captionsAssetId: z.string().optional(), // a11y: track/transcript
          })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict();

export const Assessment = z
  .object({
    interactionType: InteractionType,
    prompt: LangMap,
    choices: z.array(Choice).max(50).optional(),
    /** xAPI correctResponsesPattern strings (format depends on interactionType). */
    correctResponsesPattern: z.array(z.string()).max(50).optional(),
    score: z
      .object({ min: z.number(), max: z.number(), correct: z.number() })
      .strict()
      .default({ min: 0, max: 1, correct: 1 }),
    /** Links this assessment to a shared rubric item for roll-up. */
    rubricItemId: z.string().optional(),
    feedback: z
      .object({ correct: LangMap.optional(), incorrect: LangMap.optional() })
      .strict()
      .optional(),
  })
  .strict();

/**
 * What a hotspot and a stacked block have in common.
 *
 * Split out so the two page kinds cannot drift: identity, xAPI treatment and ordering are the same
 * thing whether the block sits on an image or in a column.
 *
 * `assessment` is NOT here. It used to be, which meant every block could carry one and nothing
 * said which blocks actually did. It now sits on the kinds that ARE an interaction - a hotspot, a
 * question, an open question - so the shape states what the block is instead of leaving it to be
 * inferred from which optional fields happen to be filled.
 */
const BlockBase = {
  id: SeedId, // stable across versions
  name: z.string().min(1).max(120), // internal author-facing name
  label: LangMap, // learner-facing label
  content: RichContent.default({ html: "", media: [] }),
  xapi: ComponentXapi.default({
    activityType: "http://adlnet.gov/expapi/activities/interaction",
    verbOnInteract: "http://adlnet.gov/expapi/verbs/experienced",
  }),
  order: z.number().int().nonnegative().default(0),
} as const;

export const Component = z
  .object({
    ...BlockBase,
    region: Region,
    /** REQUIRED to publish (WCAG AA). Text alternative for a visual component. */
    altText: LangMap,
    assessment: Assessment.optional(),
  })
  .strict();
export type Component = z.infer<typeof Component>;

/** One step of a carousel: a visual on one side, a text block on the other. */
export const CarouselItem = z
  .object({
    id: z.string().min(1),
    heading: LangMap,
    content: RichContent.default({ html: "", media: [] }),
    /** The pulled-out quote under the body. Optional. */
    highlight: LangMap.optional(),
    altText: LangMap.optional(),
  })
  .strict();
export type CarouselItem = z.infer<typeof CarouselItem>;

/**
 * What every block in a stacked page shares.
 *
 * `altText` is optional in the schema and required on a hotspot, because the two carry different
 * promises: a hotspot is by definition a region on a picture, a stacked block is often just text.
 * Requiring it everywhere would buy filler text instead of accessibility. `publishBlockers()`
 * demands it exactly where the block actually carries a visual - and it says so in a sentence an
 * author can act on, which a parser error does not.
 */
const StackBase = {
  ...BlockBase,
  altText: LangMap.optional(),
  presentation: Presentation.default({ nadruk: "normaal", fullBleed: false, minHeight: 0 }),
} as const;

/** Heading, body, optionally an icon and a rule underneath. The default kind. */
export const TextBlock = z
  .object({
    kind: z.literal("text"),
    ...StackBase,
    /** A single glyph or emoji in front of the heading. */
    icon: z.string().max(8).optional(),
    /** Draw a rule under the text - used to separate an instruction from what it introduces. */
    divider: z.boolean().default(false),
  })
  .strict();
export type TextBlock = z.infer<typeof TextBlock>;

/**
 * An image, video or audio fragment.
 *
 * One kind for all three rather than one per medium: they differ in the element the renderer
 * picks, which `content.media[].kind` already says, and in nothing else.
 */
export const MediaBlock = z.object({ kind: z.literal("media"), ...StackBase }).strict();
export type MediaBlock = z.infer<typeof MediaBlock>;

/** A short quote over a background, with attribution. No interaction. */
export const QuoteBlock = z
  .object({
    kind: z.literal("quote"),
    ...StackBase,
    attribution: LangMap.optional(),
  })
  .strict();
export type QuoteBlock = z.infer<typeof QuoteBlock>;

/** A knowledge check whose answers are right or wrong. */
export const QuestionBlock = z
  .object({
    kind: z.literal("question"),
    ...StackBase,
    assessment: Assessment,
  })
  .strict();
export type QuestionBlock = z.infer<typeof QuestionBlock>;

/**
 * An open question: the answer is recorded, never judged.
 *
 * The assessment's `interactionType` is meant to be `long-fill-in`. That is not a literal in the
 * schema because a `.refine()` turns a member into a `ZodEffects`, and `discriminatedUnion` cannot
 * route on one. The export bridge sets it and a test holds it in place.
 */
export const OpenBlock = z
  .object({
    kind: z.literal("open"),
    ...StackBase,
    assessment: Assessment,
    /** The counting-down character limit on the input field. */
    maxLength: z.number().int().min(1).max(5000).default(500),
  })
  .strict();
export type OpenBlock = z.infer<typeof OpenBlock>;

/** An ordered series the learner steps through; done once every item has been seen. */
export const CarouselBlock = z
  .object({
    kind: z.literal("carousel"),
    ...StackBase,
    items: z.array(CarouselItem).min(1).max(30),
  })
  .strict();
export type CarouselBlock = z.infer<typeof CarouselBlock>;

/**
 * A block in a stacked page.
 *
 * Discriminated on `kind`, like `Page`, because which fields a block may carry depends on what it
 * is. Flat-and-all-optional would accept a text block carrying an `items` list and then render
 * nothing - the silent failure this shape exists to remove.
 *
 * A block without `kind` is a text block. That is not a guess but history: before this union a
 * stacked block could not be anything else.
 */
export const StackBlock = z.preprocess(
  (waarde) =>
    typeof waarde === "object" &&
    waarde !== null &&
    !Array.isArray(waarde) &&
    (waarde as Record<string, unknown>).kind === undefined
      ? { ...(waarde as Record<string, unknown>), kind: "text" }
      : waarde,
  z.discriminatedUnion("kind", [
    TextBlock,
    MediaBlock,
    QuoteBlock,
    QuestionBlock,
    OpenBlock,
    CarouselBlock,
  ]),
);
export type StackBlock = z.infer<typeof StackBlock>;

/** Provenance for generated illustrations — IP defensibility + audit (security plan §10). */
export const SceneProvenance = z
  .object({
    source: z.enum(["upload", "generated"]),
    model: z.string().optional(),
    prompt: z.string().max(4000).optional(),
    license: z.string().optional(),
    generatedAt: z.string().datetime().optional(),
  })
  .strict();

export const Scene = z
  .object({
    assetId: z.string().min(1), // background image asset (in R2)
    naturalWidth: z.number().int().positive(),
    naturalHeight: z.number().int().positive(),
    /** Scene-level description (a11y) — REQUIRED to publish. */
    altText: LangMap,
    provenance: SceneProvenance.optional(),
  })
  .strict();

/**
 * A page with a background illustration and hotspots on it.
 */
export const ScenePage = z
  .object({
    kind: z.literal("scene"),
    id: SeedId,
    title: LangMap,
    scene: Scene,
    components: z.array(Component).max(200).default([]),
  })
  .strict();
export type ScenePage = z.infer<typeof ScenePage>;

/**
 * A page that is a column of blocks the learner scrolls through.
 *
 * Exists because the node builder produces exactly this and the scene shape cannot express it:
 * there is no background image and no hotspot to place. Faking one — a 1×1 transparent asset with
 * dummy regions — would leave `region` and `altText` carrying values that mean nothing, which is
 * worse than a second page kind.
 *
 * The IRIs, verbs and statement flow are identical for both kinds; only the rendering differs.
 */
export const StackPage = z
  .object({
    kind: z.literal("stack"),
    id: SeedId,
    title: LangMap,
    blocks: z.array(StackBlock).max(200).default([]),
  })
  .strict();
export type StackPage = z.infer<typeof StackPage>;

/**
 * Discriminated on `kind`, so a malformed page fails at the discriminator instead of producing a
 * pile of union errors. Both kinds must say what they are — a page that has to be guessed at is
 * exactly the ambiguity this replaces.
 */
export const Page = z.discriminatedUnion("kind", [ScenePage, StackPage]);
export type Page = z.infer<typeof Page>;

export const RubricItem = z
  .object({
    id: z.string().min(1),
    criterion: LangMap,
    weight: z.number().min(0).default(1),
    masteryThreshold: z.number().min(0).max(1).default(1),
  })
  .strict();

export const Scoring = z
  .object({
    rollup: z.enum(["all", "any", "weighted"]).default("weighted"),
    /** Pass threshold as a fraction of max score (0..1). */
    passThreshold: z.number().min(0).max(1).default(0.7),
    /** cmi5 masteryScore (0..1), optional. */
    masteryScore: z.number().min(0).max(1).optional(),
  })
  .strict();

export const Metadata = z
  .object({
    title: LangMap,
    /**
     * The line under the title on the loading screen.
     *
     * Separate from `description` because they appear in different places and serve different
     * jobs: this is a few words that finish the title ("Insight & approach"), the description is
     * the paragraph on the menu that says what the module is for.
     */
    subtitle: LangMap.optional(),
    description: LangMap.optional(),
    subject: z.string().max(120).optional(),
    /** The logo and the menu picture. See `Branding`. */
    branding: Branding.default({}),
    language: Locale.default("en-US"),
    license: z.string().optional(),
    /** Expected time on task, shown on the menu screen. */
    estimatedMinutes: z.number().int().positive().optional(),
    tags: z.array(z.string().max(60)).max(50).default([]),
  })
  .strict();

export const ObservationDoc = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactId: SeedId, // stable across versions
    version: z.number().int().positive(),
    /** IRI namespace root, e.g. https://xapi.example.com/acme */
    iriBase: Iri,
    metadata: Metadata,
    pages: z.array(Page).min(1).max(100),
    rubrics: z.array(RubricItem).max(200).default([]),
    scoring: Scoring.default({ rollup: "weighted", passThreshold: 0.7 }),
  })
  .strict(); // reject unknown top-level fields (defense in depth)
export type ObservationDoc = z.infer<typeof ObservationDoc>;
