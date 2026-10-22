/**
 * Scene editor (M1) — the hotspot authoring canvas.
 *
 * The page owns the observation document in state and threads edits through it. Two things make
 * this the real thing rather than a mock:
 *   · the document is validated by @ob/schema at import (lib/scene-doc.ts),
 *   · `publishBlockers(doc)` runs live on every keystroke, so clearing an alt description
 *     immediately blocks publishing — the same function the API will call.
 */
"use client";

import * as React from "react";
import { Button, Chip, InfoBar, cn } from "@ob/ui";
import { publishBlockers, type Component, type ObservationDoc, type Region } from "@ob/schema";
import { HotspotCanvas, type Tool } from "../../components/scene/HotspotCanvas";
import { PropertiesPanel } from "../../components/scene/PropertiesPanel";
import { VOLCANO_DOC, IDS, t } from "../../lib/scene-doc";
import { describeRegion } from "../../lib/region";

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "select", icon: "▲", label: "Select" },
  { id: "rect", icon: "▭", label: "Draw rectangle" },
  { id: "circle", icon: "◯", label: "Draw circle" },
];

export default function ScenePage() {
  const [doc, setDoc] = React.useState<ObservationDoc>(VOLCANO_DOC);
  const [selectedId, setSelectedId] = React.useState<string | null>(IDS.magma);
  const [tool, setTool] = React.useState<Tool>("select");

  /**
   * Deze editor bewerkt hotspots op een illustratie, en dat kan alleen op een scene-pagina.
   * Sinds `Page` een union is moet dat expliciet: zonder deze afbakening zou hij op een
   * stapel-pagina een lege lijst tonen alsof er niets in staat, terwijl er blokken zijn die hij
   * alleen niet kan bewerken.
   */
  const eerste = doc.pages[0];
  const page = eerste?.kind === "scene" ? eerste : undefined;
  const components = page?.components ?? [];
  const selected = components.find((c) => c.id === selectedId) ?? null;

  /** Live publish gate — the same function the publish endpoint will call. */
  const blockers = React.useMemo(() => publishBlockers(doc), [doc]);

  const updatePage = React.useCallback((fn: (components: Component[]) => Component[]) => {
    setDoc((prev) => {
      const first = prev.pages[0];
      if (first?.kind !== "scene") return prev;
      return {
        ...prev,
        pages: [{ ...first, components: fn(first.components) }, ...prev.pages.slice(1)],
      };
    });
  }, []);

  const patch = React.useCallback(
    (id: string, p: Partial<Component>) =>
      updatePage((cs) => cs.map((c) => (c.id === id ? ({ ...c, ...p } as Component) : c))),
    [updatePage],
  );

  const setRegion = React.useCallback(
    (id: string, region: Region) =>
      updatePage((cs) => cs.map((c) => (c.id === id ? { ...c, region } : c))),
    [updatePage],
  );

  const create = React.useCallback(
    (region: Region) => {
      const id = crypto.randomUUID();
      updatePage((cs) => [
        ...cs,
        {
          id,
          name: `Component ${cs.length + 1}`,
          label: { "en-US": `Component ${cs.length + 1}` },
          region,
          content: { html: "", media: [] },
          // Intentionally empty: publishBlockers() flags it until the author writes one.
          altText: { "en-US": "" },
          xapi: {
            activityType: "http://adlnet.gov/expapi/activities/interaction",
            verbOnInteract: "http://adlnet.gov/expapi/verbs/experienced",
          },
          order: cs.length,
        },
      ]);
      setSelectedId(id);
      setTool("select");
    },
    [updatePage],
  );

  const remove = React.useCallback(
    (id: string) => {
      updatePage((cs) => cs.filter((c) => c.id !== id));
      setSelectedId(null);
    },
    [updatePage],
  );

  return (
    <div className="flex flex-col gap-3.5">
      {blockers.length === 0 ? (
        <InfoBar title="Ready to publish" animate={false}>
          Every component has an alt description. {components.length} components · page “
          {t(page?.title)}”.
        </InfoBar>
      ) : (
        <div
          role="status"
          className="rounded-card border border-transparent bg-bloom-wash p-3.5 shadow-glow-bloom"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-grad-bloom text-[15px] text-bloom-on"
            >
              !
            </span>
            <span className="text-[13.5px] text-bloom-on">
              <b className="block" data-testid="blocker-count">
                {blockers.length} {blockers.length === 1 ? "item blocks" : "items block"} publishing
              </b>
              {blockers[0]}
              {blockers.length > 1 && ` · and ${blockers.length - 1} more`}
            </span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-large">
        <div className="grid h-[640px] min-w-[1060px] grid-cols-[252px_1fr_328px] overflow-hidden rounded-large border border-stroke bg-card shadow-elevation">
          {/* ---------------- components list ---------------- */}
          <aside className="flex min-h-0 flex-col border-r border-stroke">
            <div className="flex items-center justify-between gap-2 border-b border-stroke-soft p-3.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Components
              </span>
              <span className="text-[11px] tracking-[0.06em] text-ink-faint">
                {components.length} ON PAGE
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-b border-stroke-soft p-3.5">
              <button className="shrink-0 rounded-full border border-transparent bg-flow-wash px-2.5 py-1.5 text-[12.5px] font-semibold text-flow-ink shadow-glow-flow">
                {t(page?.title)}
              </button>
              <button className="shrink-0 rounded-full border border-dashed border-stroke px-2.5 py-1.5 text-[12.5px] text-ink-faint">
                + Page
              </button>
            </div>
            <ul role="listbox" aria-label="Components" className="min-h-0 flex-1 overflow-y-auto p-2">
              {components.map((c) => {
                const on = c.id === selectedId;
                const missingAlt = t(c.altText).trim().length === 0;
                return (
                  <li key={c.id}>
                    <button
                      role="option"
                      aria-selected={on}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2.5 text-left text-[13.5px]",
                        "transition-[background-color,box-shadow] duration-flow ease-flow",
                        on ? "bg-flow-wash shadow-glow-flow" : "hover:bg-card-sub",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-control text-[11px]",
                          on ? "bg-grad-flow text-flow-on" : "bg-card-sub text-ink-soft",
                        )}
                      >
                        {c.region.kind === "circle" ? "◯" : c.region.kind === "polygon" ? "⬟" : "▭"}
                      </span>
                      <span className="flex-1 truncate">{t(c.label) || c.name}</span>
                      {c.assessment && (
                        <span className="rounded-full bg-bloom-wash px-1.5 py-0.5 text-[10px] font-semibold text-bloom-ink">
                          Q
                        </span>
                      )}
                      {missingAlt && (
                        <span
                          aria-label="Missing alt description"
                          title="Missing alt description"
                          className="h-2 w-2 shrink-0 rounded-full bg-bloom-from"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {selected && (
              <div className="border-t border-stroke-soft p-3">
                <Button size="sm" block onClick={() => remove(selected.id)}>
                  Delete “{t(selected.label) || selected.name}”
                </Button>
              </div>
            )}
          </aside>

          {/* ---------------- canvas ---------------- */}
          <section className="relative flex min-w-0 flex-col bg-canvas">
            <div
              role="toolbar"
              aria-label="Draw tools"
              className="absolute left-1/2 top-3.5 z-10 flex -translate-x-1/2 gap-[3px] rounded-card border border-stroke bg-[rgba(255,255,255,.68)] p-1.5 shadow-elevation backdrop-blur"
            >
              {TOOLS.map((tl) => (
                <button
                  key={tl.id}
                  title={tl.label}
                  aria-label={tl.label}
                  aria-pressed={tool === tl.id}
                  onClick={() => setTool(tl.id)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-control text-[15px]",
                    "transition-colors duration-snappy ease-snappy",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                    tool === tl.id ? "bg-flow-wash text-flow-ink" : "text-ink-soft hover:bg-card-sub",
                  )}
                >
                  <span aria-hidden="true">{tl.icon}</span>
                </button>
              ))}
              <span aria-hidden="true" className="mx-[3px] my-[5px] w-px bg-stroke" />
              <button
                title="Suggest regions (AI)"
                aria-label="Suggest regions (AI)"
                className="grid h-9 w-9 place-items-center rounded-control text-[15px] text-bloom-ink transition-colors duration-snappy ease-snappy hover:bg-bloom-wash"
              >
                <span aria-hidden="true">✶</span>
              </button>
            </div>

            <div className="grid min-h-0 flex-1 place-items-center px-6 pb-6 pt-[58px]">
              <HotspotCanvas
                components={components}
                selectedId={selectedId}
                tool={tool}
                onSelect={setSelectedId}
                onRegionChange={setRegion}
                onCreate={create}
              />
            </div>

            <div className="flex items-center gap-3.5 border-t border-stroke bg-card px-3.5 py-2.5 text-xs tabular-nums text-ink-faint">
              <span data-testid="coord-readout">
                {selected ? (
                  <>
                    {describeRegion(selected.region).label}
                    {describeRegion(selected.region).values.map(([k, v]) => (
                      <span key={k} className="ml-2.5">
                        <b className="font-semibold text-flow-ink">{k}</b> {v.toFixed(3)}
                      </span>
                    ))}
                  </>
                ) : tool === "select" ? (
                  "Select a component, or pick a draw tool to add one"
                ) : (
                  "Drag on the scene to draw a region"
                )}
              </span>
              <span className="ml-auto">100% · normalized 0–1</span>
            </div>
          </section>

          {/* ---------------- properties ---------------- */}
          <PropertiesPanel component={selected} onPatch={patch} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Chip tone={blockers.length === 0 ? "glow" : "bloom"}>
          {blockers.length === 0 ? "No publish blockers" : `${blockers.length} blockers`}
        </Chip>
        <span className="text-[12.5px] text-ink-faint">
          Validated by <code>publishBlockers()</code> from @ob/schema on every edit.
        </span>
        <span className="ml-auto flex gap-2">
          <Button size="sm">Preview</Button>
          <Button role_="accent" size="sm" disabled={blockers.length > 0}>
            Publish version
          </Button>
        </span>
      </div>
    </div>
  );
}
