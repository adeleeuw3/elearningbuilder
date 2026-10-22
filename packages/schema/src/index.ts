/** Public surface of @ob/schema. */
export * from "./observation";
export * from "./iri";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ObservationDoc, type ObservationDoc as Doc } from "./observation";

/** Parse + validate an observation document. Throws ZodError on invalid input. */
export function parseObservation(input: unknown): Doc {
  return ObservationDoc.parse(input);
}

/** Safe variant returning a result object. */
export function safeParseObservation(input: unknown) {
  return ObservationDoc.safeParse(input);
}

/**
 * Publish gate (WCAG AA + integrity). Returns the list of problems that block publishing.
 * An empty array means the document is publishable. The studio calls this before allowing
 * a Draft -> Published transition.
 */
export function publishBlockers(doc: Doc): string[] {
  const problems: string[] = [];
  const hasText = (m: Record<string, string> | undefined) =>
    !!m && Object.values(m).some((v) => v.trim().length > 0);

  /** Does this block put something visual on screen? Then it owes a text alternative. */
  const carriesVisual = (content: { media?: { kind: string }[] } | undefined) =>
    !!content?.media?.some((m) => m.kind === "image" || m.kind === "video");

  /**
   * Can the LRS tell a right answer from a wrong one for this interaction?
   *
   * An open question cannot: it is recorded, not judged. Demanding a `correctResponsesPattern`
   * there would mean inventing one, and a pattern nothing is measured against is worse than no
   * pattern at all. Every other interaction type still owes one.
   */
  const isJudged = (interactionType: string) => interactionType !== "long-fill-in";

  const rubricIds = new Set(doc.rubrics.map((r) => r.id));

  /** The checks that hold for a hotspot and a stacked block alike. */
  const checkBlock = (
    b: {
      name: string;
      altText?: Record<string, string>;
      content?: { media?: { kind: string }[] };
      assessment?: {
        interactionType: string;
        correctResponsesPattern?: string[];
        rubricItemId?: string;
      };
    },
    where: string,
    altAlwaysRequired: boolean,
  ) => {
    if ((altAlwaysRequired || carriesVisual(b.content)) && !hasText(b.altText)) {
      problems.push(`${where} "${b.name}" is missing altText (a11y)`);
    }
    if (
      b.assessment &&
      isJudged(b.assessment.interactionType) &&
      !b.assessment.correctResponsesPattern?.length
    ) {
      problems.push(`${where} "${b.name}" has an assessment with no correctResponsesPattern`);
    }
    const rid = b.assessment?.rubricItemId;
    if (rid && !rubricIds.has(rid)) {
      problems.push(`${where} references unknown rubricItemId "${rid}"`);
    }
  };

  doc.pages.forEach((page, pi) => {
    if (page.kind === "scene") {
      if (!hasText(page.scene.altText))
        problems.push(`page[${pi}] scene is missing altText (a11y)`);
      // A hotspot is by definition a region on a picture, so altText is always due.
      page.components.forEach((c, ci) => checkBlock(c, `page[${pi}].component[${ci}]`, true));
      return;
    }
    // A stacked block is often just text; the alternative is owed where there is a visual.
    page.blocks.forEach((b, bi) => {
      const where = `page[${pi}].block[${bi}]`;
      checkBlock(b, where, false);
      // A carousel keeps its visuals one level down, where the check above cannot see them. Those
      // pictures are on screen just as much as any other, so they owe the same alternative.
      if (b.kind === "carousel") {
        b.items.forEach((item, ii) => {
          if (carriesVisual(item.content) && !hasText(item.altText)) {
            problems.push(`${where} "${b.name}" item[${ii}] is missing altText (a11y)`);
          }
        });
      }
    });
  });

  return problems;
}

/** Emit the JSON Schema contract (used for docs, external validators, cmi5 tooling). */
export function toJsonSchema() {
  return zodToJsonSchema(ObservationDoc, { name: "ObservationDoc", $refStrategy: "none" });
}

export { z };
