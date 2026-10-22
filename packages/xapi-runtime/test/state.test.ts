/**
 * @vitest-environment jsdom
 *
 * De State API en de afsluitgrendel.
 *
 * Twee dingen liggen hier vast. Ten eerste dat voortgang naar de plek gaat die de xAPI-spec ervoor
 * heeft (`activities/state`, met agent en registration erbij) en niet naar een verzonnen endpoint —
 * anders leest een andere speler hem nooit terug. Ten tweede dat een sessie maar één keer afsluit:
 * de cursist kan zelf op "afsluiten" drukken én daarna het venster dichtdoen, en twee
 * `terminated`-statements laten de LRS twee sessies zien waar er één was.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LRSClient } from "../src/client";
import { createSession } from "../src/index";
import type { LaunchConfig } from "../src/discovery";

const cfg: LaunchConfig = {
  endpoint: "https://lrs.example.org/data/xAPI/",
  auth: "Basic dXNlcjpwd2Q=",
  actor: { objectType: "Agent", account: { homePage: "https://ob.example", name: "u-123" } },
  registration: "8f1c0e2a-1111-4222-8333-444444444444",
  source: "lms-global",
  cmi5: false,
};

const ACTIVITY = "https://xapi.example.com/acme/artifacts/A1";

/** Alle fetch-aanroepen van deze test, in volgorde. */
let aanroepen: { url: string; init?: RequestInit }[] = [];

function stubFetch(antwoord: (url: string) => Response) {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    aanroepen.push({ url: String(url), init });
    return Promise.resolve(antwoord(String(url)));
  });
}

beforeEach(() => {
  aanroepen = [];
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("State API", () => {
  it("schrijft naar activities/state met agent, stateId en registration", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const client = new LRSClient(cfg);
    const ok = await client.writeState(ACTIVITY, "ob-progress", { v: 1 });

    expect(ok).toBe(true);
    const url = new URL(aanroepen[0]!.url);
    expect(url.pathname).toBe("/data/xAPI/activities/state");
    expect(url.searchParams.get("activityId")).toBe(ACTIVITY);
    expect(url.searchParams.get("stateId")).toBe("ob-progress");
    expect(url.searchParams.get("registration")).toBe(cfg.registration);
    expect(JSON.parse(url.searchParams.get("agent")!)).toEqual(cfg.actor);

    const init = aanroepen[0]!.init!;
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["X-Experience-API-Version"]).toBe("1.0.3");
    expect((init.headers as Record<string, string>).Authorization).toBe(cfg.auth);
  });

  it("laat registration weg als er geen is", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const { registration: _weg, ...zonder } = cfg;
    await new LRSClient(zonder).writeState(ACTIVITY, "ob-progress", {});
    expect(new URL(aanroepen[0]!.url).searchParams.has("registration")).toBe(false);
  });

  it("leest een bewaard document terug", async () => {
    stubFetch(() => new Response(JSON.stringify({ v: 1, gezien: { b1: true } }), { status: 200 }));
    const uit = await new LRSClient(cfg).readState(ACTIVITY, "ob-progress");
    expect(uit).toEqual({ v: 1, gezien: { b1: true } });
  });

  it("geeft null als er nog niets staat", async () => {
    stubFetch(() => new Response(null, { status: 404 }));
    expect(await new LRSClient(cfg).readState(ACTIVITY, "ob-progress")).toBeNull();
  });

  it("geeft null in plaats van te werpen als de LRS stukgaat", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("netwerk weg")));
    expect(await new LRSClient(cfg).readState(ACTIVITY, "ob-progress")).toBeNull();
    expect(await new LRSClient(cfg).writeState(ACTIVITY, "ob-progress", {})).toBe(false);
  });
});

describe("de sessie", () => {
  /** Een sessie met een ontdekte LRS: de global-launch is de kortste weg daarnaartoe. */
  async function sessie() {
    (window as unknown as { LMSLaunchData: unknown }).LMSLaunchData = {
      endpoint: cfg.endpoint,
      auth: cfg.auth,
      actor: cfg.actor,
      registration: cfg.registration,
    };
    return createSession({
      iriBase: "https://xapi.example.com/acme",
      artifactId: "9ab3f1c2-7d4e-4a6b-8c0d-1e2f3a4b5c6d",
    });
  }

  /** De verstuurde statements, na een tik zodat de wachtrij geleegd is. */
  async function verstuurd(): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 30));
    return aanroepen
      .filter((a) => a.url.indexOf("statements") >= 0)
      .map((a) => String(a.init?.body ?? ""));
  }

  it("sluit maar één keer af, ook als er twee keer om gevraagd wordt", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const s = await sessie();
    s.terminate(12);
    s.terminate(34); // bijvoorbeeld: eerst de afsluitknop, daarna het venster dicht

    const eindes = (await verstuurd()).filter((b) => b.indexOf("/verbs/terminated") >= 0);
    expect(eindes).toHaveLength(1);
    expect(eindes[0]).toContain("PT12S");
  });

  it("hangt de voortgang aan de activiteit van de module, niet aan een los blok", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const s = await sessie();
    await s.state.write({ v: 1 });

    const state = aanroepen.find((a) => a.url.indexOf("activities/state") >= 0)!;
    expect(new URL(state.url).searchParams.get("activityId")).toBe(
      "https://xapi.example.com/acme/artifacts/9ab3f1c2-7d4e-4a6b-8c0d-1e2f3a4b5c6d",
    );
  });

  it("doet niets met voortgang als er geen LRS is — dan valt de speler terug op zijn eigen opslag", async () => {
    delete (window as unknown as { LMSLaunchData?: unknown }).LMSLaunchData;
    stubFetch(() => new Response(null, { status: 204 }));
    const s = await createSession({
      iriBase: "https://xapi.example.com/acme",
      artifactId: "9ab3f1c2-7d4e-4a6b-8c0d-1e2f3a4b5c6d",
    });
    expect(s.ready).toBe(false);
    expect(await s.state.read()).toBeNull();
    expect(await s.state.write({ v: 1 })).toBe(false);
  });
});
