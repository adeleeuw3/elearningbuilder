/**
 * LRS autodiscovery — ships with NO preconfigured credentials (security invariant #3).
 *
 * Discovery order (per spec):
 *   1. cmi5 fetch      — query params endpoint/fetch/registration/activityId/actor; POST fetch -> auth-token
 *   2. LaunchR         — ADL xAPI Launch: xAPILaunchService + xAPILaunchKey; POST -> {endpoint, actor, auth}
 *   3. window.LMSLaunchData — some LMSs inject launch data as a global
 *   4. URL params      — endpoint/auth/actor/registration/activity_id (Rustici-style launch link)
 *   5. manifest / well-known — DEV ONLY, gated behind the __DEV_LRS__ build flag
 *
 * The result never contains anything about our own infrastructure — only the customer LRS.
 */

// Replaced at build time by esbuild `define`. Defaults to false in production bundles.
declare const __DEV_LRS__: boolean;
const DEV_LRS = typeof __DEV_LRS__ !== "undefined" ? __DEV_LRS__ : false;

export type LaunchSource = "cmi5" | "launchr" | "lms-global" | "url" | "manifest";

export interface LaunchConfig {
  /** LRS statements endpoint base, normalized to end WITHOUT a trailing "statements". */
  endpoint: string;
  /** Full value for the Authorization header, e.g. "Basic dXNlcjpwd2Q=". */
  auth: string;
  /** xAPI Agent identifying the learner. */
  actor: XapiAgent;
  registration?: string;
  activityId?: string;
  source: LaunchSource;
  /** True when launched via cmi5 (adds the cmi5 context category to defined statements). */
  cmi5: boolean;
}

export interface XapiAgent {
  objectType?: "Agent";
  name?: string;
  account?: { homePage: string; name: string };
  mbox?: string;
  mbox_sha1sum?: string;
}

function qp(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function normalizeEndpoint(ep: string): string {
  // Ensure a single trailing slash so we can append "statements".
  return ep.replace(/\/+$/, "") + "/";
}

function parseActor(raw: string | null | undefined): XapiAgent | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as XapiAgent;
  } catch {
    return undefined;
  }
}

/** A privacy-preserving fallback actor (account-based, no PII) when none is provided. */
function anonymousActor(): XapiAgent {
  return {
    objectType: "Agent",
    account: { homePage: window.location.origin || "urn:observation-builder", name: "anonymous" },
    name: "Anonymous learner",
  };
}

async function tryCmi5(): Promise<LaunchConfig | null> {
  const p = qp();
  const endpoint = p.get("endpoint");
  const fetchUrl = p.get("fetch");
  const actor = parseActor(p.get("actor"));
  if (!endpoint || !fetchUrl || !actor) return null;

  const res = await fetch(fetchUrl, { method: "POST" });
  if (!res.ok) throw new Error(`cmi5 fetch failed: ${res.status}`);
  const data = (await res.json()) as { "auth-token"?: string; error?: unknown };
  const token = data["auth-token"];
  if (!token) throw new Error("cmi5 fetch returned no auth-token");

  return {
    endpoint: normalizeEndpoint(endpoint),
    auth: `Basic ${token}`,
    actor,
    registration: p.get("registration") ?? undefined,
    activityId: p.get("activityId") ?? undefined,
    source: "cmi5",
    cmi5: true,
  };
}

async function tryLaunchR(): Promise<LaunchConfig | null> {
  const p = qp();
  const service = p.get("xAPILaunchService");
  const key = p.get("xAPILaunchKey");
  if (!service || !key) return null;

  const url = service.replace(/\/+$/, "/") + "launch/" + encodeURIComponent(key);
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`LaunchR failed: ${res.status}`);
  const d = (await res.json()) as {
    endpoint: string;
    auth: string;
    actor: XapiAgent;
    registration?: string;
  };
  return {
    endpoint: normalizeEndpoint(d.endpoint),
    auth: d.auth,
    actor: d.actor,
    registration: d.registration,
    source: "launchr",
    cmi5: false,
  };
}

function tryGlobal(): LaunchConfig | null {
  const g = (window as unknown as { LMSLaunchData?: Partial<LaunchConfig> }).LMSLaunchData;
  if (!g || !g.endpoint || !g.auth || !g.actor) return null;
  return {
    endpoint: normalizeEndpoint(g.endpoint),
    auth: g.auth,
    actor: g.actor as XapiAgent,
    registration: g.registration,
    activityId: g.activityId,
    source: "lms-global",
    cmi5: !!g.cmi5,
  };
}

function tryUrl(): LaunchConfig | null {
  const p = qp();
  const endpoint = p.get("endpoint");
  const auth = p.get("auth");
  if (!endpoint || !auth) return null;
  return {
    endpoint: normalizeEndpoint(endpoint),
    auth,
    actor: parseActor(p.get("actor")) ?? anonymousActor(),
    registration: p.get("registration") ?? undefined,
    activityId: p.get("activity_id") ?? p.get("activityId") ?? undefined,
    source: "url",
    cmi5: false,
  };
}

async function tryManifestDev(): Promise<LaunchConfig | null> {
  if (!DEV_LRS) return null; // hard-gated: never runs in production bundles
  try {
    const res = await fetch("./lrs.dev.json", { cache: "no-store" });
    if (!res.ok) return null;
    const d = (await res.json()) as { endpoint: string; auth: string; actor?: XapiAgent };
    return {
      endpoint: normalizeEndpoint(d.endpoint),
      auth: d.auth,
      actor: d.actor ?? anonymousActor(),
      source: "manifest",
      cmi5: false,
    };
  } catch {
    return null;
  }
}

/** Run the discovery chain in order. Returns null if no LRS could be discovered. */
export async function discoverLRS(): Promise<LaunchConfig | null> {
  // Ordered, short-circuiting. Network steps are awaited; sync steps are cheap.
  const steps: Array<() => Promise<LaunchConfig | null> | LaunchConfig | null> = [
    tryCmi5,
    tryLaunchR,
    tryGlobal,
    tryUrl,
    tryManifestDev,
  ];
  for (const step of steps) {
    try {
      const cfg = await step();
      if (cfg) return cfg;
    } catch (err) {
      // A launch mechanism was present but failed; log and continue to the next.
      // (e.g. cmi5 params present but the fetch URL is down.)
      console.warn(`[xapi] discovery step failed:`, err);
    }
  }
  return null;
}
