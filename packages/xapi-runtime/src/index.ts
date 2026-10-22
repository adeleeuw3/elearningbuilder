/**
 * Runtime entry (bundled to `xapi-bootstrap.js` + `xapi_client_min.js` by esbuild).
 *
 * The exported package's `app.js` imports `createSession()` and drives it as the learner
 * interacts. The renderer (scene + hotspots) is app-level; this module owns only the xAPI
 * lifecycle so statement discipline lives in one tested place.
 *
 * Lifecycle:
 *   createSession() -> discover LRS -> send `initialized`
 *   session.component/page/answer/... -> queued statements
 *   completion -> `completed` (+ `passed`/`failed`)
 *   page unload -> `terminated`
 */
import { discoverLRS, type LaunchConfig } from "./discovery";
import { LRSClient } from "./client";
import * as S from "./statements";
import { iri } from "@ob/schema";

export interface SessionOptions {
  iriBase: string;
  artifactId: string;
  /** Course name for the parent activity (optional). */
  courseName?: Record<string, string>;
  /** Override the discovered/declared parent activityId (defaults to iri.parent). */
  activityIdOverride?: string;
  /**
   * Bredere houders die op elk statement mee moeten: bijvoorbeeld de sectie-activiteit, of de
   * plek in het LMS/LXP als die niet al uit de launch komt.
   */
  groupingIds?: string[];
  /** Documentversie, als `context.revision`. */
  revision?: string;
  /** Plaatsing die geen activiteit is (tenant, moduleversie). Sleutels zijn IRI's. */
  extensions?: Record<string, unknown>;
}

export interface Session {
  readonly ready: boolean;
  readonly launch: LaunchConfig | null;
  readonly pending: number;
  /**
   * Fire `experienced` for a page — en onthoudt hem als huidige pagina, zodat de blokken die
   * daarna vuren hem als `parent` krijgen. Zonder dat weet een LRS niet op welk scherm een blok
   * stond en kan hij niet per pagina oprollen.
   */
  page(pageId: string, name?: Record<string, string>): void;
  /** Fire `experienced` for a component (hotspot). */
  component(
    componentId: string,
    name?: Record<string, string>,
    activityType?: string,
  ): void;
  /**
   * Fire `answered` for a component's assessment.
   *
   * `success` weglaten bij een open vraag: die wordt vastgelegd, niet beoordeeld.
   */
  answer(
    componentId: string,
    opts: {
      name?: Record<string, string>;
      response: string;
      success?: boolean;
      score?: { raw: number; min: number; max: number };
      durationSeconds?: number;
      interactionType?: string;
      correctResponsesPattern?: string[];
    },
  ): void;
  /**
   * Fire `passed`/`failed` voor één assessment binnen de module.
   *
   * Apart van `result()`: dat gaat over de hele cursus, en cmi5 staat daar maar één oordeel per
   * sessie toe. Een module met meerdere tussentoetsen zou anders tegenstrijdige eindoordelen sturen.
   */
  assessment(
    componentId: string,
    passed: boolean,
    opts: {
      scaled: number;
      raw?: number;
      min?: number;
      max?: number;
      durationSeconds?: number;
      name?: Record<string, string>;
    },
  ): void;
  /** Fire `completed` (+ optional score). */
  complete(opts: { durationSeconds: number; score?: { raw: number; min: number; max: number; scaled?: number } }): void;
  /** Fire `passed` or `failed`. */
  result(passed: boolean, opts: { durationSeconds: number; scaled: number; raw?: number; min?: number; max?: number }): void;
  /** Fire `terminated`. Alleen de eerste keer: xAPI kent één afsluiting per sessie. */
  terminate(durationSeconds: number): void;
  /**
   * Waar de cursist gebleven was, via de xAPI State API.
   *
   * Apart van de statements: die vertellen wát er gebeurd is en zijn onveranderlijk, dit vertelt
   * waar iemand gebleven is en wordt overschreven. Zonder LRS doet dit niets en valt de aanroeper
   * terug op zijn eigen opslag.
   */
  state: {
    read(): Promise<unknown | null>;
    write(doc: unknown): Promise<boolean>;
  };
}

/** Session that quietly drops statements when no LRS is present (e.g. local preview). */
function noopSession(reason: string): Session {
  console.warn(`[xapi] no LRS discovered — running without tracking (${reason})`);
  return {
    ready: false,
    launch: null,
    pending: 0,
    page: () => {},
    component: () => {},
    answer: () => {},
    assessment: () => {},
    complete: () => {},
    result: () => {},
    terminate: () => {},
    state: { read: async () => null, write: async () => false },
  };
}

/** De naam waaronder de voortgang in de State API staat. */
const STATE_ID = "ob-progress";

export async function createSession(opts: SessionOptions): Promise<Session> {
  const cfg = await discoverLRS();
  const parentActivityId =
    opts.activityIdOverride ?? cfg?.activityId ?? iri.parent(opts.iriBase, opts.artifactId);

  if (!cfg) return noopSession("discovery returned null");

  const client = new LRSClient(cfg);
  const ctx: S.StatementContext = {
    cfg,
    parentActivityId,
    ...(opts.groupingIds ? { groupingIds: opts.groupingIds } : {}),
    ...(opts.revision ? { revision: opts.revision } : {}),
    ...(opts.extensions ? { extensions: opts.extensions } : {}),
  };

  /**
   * Het scherm waar de cursist nu op staat.
   *
   * Nodig om een blokstatement onder zijn pagina te hangen. De sessie is de enige plek die dit
   * weet: de builders zijn puur en de aanroeper van `component()` heeft de pagina niet bij de hand.
   */
  let huidigePagina: string | undefined;
  /** Is de sessie al afgesloten? Zie `terminate`. */
  let beeindigd = false;

  client.enqueue(S.initialized(ctx, opts.courseName));

  const session: Session = {
    ready: true,
    launch: cfg,
    get pending() {
      return client.pending;
    },
    page(pageId, name) {
      huidigePagina = iri.page(opts.iriBase, opts.artifactId, pageId);
      client.enqueue(
        S.experienced(ctx, huidigePagina, "http://adlnet.gov/expapi/activities/lesson", name),
      );
    },
    component(componentId, name, activityType) {
      client.enqueue(
        S.experienced(
          ctx,
          iri.component(opts.iriBase, opts.artifactId, componentId),
          activityType ?? "http://adlnet.gov/expapi/activities/interaction",
          name,
          huidigePagina,
        ),
      );
    },
    answer(componentId, o) {
      client.enqueue(
        S.answered(ctx, iri.question(opts.iriBase, opts.artifactId, componentId), {
          ...o,
          ...(huidigePagina ? { parent: huidigePagina } : {}),
        }),
      );
    },
    assessment(componentId, passed, o) {
      client.enqueue(
        S.assessmentResultaat(
          ctx,
          iri.component(opts.iriBase, opts.artifactId, componentId),
          passed,
          { ...o, ...(huidigePagina ? { parent: huidigePagina } : {}) },
        ),
      );
    },
    complete(o) {
      client.enqueue(S.completed(ctx, o));
    },
    result(passed, o) {
      client.enqueue(S.passedOrFailed(ctx, passed, o));
    },
    terminate(durationSeconds) {
      // Eén afsluiting per sessie. De cursist kan zelf afsluiten én daarna het venster dichtdoen;
      // zonder deze grendel stuurt dat twee `terminated`-statements en ziet de LRS twee sessies.
      if (beeindigd) return;
      beeindigd = true;
      client.enqueue(S.terminated(ctx, durationSeconds));
    },
    state: {
      read: () => client.readState(parentActivityId, STATE_ID),
      write: (doc) => client.writeState(parentActivityId, STATE_ID, doc),
    },
  };

  // Best-effort terminate on unload.
  if (typeof window !== "undefined") {
    const start = Date.now();
    window.addEventListener("pagehide", () => session.terminate((Date.now() - start) / 1000), { once: true });
  }

  return session;
}

export { discoverLRS } from "./discovery";
export { LRSClient } from "./client";
export * as statements from "./statements";
export type { LaunchConfig } from "./discovery";
