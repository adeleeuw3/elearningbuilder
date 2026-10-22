/**
 * The authoring pipeline model — a node graph, one node one job.
 *
 * Node *categories* describe what a node does; node *states* describe where it is in its
 * lifecycle. They are separate on purpose: Prism allows one glow per element, so state owns
 * the glow and the category only tints the icon tile (see @ob/ui NodeCard).
 *
 * Edge tone = the tone of the data on the wire, so the canvas reads as a data-flow diagram
 * rather than a decorated flowchart.
 */
import type { Tone, ToneState } from "@ob/ui";

export type NodeCategory =
  | "source"
  | "generate"
  | "transform"
  | "logic"
  | "composite"
  | "output";

export interface PipelineNode {
  id: string;
  title: string;
  category: NodeCategory;
  /** Lifecycle state — owns the glow. */
  state: ToneState;
  icon: string;
  /** Canvas position in px. */
  x: number;
  y: number;
  /** Typed input/output ports, in render order (top → bottom). */
  ins?: ToneState[];
  outs?: ToneState[];
  /** Plain-language explanation shown in the inspector. */
  description: string;
  /** Short status line rendered in the node body. */
  status?: string;
  /** Opens a dedicated editor rather than being configured inline. */
  detailRoute?: string;
}

export interface PipelineEdge {
  from: string;
  fromPort: number;
  to: string;
  toPort: number;
  tone: ToneState;
}

/** Which Prism pair tints a category's icon tile. Only AI generation is Bloom. */
export const CATEGORY_TONE: Record<NodeCategory, Tone | "none"> = {
  source: "glow",
  generate: "bloom",
  transform: "none",
  logic: "none",
  composite: "flow",
  output: "none",
};

export const CATEGORY_LABEL: Record<NodeCategory, string> = {
  source: "Source · input",
  generate: "Generation · AI",
  transform: "Transformation",
  logic: "Logic · branch",
  composite: "Composite · scene",
  output: "Output · package",
};

/** The worked example: a volcano micro-lesson. */
export const VOLCANO_PIPELINE: PipelineNode[] = [
  {
    id: "objective",
    title: "Learning objective",
    category: "source",
    state: "glow",
    icon: "◧",
    x: 36,
    y: 320,
    outs: ["glow"],
    status: "complete",
    description:
      "The seed of the lesson — every node downstream derives from this single objective.",
  },
  {
    id: "illustration",
    title: "Generate illustration",
    category: "generate",
    state: "bloom",
    icon: "✶",
    x: 336,
    y: 96,
    ins: ["glow"],
    outs: ["bloom"],
    status: "AI · realistic",
    description:
      "Produces a realistic cross-section from the objective. Provider-abstracted, so the image model is swappable.",
  },
  {
    id: "chunks",
    title: "Microlearning chunks",
    category: "transform",
    state: "glow",
    icon: "⇄",
    x: 336,
    y: 318,
    ins: ["glow"],
    outs: ["glow"],
    status: "5 chunks · B1",
    description: "Reformats explanatory text into short, digestible on-screen blocks.",
  },
  {
    id: "questions",
    title: "Generate questions",
    category: "generate",
    state: "flow",
    icon: "✶",
    x: 336,
    y: 528,
    ins: ["glow"],
    outs: ["flow"],
    status: "running · 3 of 4",
    description:
      "Drafts multiple-choice checks, each bound to a rubric item. This node is both AI and busy — Prism allows one glow, so its running state (Flow) owns the glow and the AI category shows as a Bloom chip.",
  },
  {
    id: "scene",
    title: "Scene + hotspots",
    category: "composite",
    state: "glow",
    icon: "▦",
    x: 648,
    y: 196,
    ins: ["bloom", "glow"],
    outs: ["glow"],
    status: "6 hotspots",
    description:
      "Places interactive hotspots on the scene. Coordinates stay normalized 0–1 so the artifact renders identically at any size.",
    detailRoute: "/scene",
  },
  {
    id: "branch",
    title: "Branch · audience",
    category: "logic",
    state: "rest",
    icon: "⑂",
    x: 948,
    y: 318,
    ins: ["glow"],
    outs: ["glow", "glow"],
    description: "Routes the flow by learner level — how you build adaptive, branching paths.",
  },
  {
    id: "package",
    title: "Package xAPI / cmi5",
    category: "output",
    state: "rest",
    icon: "⇥",
    x: 1246,
    y: 262,
    ins: ["glow", "flow"],
    outs: ["glow"],
    status: "activityId ✓ · secret-scan ✓",
    description:
      "Builds the static ZIP, runs the secret-scan, and asserts the manifest activityId equals the runtime parent IRI.",
  },
  {
    id: "translate",
    title: "Translate NL ⇄ EN",
    category: "transform",
    state: "locked",
    icon: "⇄",
    x: 1524,
    y: 262,
    ins: ["glow"],
    outs: ["glow"],
    description:
      "Locked until the package validates. Spins out language variants from one source pipeline.",
  },
  {
    id: "publish",
    title: "Publish",
    category: "output",
    state: "locked",
    icon: "⤴",
    x: 1798,
    y: 318,
    ins: ["glow"],
    description:
      "The finished, offline-capable package leaves the pipeline and an export audit entry is written.",
  },
];

export const VOLCANO_EDGES: PipelineEdge[] = [
  { from: "objective", fromPort: 0, to: "illustration", toPort: 0, tone: "glow" },
  { from: "objective", fromPort: 0, to: "chunks", toPort: 0, tone: "glow" },
  { from: "objective", fromPort: 0, to: "questions", toPort: 0, tone: "glow" },
  { from: "illustration", fromPort: 0, to: "scene", toPort: 0, tone: "bloom" },
  { from: "chunks", fromPort: 0, to: "scene", toPort: 1, tone: "glow" },
  { from: "scene", fromPort: 0, to: "branch", toPort: 0, tone: "glow" },
  { from: "branch", fromPort: 0, to: "package", toPort: 0, tone: "glow" },
  { from: "branch", fromPort: 1, to: "package", toPort: 0, tone: "glow" },
  { from: "questions", fromPort: 0, to: "package", toPort: 1, tone: "flow" },
  { from: "package", fromPort: 0, to: "translate", toPort: 0, tone: "rest" },
  { from: "translate", fromPort: 0, to: "publish", toPort: 0, tone: "rest" },
];

/** Node types offered by the add-node palette, grouped the way authors think. */
export const NODE_LIBRARY: { group: string; items: { label: string; category: NodeCategory }[] }[] = [
  {
    group: "Content",
    items: [
      { label: "Learning objective", category: "source" },
      { label: "Draft explanatory text", category: "generate" },
      { label: "Microlearning chunks", category: "transform" },
    ],
  },
  {
    group: "Image",
    items: [
      { label: "Generate illustration", category: "generate" },
      { label: "Enhance / upscale", category: "transform" },
    ],
  },
  {
    group: "Assessment",
    items: [{ label: "Generate questions", category: "generate" }],
  },
  {
    group: "Logic & composite",
    items: [
      { label: "Branch by audience", category: "logic" },
      { label: "Scene + hotspots", category: "composite" },
    ],
  },
  {
    group: "Localisation & export",
    items: [
      { label: "Translate NL ⇄ EN", category: "transform" },
      { label: "Package xAPI / cmi5", category: "output" },
      { label: "Publish to LRS", category: "output" },
    ],
  },
];

export const CANVAS_WIDTH = 2040;
export const CANVAS_HEIGHT = 790;
export const NODE_WIDTH = 216;
