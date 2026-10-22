/**
 * PropertiesPanel — everything about the selected component.
 *
 * The xAPI section shows the IRI built by `iri.*` from @ob/schema rather than a string the UI
 * assembles itself, so what an author sees here is exactly what the exported package will send.
 *
 * Learn content is edited in a textarea, never rendered as HTML. Authored markup must be
 * sanitized on save AND on render (security invariant #4); until the `Sanitized` wrapper lands
 * with the rich-text editor, a plain textarea is the correct, safe surface for it.
 */
"use client";

import * as React from "react";
import { Chip, cn } from "@ob/ui";
import { ACTIVITY_TYPES, VERBS, iri, type Component } from "@ob/schema";
import { describeRegion } from "../../lib/region";
import { IRI_BASE, IDS, t } from "../../lib/scene-doc";

interface Props {
  component: Component | null;
  onPatch: (id: string, patch: Partial<Component>) => void;
}

const VERB_OPTIONS = [
  { id: VERBS.experienced, label: "experienced" },
  { id: VERBS.answered, label: "answered" },
  { id: VERBS.completed, label: "completed" },
] as const;

const TYPE_OPTIONS = [
  { id: ACTIVITY_TYPES.interaction, label: "interaction" },
  { id: ACTIVITY_TYPES.cmiInteraction, label: "cmi.interaction" },
  { id: ACTIVITY_TYPES.media, label: "media" },
] as const;

export function PropertiesPanel({ component: c, onPatch }: Props) {
  if (!c) {
    return (
      <aside className="overflow-y-auto border-l border-stroke bg-card">
        <p className="p-8 text-center text-[13px] text-ink-faint">
          Nothing selected. Pick a component, or draw a new region on the scene.
        </p>
      </aside>
    );
  }

  const isAnswered = c.xapi.verbOnInteract === VERBS.answered;
  const componentIri = iri.component(IRI_BASE, IDS.artifact, c.id);
  const questionIri = iri.question(IRI_BASE, IDS.artifact, c.id);
  const altOk = t(c.altText).trim().length > 0;
  const region = describeRegion(c.region);

  return (
    <aside className="overflow-y-auto border-l border-stroke bg-card">
      <Section label="Label · learner-facing">
        <input
          value={t(c.label)}
          onChange={(e) => onPatch(c.id, { label: { "en-US": e.target.value } })}
          className={FIELD}
          aria-label="Component label"
        />
      </Section>

      <Section label="Learn content">
        <textarea
          value={c.content.html}
          onChange={(e) => onPatch(c.id, { content: { ...c.content, html: e.target.value } })}
          rows={5}
          aria-label="Learn content"
          className={cn(FIELD, "resize-none leading-relaxed")}
        />
        <p className="mt-2 text-[11px] text-ink-faint">
          Sanitized on save and on render — never injected as raw HTML.
        </p>
      </Section>

      <Section label="Region · normalized 0–1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="rest" noDot>
            {region.label}
          </Chip>
          {region.values.map(([k, v]) => (
            <span
              key={k}
              className="rounded-control bg-card-sub px-2 py-1 text-[11px] tabular-nums text-ink-soft"
            >
              <b className="font-semibold text-flow-ink">{k}</b> {v.toFixed(3)}
            </span>
          ))}
        </div>
      </Section>

      <Section label="xAPI event on interact">
        <label className="mb-2 block">
          <span className="sr-only">Activity type</span>
          <select
            value={c.xapi.activityType}
            onChange={(e) => onPatch(c.id, { xapi: { ...c.xapi, activityType: e.target.value } })}
            className={FIELD}
            aria-label="Activity type"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-1.5">
          {VERB_OPTIONS.map((v) => {
            const on = c.xapi.verbOnInteract === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onPatch(c.id, { xapi: { ...c.xapi, verbOnInteract: v.id } })}
                aria-pressed={on}
                className={cn(
                  "rounded-full px-[11px] py-1 text-xs font-semibold transition-colors duration-snappy ease-snappy",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                  on ? "bg-flow-wash text-flow-ink" : "bg-card-sub text-ink-soft hover:text-ink",
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 break-all rounded-control border border-stroke-soft bg-card-sub px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-soft">
          {isAnswered ? questionIri : componentIri}
        </p>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          Built by <code>iri.{isAnswered ? "question" : "component"}()</code> — identical to what the
          package sends.
        </p>
      </Section>

      {c.assessment && (
        <Section label={`Assessment · rubric ${c.assessment.rubricItemId ?? "—"}`}>
          <div className="rounded-control border border-stroke-soft bg-card-sub p-3">
            <p className="mb-2.5 text-[13px] font-medium text-ink">{t(c.assessment.prompt)}</p>
            {c.assessment.choices?.map((choice) => {
              const correct = c.assessment?.correctResponsesPattern?.includes(choice.id) ?? false;
              return (
                <div
                  key={choice.id}
                  className={cn(
                    "flex items-center gap-2.5 py-1 text-[12.5px]",
                    correct ? "font-semibold text-glow-ink" : "text-ink-soft",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-control border text-[10px]",
                      correct
                        ? "border-transparent bg-grad-glow text-glow-on"
                        : "border-stroke bg-card",
                    )}
                  >
                    {correct ? "✓" : ""}
                  </span>
                  {t(choice.text)}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section label="Alt description · required to publish">
        <textarea
          value={t(c.altText)}
          onChange={(e) => onPatch(c.id, { altText: { "en-US": e.target.value } })}
          rows={2}
          aria-label="Alt description"
          className={cn(
            FIELD,
            "resize-none leading-relaxed",
            !altOk && "border-bloom-from shadow-glow-bloom",
          )}
        />
        <div className="mt-2.5">
          {altOk ? (
            <Chip tone="glow">WCAG AA · publishable</Chip>
          ) : (
            <Chip tone="bloom">Needed before publish</Chip>
          )}
        </div>
      </Section>
    </aside>
  );
}

const FIELD =
  "w-full rounded-control border border-stroke bg-card px-2.5 py-2 text-[13.5px] text-ink focus:border-flow-from focus:shadow-glow-flow focus:outline-none";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-stroke-soft p-3.5">
      <span className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      {children}
    </div>
  );
}
