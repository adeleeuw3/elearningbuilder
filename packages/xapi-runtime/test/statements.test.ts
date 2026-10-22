/**
 * Statement-snapshot discipline (plans/01 §8). These lock the JSON shapes for each verb so
 * any drift is an intentional, reviewed change. `navigator.language` and timestamps are
 * normalized so snapshots are deterministic.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import * as S from "../src/statements";
import type { LaunchConfig } from "../src/discovery";

const cfg: LaunchConfig = {
  endpoint: "https://lrs.example.com/xapi/",
  auth: "Basic REDACTED", // never a real secret in tests
  actor: { objectType: "Agent", account: { homePage: "https://ob.example", name: "u-123" } },
  registration: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  source: "url",
  cmi5: false,
};

const ctx: S.StatementContext = { cfg, parentActivityId: "https://xapi.example.com/acme/artifacts/A1" };

beforeAll(() => {
  vi.stubGlobal("navigator", { language: "en-US" });
});

describe("statement shapes", () => {
  it("initialized", () => {
    expect(S.initialized(ctx, { "en-US": "Volcano" })).toMatchInlineSnapshot(`
      {
        "actor": {
          "account": {
            "homePage": "https://ob.example",
            "name": "u-123",
          },
          "objectType": "Agent",
        },
        "context": {
          "contextActivities": {},
          "language": "en-US",
          "platform": "Observation Builder",
          "registration": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        },
        "object": {
          "definition": {
            "name": {
              "en-US": "Volcano",
            },
            "type": "http://adlnet.gov/expapi/activities/course",
          },
          "id": "https://xapi.example.com/acme/artifacts/A1",
        },
        "verb": {
          "display": {
            "en-US": "initialized",
          },
          "id": "http://adlnet.gov/expapi/verbs/initialized",
        },
      }
    `);
  });

  it("experienced (component)", () => {
    expect(
      S.experienced(ctx, "https://xapi.example.com/acme/artifacts/A1/components/C1", "http://adlnet.gov/expapi/activities/interaction", { "en-US": "Magma chamber" }),
    ).toMatchInlineSnapshot(`
      {
        "actor": {
          "account": {
            "homePage": "https://ob.example",
            "name": "u-123",
          },
          "objectType": "Agent",
        },
        "context": {
          "contextActivities": {
            "parent": [
              {
                "id": "https://xapi.example.com/acme/artifacts/A1",
              },
            ],
          },
          "language": "en-US",
          "platform": "Observation Builder",
          "registration": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        },
        "object": {
          "definition": {
            "name": {
              "en-US": "Magma chamber",
            },
            "type": "http://adlnet.gov/expapi/activities/interaction",
          },
          "id": "https://xapi.example.com/acme/artifacts/A1/components/C1",
        },
        "verb": {
          "display": {
            "en-US": "experienced",
          },
          "id": "http://adlnet.gov/expapi/verbs/experienced",
        },
      }
    `);
  });

  it("answered", () => {
    expect(
      S.answered(ctx, "https://xapi.example.com/acme/artifacts/A1/components/C1/q", {
        name: { "en-US": "Which layer?" },
        response: "crust",
        success: true,
        score: { raw: 1, min: 0, max: 1 },
        interactionType: "choice",
        correctResponsesPattern: ["crust"],
      }),
    ).toMatchInlineSnapshot(`
      {
        "actor": {
          "account": {
            "homePage": "https://ob.example",
            "name": "u-123",
          },
          "objectType": "Agent",
        },
        "context": {
          "contextActivities": {
            "parent": [
              {
                "id": "https://xapi.example.com/acme/artifacts/A1",
              },
            ],
          },
          "language": "en-US",
          "platform": "Observation Builder",
          "registration": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        },
        "object": {
          "definition": {
            "correctResponsesPattern": [
              "crust",
            ],
            "interactionType": "choice",
            "name": {
              "en-US": "Which layer?",
            },
            "type": "http://adlnet.gov/expapi/activities/cmi.interaction",
          },
          "id": "https://xapi.example.com/acme/artifacts/A1/components/C1/q",
        },
        "result": {
          "response": "crust",
          "score": {
            "max": 1,
            "min": 0,
            "raw": 1,
          },
          "success": true,
        },
        "verb": {
          "display": {
            "en-US": "answered",
          },
          "id": "http://adlnet.gov/expapi/verbs/answered",
        },
      }
    `);
  });

  it("answered laat success weg bij een open vraag — die wordt vastgelegd, niet beoordeeld", () => {
    // `success: false` sturen omdat er geen oordeel is zou in elke rapportage als een fout antwoord
    // opduiken. In xAPI is een ontbrekende `success` het verschil tussen "fout" en "niet beoordeeld".
    const s = S.answered(ctx, "https://xapi.example.com/acme/artifacts/A1/components/C9/q", {
      name: { "nl-NL": "Jouw kijk" },
      response: "Snelheid van de techniek versus de doorlooptijd van een onderzoek.",
      interactionType: "long-fill-in",
    });
    const result = (s as { result: Record<string, unknown> }).result;
    expect(result).not.toHaveProperty("success");
    expect(result.response).toContain("doorlooptijd");
    expect(
      (s.object as { definition: { interactionType?: string } }).definition.interactionType,
    ).toBe("long-fill-in");
  });

  it("passed adds cmi5 category when launched via cmi5", () => {
    const cmi5Ctx = { ...ctx, cfg: { ...cfg, cmi5: true } };
    const s = S.passedOrFailed(cmi5Ctx, true, { durationSeconds: 123, scaled: 0.9, raw: 9, min: 0, max: 10 });
    expect((s.context as any).contextActivities.category[0].id).toBe(
      "https://w3id.org/xapi/cmi5/context/categories/cmi5",
    );
  });
});

describe("isoDuration", () => {
  it("formats seconds", () => {
    expect(S.isoDuration(0)).toBe("PT0S");
    expect(S.isoDuration(5)).toBe("PT5S");
    expect(S.isoDuration(65)).toBe("PT1M5S");
    expect(S.isoDuration(3723.5)).toBe("PT1H2M3.5S");
  });
});

/* ------------------------------------------------------- cmi5: waar de categorie hoort */

const CMI5_CAT = "https://w3id.org/xapi/cmi5/context/categories/cmi5";
const cmi5Ctx: S.StatementContext = { ...ctx, cfg: { ...cfg, cmi5: true } };
const cats = (s: unknown): string[] =>
  ((s as any).context.contextActivities.category ?? []).map((c: any) => c.id);
const parents = (s: unknown): string[] =>
  ((s as any).context.contextActivities.parent ?? []).map((c: any) => c.id);
const groupings = (s: unknown): string[] =>
  ((s as any).context.contextActivities.grouping ?? []).map((c: any) => c.id);

describe("cmi5-categorie", () => {
  it("staat op de defined statements", () => {
    expect(cats(S.initialized(cmi5Ctx))).toEqual([CMI5_CAT]);
    expect(cats(S.completed(cmi5Ctx, { durationSeconds: 10 }))).toEqual([CMI5_CAT]);
    expect(cats(S.passedOrFailed(cmi5Ctx, true, { durationSeconds: 1, scaled: 1 }))).toEqual([
      CMI5_CAT,
    ]);
    expect(cats(S.terminated(cmi5Ctx, 5))).toEqual([CMI5_CAT]);
  });

  it("staat NIET op de allowed statements — dat is een MUST NOT in cmi5", () => {
    expect(cats(S.experienced(cmi5Ctx, "https://x/p/1", "t"))).toEqual([]);
    expect(cats(S.answered(cmi5Ctx, "https://x/q/1", { response: "a", success: true }))).toEqual([]);
    expect(cats(S.mediaCompleted(cmi5Ctx, "https://x/m/1", 5))).toEqual([]);
    expect(cats(S.assessmentResultaat(cmi5Ctx, "https://x/a/1", true, { scaled: 1 }))).toEqual([]);
  });

  it("staat er nooit op zonder cmi5-launch", () => {
    expect(cats(S.initialized(ctx))).toEqual([]);
  });
});

/* ------------------------------------------------- waar hangt het in het LMS/LXP */

describe("contextActivities", () => {
  const COURSE = "https://xapi.example.com/acme/artifacts/A1";
  const PAGINA = "https://xapi.example.com/acme/artifacts/A1/pages/p1";
  const BLOK = "https://xapi.example.com/acme/artifacts/A1/components/c1";

  it("zet een blok onder zijn pagina, met de cursus als bredere houder", () => {
    const s = S.experienced(ctx, BLOK, "t", undefined, PAGINA);
    expect(parents(s)).toEqual([PAGINA]);
    expect(groupings(s)).toContain(COURSE);
  });

  it("zet een pagina onder de cursus", () => {
    expect(parents(S.experienced(ctx, PAGINA, "t"))).toEqual([COURSE]);
  });

  it("geeft een statement over de cursus geen parent — niets is zijn eigen ouder", () => {
    const s = S.initialized(ctx);
    expect(parents(s)).toEqual([]);
    expect(groupings(s)).not.toContain(COURSE);
  });

  it("neemt de activiteit waaronder het LMS/LXP lanceerde mee als grouping", () => {
    const lms = "https://lms.example/courses/42/au/1";
    const metLms: S.StatementContext = { ...ctx, cfg: { ...cfg, activityId: lms } };
    expect(groupings(S.experienced(metLms, PAGINA, "t"))).toContain(lms);
  });

  it("neemt de opgegeven secties mee, zonder duplicaten", () => {
    const sectie = "https://xapi.example.com/acme/artifacts/A1/sections/s1";
    const metSectie: S.StatementContext = { ...ctx, groupingIds: [sectie, sectie, COURSE] };
    const g = groupings(S.experienced(metSectie, PAGINA, "t"));
    expect(g.filter((x) => x === sectie)).toHaveLength(1);
    // De cursus is hier al parent, dus hij hoort niet óók in grouping.
    expect(g).not.toContain(COURSE);
  });

  it("draagt revision en extensions door", () => {
    const rijk: S.StatementContext = {
      ...ctx,
      revision: "3",
      extensions: { "https://ob.example/ext/tenant": "acme" },
    };
    const s = S.experienced(rijk, PAGINA, "t") as any;
    expect(s.context.revision).toBe("3");
    expect(s.context.extensions["https://ob.example/ext/tenant"]).toBe("acme");
  });
});

describe("assessmentResultaat", () => {
  it("meldt over zijn eigen activiteit, niet over de cursus", () => {
    const s = S.assessmentResultaat(ctx, "https://x/a/1", false, {
      scaled: 0.4,
      raw: 2,
      min: 0,
      max: 5,
    }) as any;
    expect(s.object.id).toBe("https://x/a/1");
    expect(s.verb.id).toBe("http://adlnet.gov/expapi/verbs/failed");
    expect(s.result.success).toBe(false);
    expect(s.result.score).toEqual({ scaled: 0.4, raw: 2, min: 0, max: 5 });
  });
});
