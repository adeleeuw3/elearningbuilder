/**
 * WorkflowCanvas — the node graph.
 *
 * Edge geometry is derived from React state (node x/y) plus each node's measured height,
 * rather than by reading getBoundingClientRect on every frame. Heights come from a single
 * ResizeObserver, so a node whose body grows (a longer status line, a thumbnail) re-routes its
 * wires correctly without any layout thrash.
 *
 * Ports sit at (i + 1) / (n + 1) of the node's height — the same formula NodePort uses for its
 * CSS `top`, which is what keeps the SVG and the DOM in agreement.
 */
"use client";

import * as React from "react";
import { Chip, NodeCard, NodePort, ProgressBar, REST_HEX, TONE_HEX, cn, isTone } from "@ob/ui";
import type { ToneState } from "@ob/ui";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CATEGORY_TONE,
  NODE_WIDTH,
  type PipelineEdge,
  type PipelineNode,
} from "../../lib/pipeline";
import { Scene } from "../Scene";

interface Props {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onOpenDetail: (node: PipelineNode) => void;
}

function edgeStroke(tone: ToneState): string {
  return isTone(tone) ? TONE_HEX[tone].from : REST_HEX;
}

/** Fallback height used for the first paint, before the observer reports real sizes. */
const ASSUMED_HEIGHT = 120;

export function WorkflowCanvas({ nodes, edges, selectedId, onSelect, onMove, onOpenDetail }: Props) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const nodeEls = React.useRef(new Map<string, HTMLDivElement>());
  const [heights, setHeights] = React.useState<Record<string, number>>({});

  // One observer for every node; writes measured heights into state.
  React.useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.nodeId;
          if (!id) continue;
          const h = entry.contentRect.height;
          if (next[id] !== h) {
            next[id] = h;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    for (const el of nodeEls.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [nodes.length]);

  const registerNode = React.useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeEls.current.set(id, el);
    else nodeEls.current.delete(id);
  }, []);

  /* ------------------------------- drag ------------------------------- */
  const dragState = React.useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  const onHeaderPointerDown = (node: PipelineNode) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if ((ev.target as HTMLElement).closest("button")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragState.current = {
      id: node.id,
      dx: ev.clientX - rect.left - node.x,
      dy: ev.clientY - rect.top - node.y,
      moved: false,
    };
    ev.currentTarget.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    d.moved = true;
    const rect = canvas.getBoundingClientRect();
    const h = heights[d.id] ?? ASSUMED_HEIGHT;
    const x = clamp(ev.clientX - rect.left - d.dx, 0, CANVAS_WIDTH - NODE_WIDTH);
    const y = clamp(ev.clientY - rect.top - d.dy, 0, CANVAS_HEIGHT - h);
    onMove(d.id, x, y);
  };

  const endDrag = () => {
    const d = dragState.current;
    dragState.current = null;
    // Swallow the click that follows a drag so dragging doesn't also change selection.
    if (d?.moved) suppressClick.current = true;
  };
  const suppressClick = React.useRef(false);

  /* ------------------------------ geometry ---------------------------- */
  const byId = React.useMemo(() => {
    const m = new Map<string, PipelineNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  function portPoint(id: string, side: "in" | "out", index: number): { x: number; y: number } | null {
    const node = byId.get(id);
    if (!node) return null;
    const list = side === "in" ? node.ins : node.outs;
    const count = list?.length ?? 0;
    if (count === 0) return null;
    const h = heights[id] ?? ASSUMED_HEIGHT;
    return {
      x: side === "in" ? node.x : node.x + NODE_WIDTH,
      y: node.y + (h * (index + 1)) / (count + 1),
    };
  }

  const paths = edges.flatMap((e, i) => {
    const a = portPoint(e.from, "out", e.fromPort);
    const b = portPoint(e.to, "in", e.toPort);
    if (!a || !b) return [];
    const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5);
    const d = `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
    return [{ key: `${e.from}-${e.to}-${i}`, d, tone: e.tone }];
  });

  return (
    <div
      ref={canvasRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative bg-[radial-gradient(circle,rgba(27,30,40,.07)_1px,transparent_1.4px)] bg-[length:22px_22px]"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      >
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            stroke={edgeStroke(p.tone)}
            strokeDasharray={p.tone === "flow" ? "7 8" : p.tone === "rest" ? "4 6" : undefined}
            className={p.tone === "flow" ? "motion-safe:animate-[wf-dash_1.1s_linear_infinite]" : undefined}
          />
        ))}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          data-node-id={node.id}
          ref={(el) => registerNode(node.id, el)}
          className="absolute"
          style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
        >
          <NodeCard
            title={node.title}
            state={node.state}
            categoryTone={CATEGORY_TONE[node.category]}
            icon={node.icon}
            selected={selectedId === node.id}
            onHeaderPointerDown={onHeaderPointerDown(node)}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onSelect(node.id);
            }}
            onDoubleClick={() => node.detailRoute && onOpenDetail(node)}
            className="relative"
          >
            <NodeBody node={node} onOpenDetail={onOpenDetail} />
            {node.ins?.map((tone, i) => (
              <NodePort
                key={`in-${i}`}
                side="in"
                tone={tone}
                style={{ top: `${((i + 1) / (node.ins!.length + 1)) * 100}%` }}
              />
            ))}
            {node.outs?.map((tone, i) => (
              <NodePort
                key={`out-${i}`}
                side="out"
                tone={tone}
                style={{ top: `${((i + 1) / (node.outs!.length + 1)) * 100}%` }}
              />
            ))}
          </NodeCard>
        </div>
      ))}

      <style>{"@keyframes wf-dash { to { stroke-dashoffset: -15; } }"}</style>
    </div>
  );
}

/** Per-node body content. Kept here so the graph stays declarative. */
function NodeBody({
  node,
  onOpenDetail,
}: {
  node: PipelineNode;
  onOpenDetail: (node: PipelineNode) => void;
}) {
  switch (node.id) {
    case "objective":
      return (
        <>
          <p className="text-[12.5px] leading-normal text-ink">
            “Explain the parts of a stratovolcano and how it erupts.”
          </p>
          <Chip tone="glow">{node.status}</Chip>
        </>
      );

    case "illustration":
      return (
        <>
          <Thumb />
          <Chip tone="bloom">{node.status}</Chip>
        </>
      );

    case "chunks":
      return (
        <>
          <ProgressBar value={1} label="Chunking complete" />
          <Chip tone="glow">{node.status}</Chip>
        </>
      );

    case "questions":
      return (
        <>
          <QuestionLine>Which layer holds the magma?</QuestionLine>
          <QuestionLine>What drives magma upward?</QuestionLine>
          <ProgressBar value={0.72} label="Generating questions" />
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="flow">{node.status}</Chip>
            <Chip tone="bloom">AI</Chip>
          </div>
        </>
      );

    case "scene":
      return (
        <>
          <Thumb />
          <Chip tone="glow">{node.status}</Chip>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(node);
            }}
            className={cn(
              "w-full rounded-control border border-stroke bg-card px-3 py-[7px]",
              "text-[12.5px] font-semibold text-ink shadow-elevation",
              "transition-colors duration-snappy ease-snappy hover:bg-card-sub",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
            )}
          >
            Open scene editor
          </button>
        </>
      );

    case "branch":
      return (
        <div className="flex flex-col gap-1.5 text-[11.5px]">
          <div className="flex items-center justify-end gap-2">Beginner → simplified</div>
          <div className="flex items-center justify-end gap-2">Advanced → detailed</div>
        </div>
      );

    case "package":
      return (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="flow">xAPI</Chip>
            <Chip tone="rest">cmi5</Chip>
          </div>
          <span className="text-[11px] tracking-[0.06em] text-ink-faint">{node.status}</span>
        </>
      );

    case "translate":
      return (
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="rest" noDot>
            nl-NL
          </Chip>
          <Chip tone="rest" noDot>
            en-US
          </Chip>
        </div>
      );

    case "publish":
      return (
        <span className="text-[11px] tracking-[0.06em] text-ink-faint">
          LRS-ready ZIP · immutable v1
        </span>
      );

    default:
      return node.status ? <Chip tone="rest">{node.status}</Chip> : null;
  }
}

function Thumb() {
  return (
    <div className="aspect-video overflow-hidden rounded-control border border-stroke">
      <Scene className="h-full w-full" />
    </div>
  );
}

function QuestionLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-glow-from" />
      {children}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
