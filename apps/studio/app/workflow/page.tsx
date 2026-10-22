/**
 * The Workflow screen — the primary authoring surface.
 *
 * Owns graph state (positions, selection) and composes the canvas, the category rail, the
 * add-node palette and the inspector. Persistence lands in M1; for now the graph is seeded from
 * lib/pipeline.ts so the interaction model can be reviewed end to end.
 */
"use client";

import * as React from "react";
import { Button, Chip } from "@ob/ui";
import { WorkflowCanvas } from "../../components/workflow/WorkflowCanvas";
import { NodeInspector } from "../../components/workflow/NodeInspector";
import { AddNodeMenu } from "../../components/workflow/AddNodeMenu";
import {
  CATEGORY_TONE,
  VOLCANO_EDGES,
  VOLCANO_PIPELINE,
  type NodeCategory,
  type PipelineNode,
} from "../../lib/pipeline";

const RAIL: { icon: string; title: string; category?: NodeCategory }[] = [
  { icon: "◧", title: "Sources", category: "source" },
  { icon: "✶", title: "Generate (AI)", category: "generate" },
  { icon: "⇄", title: "Transform", category: "transform" },
  { icon: "⑂", title: "Logic", category: "logic" },
  { icon: "▦", title: "Composite", category: "composite" },
  { icon: "⇥", title: "Export", category: "output" },
];

export default function WorkflowPage() {
  const [nodes, setNodes] = React.useState<PipelineNode[]>(VOLCANO_PIPELINE);
  const [selectedId, setSelectedId] = React.useState<string | null>("scene");
  const [addOpen, setAddOpen] = React.useState(false);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const move = React.useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const addNode = React.useCallback((label: string, category: NodeCategory) => {
    const id = `${category}-${Date.now().toString(36)}`;
    setNodes((prev) => [
      ...prev,
      {
        id,
        title: label,
        category,
        state: "rest",
        icon: "◧",
        x: 700,
        y: 620,
        ins: ["rest"],
        outs: ["rest"],
        description: `A new ${label} node. Connect it to feed the pipeline.`,
      },
    ]);
    setSelectedId(id);
  }, []);

  const openDetail = React.useCallback((node: PipelineNode) => {
    // Scene editor lands next; this is the seam it plugs into.
    if (node.detailRoute) window.location.assign(node.detailRoute);
  }, []);

  return (
    <div className="grid h-[660px] grid-cols-[60px_1fr_306px] overflow-hidden rounded-large border border-stroke bg-card shadow-elevation">
      {/* category rail */}
      <aside
        aria-label="Node categories"
        className="flex flex-col items-center gap-1 border-r border-stroke bg-card py-2"
      >
        {RAIL.map((r) => (
          <button
            key={r.title}
            title={r.title}
            data-add-trigger
            onClick={() => setAddOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-control text-base text-ink-soft transition-colors duration-snappy ease-snappy hover:bg-card-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
          >
            <span aria-hidden="true">{r.icon}</span>
          </button>
        ))}
      </aside>

      {/* canvas column */}
      <div className="relative flex min-w-0 flex-col bg-canvas">
        <div className="flex items-center gap-2.5 border-b border-stroke bg-[rgba(255,255,255,.68)] px-3.5 py-2.5 backdrop-blur">
          <span className="flex items-center gap-2.5 rounded-control border border-stroke bg-card px-3 py-[7px] text-sm font-semibold">
            <span aria-hidden="true" className="h-[18px] w-[18px] rounded-control bg-grad-flow" />
            Volcano micro-lesson
          </span>
          <Chip tone="glow">Draft v3</Chip>
          <span className="ml-auto flex items-center gap-2">
            <Button role_="subtle" size="sm">
              Validate
            </Button>
            <Button size="sm">Run pipeline</Button>
            <Button role_="accent" size="sm">
              Export package
            </Button>
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <WorkflowCanvas
            nodes={nodes}
            edges={VOLCANO_EDGES}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={move}
            onOpenDetail={openDetail}
          />
        </div>

        <AddNodeMenu open={addOpen} onClose={() => setAddOpen(false)} onAdd={addNode} />

        {/* canvas toolbar */}
        <div
          role="toolbar"
          aria-label="Canvas tools"
          className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-[3px] rounded-card border border-stroke bg-[rgba(255,255,255,.68)] p-1.5 shadow-elevation backdrop-blur"
        >
          <ToolButton label="Add node" onClick={() => setAddOpen((v) => !v)} addTrigger>
            ＋
          </ToolButton>
          <ToolButton label="Select" active>
            ▲
          </ToolButton>
          <ToolButton label="Pan">✋</ToolButton>
          <span aria-hidden="true" className="mx-[3px] my-[5px] w-px bg-stroke" />
          <ToolButton label="Group">▢</ToolButton>
          <ToolButton label="Connect">⌥</ToolButton>
        </div>
      </div>

      <NodeInspector node={selected} onOpenDetail={openDetail} />
    </div>
  );
}

function ToolButton({
  label,
  children,
  active,
  onClick,
  addTrigger,
}: {
  label: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  addTrigger?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      {...(addTrigger ? { "data-add-trigger": true } : {})}
      className={`grid h-9 w-9 place-items-center rounded-control text-[15px] transition-colors duration-snappy ease-snappy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink ${
        active ? "bg-flow-wash text-flow-ink" : "text-ink-soft hover:bg-card-sub"
      }`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
