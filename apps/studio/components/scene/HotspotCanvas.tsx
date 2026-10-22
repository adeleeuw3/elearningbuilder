/**
 * HotspotCanvas — the core authoring verb: drawing interactive regions onto the illustration.
 *
 * All pointer maths converts to normalized 0..1 immediately (`toNorm`), so nothing in state is
 * ever a pixel. Three gestures share one pointer pipeline:
 *   draw   — rect/circle tool: drag on empty canvas to create a component
 *   move   — drag a selected hotspot's body
 *   resize — drag one of its four corner handles
 *
 * Polygon regions render (and can be moved/scaled) but per-vertex editing is not built yet.
 */
"use client";

import * as React from "react";
import { cn } from "@ob/ui";
import type { Component, Region } from "@ob/schema";
import { Scene } from "../Scene";
import {
  boundingBox,
  clamp01,
  moveRegion,
  polygonClipPath,
  regionFromDrag,
  resizeRegion,
  type Handle,
} from "../../lib/region";

export type Tool = "select" | "rect" | "circle";

interface Props {
  components: Component[];
  selectedId: string | null;
  tool: Tool;
  onSelect: (id: string | null) => void;
  onRegionChange: (id: string, region: Region) => void;
  onCreate: (region: Region) => void;
  /** Which components a learner has already explored — drives the Glow "done" treatment. */
  doneIds?: ReadonlySet<string>;
}

interface Point {
  x: number;
  y: number;
}

/** Mutated in place on a ref — see the note in the component. */
type Gesture =
  | { kind: "draw"; from: Point; to: Point }
  | { kind: "move"; id: string; last: Point }
  | { kind: "resize"; id: string; handle: Handle };

export function HotspotCanvas({
  components,
  selectedId,
  tool,
  onSelect,
  onRegionChange,
  onCreate,
  doneIds,
}: Props) {
  const stageRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * The live gesture lives in a ref, not state. Pointer events can arrive faster than React
   * commits a render, and a handler reading lagged state drops the first move of a quick drag
   * (leaving a degenerate 1%-wide region) and makes drags jitter. The ref is always current;
   * `drawBox` mirrors it into state purely so the dashed preview can render.
   */
  const gestureRef = React.useRef<Gesture | null>(null);
  const [drawBox, setDrawBox] = React.useState<{ from: Point; to: Point } | null>(null);

  /** Pointer → normalized scene coordinates. */
  const toNorm = React.useCallback((ev: { clientX: number; clientY: number }): Point => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) };
  }, []);

  const onStagePointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "select") return; // clicks on empty canvas clear selection via onClick
    const p = toNorm(ev);
    gestureRef.current = { kind: "draw", from: p, to: p };
    setDrawBox({ from: p, to: p });
    ev.currentTarget.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g) return;
    const p = toNorm(ev);

    if (g.kind === "draw") {
      g.to = p;
      setDrawBox({ from: g.from, to: p });
      return;
    }
    if (g.kind === "move") {
      const current = components.find((c) => c.id === g.id);
      if (current) onRegionChange(g.id, moveRegion(current.region, p.x - g.last.x, p.y - g.last.y));
      g.last = p;
      return;
    }
    const current = components.find((c) => c.id === g.id);
    if (current) onRegionChange(g.id, resizeRegion(current.region, g.handle, p.x, p.y));
  };

  const endGesture = () => {
    const g = gestureRef.current;
    gestureRef.current = null;
    setDrawBox(null);
    if (g?.kind === "draw") {
      // Ignore an accidental click rather than creating an invisible region.
      if (Math.abs(g.to.x - g.from.x) > 0.008 && Math.abs(g.to.y - g.from.y) > 0.008) {
        onCreate(regionFromDrag(tool === "circle" ? "circle" : "rect", g.from, g.to));
      }
    }
  };

  const preview = drawBox ? boundingBox(regionFromDrag("rect", drawBox.from, drawBox.to)) : null;

  return (
    <div
      ref={stageRef}
      data-testid="stage"
      onPointerDown={onStagePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onSelect(null);
      }}
      className={cn(
        "relative aspect-[1000/700] w-full max-w-[650px] overflow-hidden rounded-card border border-stroke shadow-elevation",
        tool !== "select" && "cursor-crosshair",
      )}
    >
      <Scene className="h-full w-full" />

      {components.map((c) => {
        const b = boundingBox(c.region);
        const selected = c.id === selectedId;
        const done = doneIds?.has(c.id) ?? false;
        const clip = polygonClipPath(c.region);
        return (
          <button
            key={c.id}
            data-hotspot={c.id}
            aria-label={c.name}
            aria-pressed={selected}
            onPointerDown={(ev) => {
              if (tool !== "select") return;
              ev.stopPropagation();
              onSelect(c.id);
              gestureRef.current = { kind: "move", id: c.id, last: toNorm(ev) };
              stageRef.current?.setPointerCapture(ev.pointerId);
            }}
            onClick={(ev) => ev.stopPropagation()}
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              ...(clip ? { clipPath: clip } : {}),
            }}
            className={cn(
              "absolute border-2 p-0 transition-[box-shadow,background-color] duration-flow ease-flow",
              c.region.kind === "circle" ? "rounded-full" : clip ? "rounded-none" : "rounded-control",
              selected
                ? "z-20 border-flow-from bg-[rgba(90,184,255,.22)] shadow-glow-flow"
                : done
                  ? "border-glow-from bg-[rgba(255,216,84,.18)] shadow-glow-glow"
                  : "border-white/85 bg-[rgba(27,30,40,.14)] hover:bg-white/20",
              tool === "select" && "cursor-move",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-2.5 -top-2.5 grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold shadow-elevation",
                selected
                  ? "bg-grad-flow text-flow-on"
                  : done
                    ? "bg-grad-glow text-glow-on"
                    : "bg-card text-ink-soft",
              )}
            >
              {(c.order ?? 0) + 1}
            </span>

            {selected &&
              (["tl", "tr", "bl", "br"] as Handle[]).map((h) => (
                <span
                  key={h}
                  data-handle={h}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    gestureRef.current = { kind: "resize", id: c.id, handle: h };
                    stageRef.current?.setPointerCapture(ev.pointerId);
                  }}
                  className={cn(
                    "absolute h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-flow-from bg-card",
                    h === "tl" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                    h === "tr" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                    h === "bl" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                    h === "br" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                  )}
                />
              ))}
          </button>
        );
      })}

      {/* live preview of the region being drawn */}
      {preview && (
        <span
          aria-hidden="true"
          style={{
            left: `${preview.x * 100}%`,
            top: `${preview.y * 100}%`,
            width: `${preview.w * 100}%`,
            height: `${preview.h * 100}%`,
          }}
          className={cn(
            "pointer-events-none absolute z-30 border-2 border-dashed border-flow-from bg-[rgba(90,184,255,.16)]",
            tool === "circle" ? "rounded-full" : "rounded-control",
          )}
        />
      )}
    </div>
  );
}
