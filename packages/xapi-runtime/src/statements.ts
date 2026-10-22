/**
 * Statement builders — the canonical encoding of the §D templates.
 *
 * All statements carry actor (prefer account), `context.registration`,
 * `context.platform = "Observation Builder"` and `context.language`.
 *
 * ## contextActivities: waar hangt dit in?
 *
 * `parent` is de **directe** houder van het object, `grouping` zijn de bredere. Een blok hangt dus
 * onder zijn pagina (parent) en daarboven onder de cursus en de activiteit waaronder het LMS/LXP
 * de module gelanceerd heeft (grouping). Zonder dat onderscheid kan een LRS niet per pagina
 * oprollen — dan weet hij alleen dát er een blok bekeken is, niet waar.
 *
 * Een statement over de cursus zélf krijgt geen parent: een activiteit is niet zijn eigen ouder.
 * Om dezelfde reden wordt een grouping-id dat gelijk is aan het object of de parent weggelaten.
 *
 * ## cmi5: category alleen op "defined" statements
 *
 * cmi5 kent *defined* statements (initialized, completed, passed, failed, terminated) die de
 * cmi5-categorie **moeten** dragen, en *allowed* statements (al het andere) die hem juist **niet
 * mogen** dragen. Dat is een MUST NOT in de specificatie, en een LMS kan erop toetsen.
 *
 * These builders are pure — they take primitives and return statement objects. The
 * session (index.ts) supplies actor/registration/parent and hands results to LRSClient.
 */
import { VERBS, ACTIVITY_TYPES, CMI5_CATEGORY } from "@ob/schema";
import type { LaunchConfig } from "./discovery";

export const PLATFORM = "Observation Builder";

type LangMap = Record<string, string>;

export interface StatementContext {
  cfg: LaunchConfig;
  /** Parent/course activity IRI (== manifest activityId). */
  parentActivityId: string;
  /**
   * Bredere houders: de sectie waar de pagina in valt, en de activiteit waaronder het LMS/LXP de
   * module aanbiedt. De cursus wordt automatisch toegevoegd waar hij niet al parent of object is.
   */
  groupingIds?: string[];
  /** Het versienummer van het document, als `context.revision`. */
  revision?: string;
  /** Plaatsing die geen activiteit is: tenant, moduleversie, knoop-id. */
  extensions?: Record<string, unknown>;
}

interface Verb {
  id: string;
  display: LangMap;
}

const verb = (id: string, word: string): Verb => ({ id, display: { "en-US": word } });

interface ContextOpties {
  /**
   * Een cmi5 "defined" statement (initialized/completed/passed/failed/terminated). Alleen die
   * dragen de cmi5-categorie; bij de rest is dat een specificatieovertreding.
   */
  defined: boolean;
  /** De directe houder. Weglaten voor een statement over de cursus zelf. */
  parent?: string | undefined;
  /** Het object van dit statement — om te voorkomen dat het in zijn eigen grouping komt. */
  objectId?: string | undefined;
}

function baseContext(ctx: StatementContext, opts: ContextOpties) {
  const language =
    (typeof navigator !== "undefined" && navigator.language) || "en-US";

  const contextActivities: Record<string, Array<{ id: string }>> = {};
  if (opts.parent) contextActivities.parent = [{ id: opts.parent }];

  // De cursus en de LMS/LXP-activiteit horen bij de bredere houders, behalve waar ze het object
  // of de parent al zijn — een activiteit groepeert zichzelf niet.
  const uitgesloten = new Set([opts.objectId, opts.parent].filter(Boolean) as string[]);
  const grouping = [ctx.parentActivityId, ctx.cfg.activityId, ...(ctx.groupingIds ?? [])]
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .filter((id) => !uitgesloten.has(id));
  const uniek = [...new Set(grouping)];
  if (uniek.length > 0) contextActivities.grouping = uniek.map((id) => ({ id }));

  if (opts.defined && ctx.cfg.cmi5) contextActivities.category = [{ id: CMI5_CATEGORY }];

  return {
    registration: ctx.cfg.registration,
    platform: PLATFORM,
    language,
    ...(ctx.revision ? { revision: ctx.revision } : {}),
    ...(ctx.extensions ? { extensions: ctx.extensions } : {}),
    contextActivities,
  };
}

interface ObjectDef {
  id: string;
  name?: LangMap;
  type?: string;
}

function object(o: ObjectDef) {
  return {
    id: o.id,
    definition: {
      ...(o.type ? { type: o.type } : {}),
      ...(o.name ? { name: o.name } : {}),
    },
  };
}

function stmt(
  ctx: StatementContext,
  v: Verb,
  obj: { id: string } & Record<string, unknown>,
  opts: ContextOpties,
  extra: Record<string, unknown> = {},
) {
  return {
    actor: ctx.cfg.actor,
    verb: v,
    object: obj,
    context: baseContext(ctx, { ...opts, objectId: obj.id }),
    ...extra,
  };
}

/** initialized — on start. */
export function initialized(ctx: StatementContext, name?: LangMap) {
  return stmt(
    ctx,
    verb(VERBS.initialized, "initialized"),
    object({ id: ctx.parentActivityId, type: ACTIVITY_TYPES.course, name }),
    { defined: true },
  );
}

/**
 * experienced — a page or component was viewed.
 *
 * `parent` is de pagina waar het blok op staat; laat hem weg voor een pagina zelf, dan wordt het
 * de cursus.
 */
export function experienced(
  ctx: StatementContext,
  activityId: string,
  activityType: string,
  name?: LangMap,
  parent?: string,
) {
  return stmt(
    ctx,
    verb(VERBS.experienced, "experienced"),
    object({ id: activityId, type: activityType, name }),
    { defined: false, parent: parent ?? ctx.parentActivityId },
  );
}

/** answered — an assessment interaction. */
export function answered(
  ctx: StatementContext,
  questionIri: string,
  opts: {
    name?: LangMap;
    response: string;
    /**
     * Was het antwoord goed?
     *
     * Optioneel, want een open vraag wordt vastgelegd en niet beoordeeld. `false` sturen omdat er
     * geen oordeel is zou de LRS vertellen dat de cursist het fout had — en dat verschijnt in elke
     * rapportage die daarna gedraaid wordt. Weglaten is in xAPI het verschil tussen "fout" en
     * "hier valt niets goed of fout aan".
     */
    success?: boolean;
    score?: { raw: number; min: number; max: number };
    durationSeconds?: number;
    interactionType?: string;
    correctResponsesPattern?: string[];
    /** Het scherm waar de vraag op stond. */
    parent?: string;
  },
) {
  const definition: Record<string, unknown> = {
    type: ACTIVITY_TYPES.cmiInteraction,
    ...(opts.name ? { name: opts.name } : {}),
    ...(opts.interactionType ? { interactionType: opts.interactionType } : {}),
    ...(opts.correctResponsesPattern
      ? { correctResponsesPattern: opts.correctResponsesPattern }
      : {}),
  };
  const result: Record<string, unknown> = { response: opts.response };
  if (opts.success != null) result.success = opts.success;
  if (opts.score) result.score = opts.score;
  if (opts.durationSeconds != null) result.duration = isoDuration(opts.durationSeconds);

  return stmt(
    ctx,
    verb(VERBS.answered, "answered"),
    { id: questionIri, definition },
    { defined: false, parent: opts.parent ?? ctx.parentActivityId },
    { result },
  );
}

/** completed — with duration and optional score. */
export function completed(
  ctx: StatementContext,
  opts: { durationSeconds: number; score?: { raw: number; min: number; max: number; scaled?: number } },
) {
  const result: Record<string, unknown> = { completion: true, duration: isoDuration(opts.durationSeconds) };
  if (opts.score) result.score = opts.score;
  return stmt(
    ctx,
    verb(VERBS.completed, "completed"),
    object({ id: ctx.parentActivityId, type: ACTIVITY_TYPES.course }),
    { defined: true },
    { result },
  );
}

/** passed / failed — success with scaled score (0..1). */
export function passedOrFailed(
  ctx: StatementContext,
  passed: boolean,
  opts: { durationSeconds: number; scaled: number; raw?: number; min?: number; max?: number },
) {
  const v = passed ? verb(VERBS.passed, "passed") : verb(VERBS.failed, "failed");
  const score: Record<string, number> = { scaled: clamp(opts.scaled, 0, 1) };
  if (opts.raw != null) score.raw = opts.raw;
  if (opts.min != null) score.min = opts.min;
  if (opts.max != null) score.max = opts.max;
  return stmt(
    ctx,
    v,
    object({ id: ctx.parentActivityId, type: ACTIVITY_TYPES.course }),
    { defined: true },
    { result: { success: passed, score, duration: isoDuration(opts.durationSeconds) } },
  );
}

/**
 * passed/failed over één assessment binnen de module, in plaats van over de hele cursus.
 *
 * Bestaat apart omdat cmi5 maar één passed/failed per sessie over de AU toestaat: een module met
 * drie tussentoetsen zou anders drie tegenstrijdige eindoordelen sturen. Dit is daarom een
 * *allowed* statement over de assessment-activiteit zelf — zonder cmi5-categorie.
 */
export function assessmentResultaat(
  ctx: StatementContext,
  activityId: string,
  passed: boolean,
  opts: {
    scaled: number;
    raw?: number;
    min?: number;
    max?: number;
    durationSeconds?: number;
    name?: LangMap;
    parent?: string;
  },
) {
  const v = passed ? verb(VERBS.passed, "passed") : verb(VERBS.failed, "failed");
  const score: Record<string, number> = { scaled: clamp(opts.scaled, 0, 1) };
  if (opts.raw != null) score.raw = opts.raw;
  if (opts.min != null) score.min = opts.min;
  if (opts.max != null) score.max = opts.max;
  const result: Record<string, unknown> = { success: passed, score };
  if (opts.durationSeconds != null) result.duration = isoDuration(opts.durationSeconds);

  return stmt(
    ctx,
    v,
    object({ id: activityId, type: ACTIVITY_TYPES.interaction, name: opts.name }),
    { defined: false, parent: opts.parent ?? ctx.parentActivityId },
    { result },
  );
}

/** completed for a media object (D3 template). */
export function mediaCompleted(
  ctx: StatementContext,
  mediaIri: string,
  durationSeconds: number,
  name?: LangMap,
  parent?: string,
) {
  return stmt(
    ctx,
    verb(VERBS.completed, "completed"),
    object({ id: mediaIri, type: ACTIVITY_TYPES.media, name }),
    { defined: false, parent: parent ?? ctx.parentActivityId },
    { result: { duration: isoDuration(durationSeconds) } },
  );
}

/** terminated — required for cmi5 sessions; good practice for xAPI. */
export function terminated(ctx: StatementContext, durationSeconds: number) {
  return stmt(
    ctx,
    verb(VERBS.terminated, "terminated"),
    object({ id: ctx.parentActivityId, type: ACTIVITY_TYPES.course }),
    { defined: true },
    { result: { duration: isoDuration(durationSeconds) } },
  );
}

/** Seconds -> ISO-8601 duration (PT#H#M#S) with 2-decimal seconds. */
export function isoDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = +(s % 60).toFixed(2);
  let out = "PT";
  if (h) out += `${h}H`;
  if (m) out += `${m}M`;
  if (sec || (!h && !m)) out += `${sec}S`;
  return out;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
