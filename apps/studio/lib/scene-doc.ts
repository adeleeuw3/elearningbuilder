/**
 * The worked example artifact, expressed as a real observation document.
 *
 * This is deliberately built through `parseObservation()` from @ob/schema rather than as a
 * hand-typed object literal: the schema is the source of truth, so if the document drifts out
 * of spec the module throws at import and `next build` fails. That makes the editor's data
 * self-testing instead of merely plausible.
 *
 * Coordinates are normalized 0..1 fractions of the scene (never pixels).
 */
import { parseObservation, type ObservationDoc } from "@ob/schema";

/** Stable seed ids — carried across versions so LRS analytics survive a re-illustration. */
export const IDS = {
  artifact: "0b6f1e2c-5a3d-4e7b-9c81-2f4a6d8e1b30",
  page: "1c7a2f3d-6b4e-4f8c-ad92-3e5b7c9f2a41",
  ash: "2d8b3a4e-7c5f-4a9b-8e13-4f6c8d0a2b52",
  crater: "3e9c4b5f-8d6a-4b0c-9f24-5a7d9e1b3c63",
  conduit: "4fad5c6a-9e7b-4c1d-8035-6b8ea02c4d74",
  magma: "50be6d7b-af8c-4d2e-9146-7c9fb13d5e85",
  lava: "61cf7e8c-b09d-4e3f-8257-8da0c24e6f96",
  strata: "72d08f9d-c1ae-4f40-9368-9eb1d35f70a7",
} as const;

export const IRI_BASE = "https://xapi.nextlearningvalley.com/acme";

const EN = "en-US";

const raw = {
  schemaVersion: "1.0",
  artifactId: IDS.artifact,
  version: 1,
  iriBase: IRI_BASE,
  metadata: {
    title: { [EN]: "Inside a stratovolcano" },
    description: { [EN]: "Explore the anatomy of a stratovolcano and how it erupts." },
    subject: "Earth science",
    language: EN,
    tags: ["geology", "volcano", "cross-section"],
  },
  pages: [
    {
      id: IDS.page,
      title: { [EN]: "Anatomy" },
      // Beide paginavormen zeggen wat ze zijn; een pagina die geraden moet worden is precies de
      // dubbelzinnigheid die de union wegneemt.
      kind: "scene",
      scene: {
        assetId: "asset-volcano-cutaway",
        naturalWidth: 1000,
        naturalHeight: 700,
        altText: {
          [EN]: "Cutaway illustration of a stratovolcano showing the magma chamber, conduit, crater, an ash plume and layered rock strata.",
        },
        provenance: { source: "generated" as const, model: "placeholder-svg" },
      },
      components: [
        {
          id: IDS.ash,
          name: "Ash & gas plume",
          label: { [EN]: "Ash & gas plume" },
          region: {
            kind: "polygon" as const,
            points: [
              { x: 0.487, y: 0.05 },
              { x: 0.573, y: 0.062 },
              { x: 0.6, y: 0.115 },
              { x: 0.563, y: 0.235 },
              { x: 0.443, y: 0.235 },
              { x: 0.427, y: 0.115 },
            ],
          },
          content: {
            html: "A towering column of ash, steam and volcanic gases blasted upward during an explosive eruption. Plumes can rise many kilometres and drift for hundreds more.",
          },
          altText: { [EN]: "Grey eruption column of ash and gas rising above the summit." },
          order: 0,
        },
        {
          id: IDS.crater,
          name: "Summit crater",
          label: { [EN]: "Summit crater" },
          region: { kind: "circle" as const, cx: 0.5, cy: 0.322, r: 0.043 },
          content: {
            html: "The bowl-shaped opening where lava, gas and ash are expelled. Its shape is carved and re-carved by successive eruptions.",
          },
          altText: { [EN]: "Small bowl-shaped depression at the peak of the cone." },
          order: 1,
        },
        {
          id: IDS.conduit,
          name: "Main conduit",
          label: { [EN]: "Main conduit" },
          region: { kind: "rect" as const, x: 0.472, y: 0.335, w: 0.056, h: 0.38 },
          content: {
            html: "The central pipe carrying magma to the surface. As magma rises, pressure drops and dissolved gases expand — accelerating the ascent.",
          },
          altText: { [EN]: "Vertical glowing channel connecting the magma chamber to the crater." },
          order: 2,
        },
        {
          id: IDS.magma,
          name: "Magma chamber",
          label: { [EN]: "Magma chamber" },
          region: { kind: "circle" as const, cx: 0.5, cy: 0.874, r: 0.086 },
          content: {
            html: "A vast underground reservoir of molten rock. Buoyant, gas-rich magma collects here under enormous pressure until it finds a path upward.",
          },
          altText: { [EN]: "Large glowing reservoir of molten rock beneath the volcano." },
          xapi: {
            activityType: "http://adlnet.gov/expapi/activities/cmi.interaction",
            verbOnInteract: "http://adlnet.gov/expapi/verbs/answered",
          },
          assessment: {
            interactionType: "choice" as const,
            prompt: { [EN]: "What mainly drives magma upward through the conduit?" },
            choices: [
              { id: "a", text: { [EN]: "It is colder than the surrounding rock" } },
              { id: "b", text: { [EN]: "Dissolved gases expand as pressure drops" } },
              { id: "c", text: { [EN]: "The crater pulls it upward" } },
              { id: "d", text: { [EN]: "Earthquakes push it up" } },
            ],
            correctResponsesPattern: ["b"],
            score: { min: 0, max: 1, correct: 1 },
            rubricItemId: "R1",
          },
          order: 3,
        },
        {
          id: IDS.lava,
          name: "Lava flow",
          label: { [EN]: "Lava flow" },
          region: {
            kind: "polygon" as const,
            points: [
              { x: 0.515, y: 0.335 },
              { x: 0.535, y: 0.335 },
              { x: 0.74, y: 0.8 },
              { x: 0.69, y: 0.8 },
            ],
          },
          content: {
            html: "Once magma reaches the surface it is called lava. It streams downslope, cooling into fresh rock that builds the mountain higher.",
          },
          altText: { [EN]: "Bright molten lava streaming down the right-hand slope." },
          order: 4,
        },
        {
          id: IDS.strata,
          name: "Rock strata",
          label: { [EN]: "Rock strata" },
          region: { kind: "rect" as const, x: 0.06, y: 0.815, w: 0.88, h: 0.16 },
          content: {
            html: "Alternating layers of hardened lava and compacted ash, laid down eruption after eruption — the signature of a stratovolcano.",
          },
          altText: { [EN]: "Horizontal underground layers of rock and ash." },
          order: 5,
        },
      ],
    },
  ],
  rubrics: [
    {
      id: "R1",
      criterion: { [EN]: "Explains what drives magma ascent" },
      weight: 1,
      masteryThreshold: 1,
    },
  ],
  scoring: { rollup: "weighted" as const, passThreshold: 0.7 },
};

/** Validated at import — a drift from @ob/schema fails the build rather than the runtime. */
export const VOLCANO_DOC: ObservationDoc = parseObservation(raw);

/** Pick a locale from a language map, falling back to the first available. */
export function t(map: Record<string, string> | undefined, locale = EN): string {
  if (!map) return "";
  return map[locale] ?? Object.values(map)[0] ?? "";
}
