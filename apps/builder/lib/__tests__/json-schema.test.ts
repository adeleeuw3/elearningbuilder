/**
 * Structured outputs stelt harde eisen aan het schema dat je meestuurt. Een overtreding is geen
 * TypeScript-fout — de API antwoordt met 400 op het moment dat een gebruiker het interview start.
 * Deze tests controleren die eisen op de daadwerkelijk gegenereerde JSON Schema, zodat de fout
 * hier zichtbaar wordt en niet in productie.
 *
 * Eisen (uit de Claude-API-documentatie):
 *   · elk object heeft additionalProperties: false
 *   · geen numerieke beperkingen (minimum/maximum/multipleOf)
 *   · geen string-beperkingen (minLength/maxLength)
 *   · geen recursie
 */
import { describe, it, expect } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GeneratedContentSchema,
  InterviewAntwoordSchema,
  SchrijfAntwoordSchema,
  SectieSchema,
  VraagSchema,
} from "../types";

/** Zelfde conversie als lib/claude.ts gebruikt. */
function bouw(schema: Parameters<typeof zodToJsonSchema>[0]) {
  return zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
}

/** Loopt elk genest object af en geeft [pad, node]-paren terug. */
function alleNodes(node: unknown, pad = "$"): [string, Record<string, unknown>][] {
  if (node === null || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    return node.flatMap((k, i) => alleNodes(k, `${pad}[${i}]`));
  }
  const self: [string, Record<string, unknown>][] = [[pad, node as Record<string, unknown>]];
  return self.concat(
    Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
      alleNodes(v, `${pad}.${k}`),
    ),
  );
}

/**
 * Elk schema dat als `schema:` naar `callGestructureerd` gaat.
 *
 * De lijst stond op twee van de vier, en precies daarom glipte er een schema met `minLength` en
 * `maxItems` doorheen: dat gaf een 400 op het moment dat een auteur op Schrijven drukte. Komt er
 * een route bij, dan hoort het schema hier ook bij — dit is de enige plek waar die eis afgedwongen
 * wordt.
 */
const SCHEMAS: [string, Record<string, unknown>][] = [
  ["InterviewAntwoord", bouw(InterviewAntwoordSchema)],
  ["GeneratedContent", bouw(GeneratedContentSchema)],
  ["SchrijfAntwoord", bouw(SchrijfAntwoordSchema)],
  ["Sectie", bouw(SectieSchema)],
  ["Vraag", bouw(VraagSchema)],
];

const VERBODEN_KEYWORDS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
];

describe.each(SCHEMAS)("%s — geldig voor structured outputs", (_naam, schema) => {
  it("zet additionalProperties: false op elk object", () => {
    const overtreders = alleNodes(schema)
      .filter(([, n]) => n["type"] === "object")
      .filter(([, n]) => n["additionalProperties"] !== false)
      .map(([pad]) => pad);
    expect(overtreders).toEqual([]);
  });

  it("gebruikt geen niet-ondersteunde JSON-Schema-keywords", () => {
    const gevonden = alleNodes(schema).flatMap(([pad, n]) =>
      VERBODEN_KEYWORDS.filter((k) => k in n).map((k) => `${pad}.${k}`),
    );
    expect(gevonden).toEqual([]);
  });

  it("bevat geen $ref (alles is geïnlined)", () => {
    expect(JSON.stringify(schema)).not.toContain('"$ref"');
  });
});

describe("InterviewAntwoord — de union komt goed door", () => {
  const schema = bouw(InterviewAntwoordSchema);

  it("vertaalt de discriminated union naar anyOf met drie varianten", () => {
    const varianten = (schema["anyOf"] ?? schema["oneOf"]) as unknown[] | undefined;
    expect(varianten).toHaveLength(3);
  });

  it("houdt alle drie de statuswaarden over", () => {
    const json = JSON.stringify(schema);
    for (const status of ["vraag", "bevestig", "genereer"]) {
      expect(json).toContain(`"${status}"`);
    }
  });

  it("houdt alle vier invoertypes over", () => {
    const json = JSON.stringify(schema);
    for (const t of ["single_select", "multi_select", "text", "text_of_keuze"]) {
      expect(json).toContain(`"${t}"`);
    }
  });
});
