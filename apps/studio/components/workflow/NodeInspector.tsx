/**
 * NodeInspector — the right-hand panel. Explains the selected node in plain language, shows its
 * parameters, and lists its typed connections. Copy is written from the author's side of the
 * screen: what the node does, not how it's wired internally.
 */
"use client";

import * as React from "react";
import { Button, Chip, REST_HEX, TONE_HEX, isTone } from "@ob/ui";
import type { ToneState } from "@ob/ui";
import { CATEGORY_LABEL, type PipelineNode } from "../../lib/pipeline";

interface Props {
  node: PipelineNode | null;
  onOpenDetail: (node: PipelineNode) => void;
}

export function NodeInspector({ node, onOpenDetail }: Props) {
  if (!node) {
    return (
      <aside className="overflow-y-auto border-l border-stroke bg-card">
        <p className="p-8 text-center text-[13px] text-ink-faint">
          Nothing selected. Pick a node on the canvas to see what it does.
        </p>
      </aside>
    );
  }

  return (
    <aside className="overflow-y-auto border-l border-stroke bg-card">
      <div className="border-b border-stroke-soft p-3.5">
        <Chip tone={node.state === "locked" ? "rest" : node.state}>{CATEGORY_LABEL[node.category]}</Chip>
        <h2 className="mt-2 text-xl font-semibold -tracking-[0.01em]">{node.title}</h2>
      </div>

      <Section label="What it does">
        <p className="text-[13.5px] leading-relaxed text-ink-soft">{node.description}</p>
      </Section>

      <Section label="Parameters">
        <Parameters node={node} />
      </Section>

      <Section label="Connections">
        {node.ins?.length ? (
          node.ins.map((tone, i) => <Port key={`in-${i}`} tone={tone} dir="in" />)
        ) : (
          <p className="py-1 text-[12.5px] text-ink-faint">no inputs · source</p>
        )}
        {node.outs?.length ? (
          node.outs.map((tone, i) => <Port key={`out-${i}`} tone={tone} dir="out" />)
        ) : (
          <p className="py-1 text-[12.5px] text-ink-faint">no outputs · sink</p>
        )}
      </Section>

      {node.detailRoute && (
        <Section>
          <Button role_="accent" block onClick={() => onOpenDetail(node)}>
            Open scene editor
          </Button>
        </Section>
      )}
    </aside>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-stroke-soft p-3.5">
      {label && (
        <span className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function Port({ tone, dir }: { tone: ToneState; dir: "in" | "out" }) {
  const color = isTone(tone) ? TONE_HEX[tone].from : REST_HEX;
  return (
    <div className="flex items-center gap-2.5 py-1 text-[12.5px] text-ink-soft">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      {dir === "in" ? "input" : "output"} · {tone === "rest" ? "pending" : tone}
    </div>
  );
}

/** Node-specific controls. Real forms land with the persistence layer in M1. */
function Parameters({ node }: { node: PipelineNode }) {
  const select = (options: string[], label: string) => (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        defaultValue={options[0]}
        className="w-full rounded-control border border-stroke bg-card px-2.5 py-2 text-[13.5px] text-ink focus:border-flow-from focus:shadow-glow-flow focus:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  switch (node.id) {
    case "objective":
      return (
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="rest" noDot>
            en-US
          </Chip>
          <Chip tone="rest" noDot>
            Bloom: Understand
          </Chip>
        </div>
      );
    case "illustration":
      return select(["Realistic illustration", "Line diagram", "Cutaway"], "Image model");
    case "chunks":
      return select(["B1 (simplified)", "C1 (detailed)"], "Reading level");
    case "questions":
      return (
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="rest" noDot>
            4 multiple choice
          </Chip>
          <Chip tone="rest" noDot>
            rubric R1
          </Chip>
        </div>
      );
    case "scene":
      return (
        <Chip tone="rest" noDot>
          normalized 0–1 coordinates
        </Chip>
      );
    case "branch":
      return (
        <Chip tone="rest" noDot>
          if level = beginner
        </Chip>
      );
    case "package":
      return select(["xAPI (tincan.xml)", "cmi5 (cmi5.xml)"], "Export profile");
    case "translate":
      return <p className="text-[12.5px] text-ink-faint">Unlocks when Package completes.</p>;
    case "publish":
      return <p className="text-[12.5px] text-ink-faint">Emits an export audit entry.</p>;
    default:
      return <p className="text-[12.5px] text-ink-faint">No parameters.</p>;
  }
}
