/**
 * Server-only Anthropic-client. Wordt UITSLUITEND vanuit app/api/* geïmporteerd.
 *
 * Belangrijk voor de veiligheid: dit bestand leest ANTHROPIC_API_KEY. Importeer het nooit
 * vanuit een client component — alles wat vanuit de client bereikbaar is, belandt in de
 * browserbundel. Het "server-only" import bovenaan laat de build falen als dat toch gebeurt.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { repareerJson } from "./json-repair";
import { JSON_RETRY_NUDGE } from "./prompts";

/** Opus 5 — de sterkste keuze voor dit werk; zie README voor de afweging. */
export const MODEL = "claude-opus-5";

/** Onze eigen foutklasse, zodat routes een nette code kunnen teruggeven. */
export class ClaudeFout extends Error {
  constructor(
    message: string,
    readonly code:
      | "geen_api_key"
      | "model_weigering"
      | "ongeldig_json"
      | "rate_limit"
      | "onbekend",
  ) {
    super(message);
    this.name = "ClaudeFout";
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeFout(
      "Er is geen ANTHROPIC_API_KEY ingesteld. Zet die in apps/builder/.env.local en start de server opnieuw.",
      "geen_api_key",
    );
  }
  client ??= new Anthropic();
  return client;
}

/** Plakt alle text-blokken uit een antwoord aan elkaar. */
function pakTekst(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Zet een Zod-schema om in de JSON Schema die structured outputs verwacht.
 *
 * We gebruiken niet de meegeleverde `zodOutputFormat`-helper: die verwacht een Zod v4-schema
 * (`import * as z from "zod/v4"`) en dit project draait op de klassieke v3-API. Zelf converteren
 * houdt één bron van waarheid (de Zod-schema's in types.ts) én voorkomt versiekoppeling.
 *
 * Twee opties zijn hier belangrijk, en niet cosmetisch:
 *   · GEEN `name`. Met een naam wikkelt zod-to-json-schema het resultaat in
 *     `{"$ref": "#/definitions/Naam", "definitions": {...}}`. De API verwacht dat `schema` het
 *     schema zélf is, niet een verwijzing ernaar — met een naam volgt een 400.
 *   · `$refStrategy: "none"` inlinet alle definities, zodat er geen losse $ref overblijft.
 *
 * Onze objecten zijn `.strict()`, wat naar `additionalProperties: false` vertaalt; dat is een
 * harde eis van structured outputs. lib/__tests__/json-schema.test.ts controleert dit alles.
 */
function naarJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
}

export interface CallOpties<S extends z.ZodTypeAny> {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens: number;
}

/**
 * Doet één modelaanroep met een gegarandeerd schema, en valideert het resultaat met Zod.
 *
 * Waarom `client.beta.messages` en niet `messages.parse()`: we willen ook `fallbacks: "default"`,
 * wat een beta-parameter is. Die laat de API een geweigerd verzoek server-side opnieuw draaien op
 * een ander model in plaats van de weigering aan ons terug te geven. Voor dit domein (Nederlandse
 * e-learning) is een weigering onwaarschijnlijk, maar het kost hier één regel.
 *
 * Bij een parse- of validatiefout volgt precies één retry met een expliciete JSON-nudge.
 */
export async function callGestructureerd<S extends z.ZodTypeAny>(
  opties: CallOpties<S>,
): Promise<z.infer<S>> {
  const { system, messages, schema, effort, maxTokens } = opties;
  const anthropic = getClient();

  async function eenPoging(
    berichten: Anthropic.Beta.BetaMessageParam[],
  ): Promise<{ ok: true; data: z.infer<S> } | { ok: false; ruw: string; reden: string }> {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // De system prompt is byte-stabiel en gaat elke beurt mee: cachen scheelt kosten.
      // Onder de cache-drempel (512 tokens op Opus 5) cachet de API stil niet — geen fout.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: berichten,
      // Structured outputs: de API dwingt het schema af.
      output_config: {
        effort,
        format: { type: "json_schema", schema: naarJsonSchema(schema) },
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    // Altijd stop_reason checken vóór content lezen: bij een weigering is content leeg of partieel.
    if (response.stop_reason === "refusal") {
      throw new ClaudeFout(
        "Het model heeft dit verzoek geweigerd. Pas de formulering aan en probeer het opnieuw.",
        "model_weigering",
      );
    }

    const ruw = pakTekst(response.content);
    let ontleed: unknown;
    try {
      ontleed = JSON.parse(repareerJson(ruw));
    } catch {
      return { ok: false, ruw, reden: "geen geldige JSON" };
    }

    const resultaat = schema.safeParse(ontleed);
    if (!resultaat.success) {
      return { ok: false, ruw, reden: resultaat.error.issues[0]?.message ?? "schema mismatch" };
    }
    return { ok: true, data: resultaat.data };
  }

  try {
    const eerste = await eenPoging(messages);
    if (eerste.ok) return eerste.data;

    // Eén retry: het mislukte antwoord terug in het gesprek + expliciete nudge.
    const tweede = await eenPoging([
      ...messages,
      { role: "assistant", content: eerste.ruw || "(leeg antwoord)" },
      { role: "user", content: JSON_RETRY_NUDGE },
    ]);
    if (tweede.ok) return tweede.data;

    throw new ClaudeFout(
      `Het model gaf geen bruikbaar antwoord (${tweede.reden}). Probeer het opnieuw.`,
      "ongeldig_json",
    );
  } catch (fout) {
    throw naarClaudeFout(fout);
  }
}

/** Zet SDK-fouten om in onze eigen foutklasse, met een boodschap in de juiste toon. */
function naarClaudeFout(fout: unknown): ClaudeFout {
  if (fout instanceof ClaudeFout) return fout;

  if (fout instanceof Anthropic.RateLimitError) {
    return new ClaudeFout(
      "Te veel verzoeken achter elkaar. Wacht een moment en probeer het opnieuw.",
      "rate_limit",
    );
  }
  if (fout instanceof Anthropic.AuthenticationError) {
    return new ClaudeFout(
      "De API-key wordt niet geaccepteerd. Controleer ANTHROPIC_API_KEY in .env.local.",
      "geen_api_key",
    );
  }
  if (fout instanceof Anthropic.APIError) {
    return new ClaudeFout(
      `De AI-dienst gaf een fout (${fout.status ?? "onbekend"}). Probeer het opnieuw.`,
      "onbekend",
    );
  }
  return new ClaudeFout("Er ging iets onverwacht mis. Probeer het opnieuw.", "onbekend");
}
