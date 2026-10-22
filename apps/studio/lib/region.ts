/**
 * Region geometry. Everything here works in normalized 0..1 space — the renderer converts to
 * pixels only at the last moment, which is what lets one authored artifact render identically
 * on an authoring canvas, a laptop and a phone.
 */
import type { Region } from "@ob/schema";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The axis-aligned bounding box of any region kind, in normalized space. */
export function boundingBox(region: Region): Box {
  switch (region.kind) {
    case "rect":
      return { x: region.x, y: region.y, w: region.w, h: region.h };
    case "circle":
      return { x: region.cx - region.r, y: region.cy - region.r, w: region.r * 2, h: region.r * 2 };
    case "polygon": {
      const xs = region.points.map((p) => p.x);
      const ys = region.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
  }
}

/** CSS `clip-path` for a polygon, expressed relative to its own bounding box. */
export function polygonClipPath(region: Region): string | undefined {
  if (region.kind !== "polygon") return undefined;
  const b = boundingBox(region);
  if (b.w === 0 || b.h === 0) return undefined;
  const pts = region.points
    .map((p) => `${(((p.x - b.x) / b.w) * 100).toFixed(2)}% ${(((p.y - b.y) / b.h) * 100).toFixed(2)}%`)
    .join(", ");
  return `polygon(${pts})`;
}

/**
 * Translate a region by a normalized delta, keeping it inside the scene.
 *
 * The delta is clamped so the whole bounding box stays in [0,1]. A circle derives its centre
 * from the clamped box (`cx = boxX + r`) rather than adding the delta to `cx`: at an edge the
 * clamp makes `b.x + ddx` exactly 0, so the resulting bounding box is exactly flush. Adding the
 * delta directly leaves a ~1e-17 overhang, which is meaningless on screen but makes boundary
 * reasoning (and tests) needlessly fuzzy.
 */
export function moveRegion(region: Region, dx: number, dy: number): Region {
  const b = boundingBox(region);
  const ddx = Math.min(1 - (b.x + b.w), Math.max(-b.x, dx));
  const ddy = Math.min(1 - (b.y + b.h), Math.max(-b.y, dy));
  switch (region.kind) {
    case "rect":
      return { ...region, x: b.x + ddx, y: b.y + ddy };
    case "circle":
      return { ...region, cx: b.x + ddx + region.r, cy: b.y + ddy + region.r };
    case "polygon":
      return { ...region, points: region.points.map((p) => ({ x: p.x + ddx, y: p.y + ddy })) };
  }
}

export type Handle = "tl" | "tr" | "bl" | "br";

/** Minimum size so a region can't be resized into nothing. */
const MIN = 0.01;

/**
 * Resize by dragging a corner. Rect and polygon scale their bounding box; a circle stays a
 * circle (radius follows the smaller axis) because a squashed circle isn't a circle.
 */
export function resizeRegion(region: Region, handle: Handle, nx: number, ny: number): Region {
  const b = boundingBox(region);
  const right = b.x + b.w;
  const bottom = b.y + b.h;

  const anchorX = handle === "tl" || handle === "bl" ? right : b.x;
  const anchorY = handle === "tl" || handle === "tr" ? bottom : b.y;

  const px = clamp01(nx);
  const py = clamp01(ny);

  const next: Box = {
    x: Math.min(anchorX, px),
    y: Math.min(anchorY, py),
    w: Math.max(MIN, Math.abs(px - anchorX)),
    h: Math.max(MIN, Math.abs(py - anchorY)),
  };

  switch (region.kind) {
    case "rect":
      return { kind: "rect", ...next };
    case "circle": {
      const r = Math.max(MIN / 2, Math.min(next.w, next.h) / 2);
      return { kind: "circle", cx: clamp01(next.x + next.w / 2), cy: clamp01(next.y + next.h / 2), r };
    }
    case "polygon": {
      if (b.w === 0 || b.h === 0) return region;
      const sx = next.w / b.w;
      const sy = next.h / b.h;
      return {
        kind: "polygon",
        points: region.points.map((p) => ({
          x: clamp01(next.x + (p.x - b.x) * sx),
          y: clamp01(next.y + (p.y - b.y) * sy),
        })),
      };
    }
  }
}

/** Build a region from a drag rectangle, for the rect and circle draw tools. */
export function regionFromDrag(kind: "rect" | "circle", a: { x: number; y: number }, b: { x: number; y: number }): Region {
  const box: Box = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.max(MIN, Math.abs(b.x - a.x)),
    h: Math.max(MIN, Math.abs(b.y - a.y)),
  };
  if (kind === "rect") return { kind: "rect", ...box };
  const r = Math.max(MIN / 2, Math.min(box.w, box.h) / 2);
  return { kind: "circle", cx: box.x + box.w / 2, cy: box.y + box.h / 2, r };
}

/** Human-readable coordinate readout for the canvas footer. */
export function describeRegion(region: Region): { label: string; values: [string, number][] } {
  switch (region.kind) {
    case "rect":
      return {
        label: "rect",
        values: [["x", region.x], ["y", region.y], ["w", region.w], ["h", region.h]],
      };
    case "circle":
      return { label: "circle", values: [["cx", region.cx], ["cy", region.cy], ["r", region.r]] };
    case "polygon":
      return { label: `polygon · ${region.points.length} points`, values: [] };
  }
}
