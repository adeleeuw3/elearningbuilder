/**
 * Region maths guards the product's oldest invariant: hotspot coordinates are ALWAYS normalized
 * 0..1 of the scene, never pixels (CLAUDE.md). A regression here silently corrupts every
 * artifact, so the pure geometry is tested directly.
 */
import { describe, it, expect } from "vitest";
import type { Region } from "@ob/schema";
import {
  boundingBox,
  clamp01,
  describeRegion,
  moveRegion,
  polygonClipPath,
  regionFromDrag,
  resizeRegion,
} from "../region";

const rect: Region = { kind: "rect", x: 0.2, y: 0.3, w: 0.4, h: 0.2 };
const circle: Region = { kind: "circle", cx: 0.5, cy: 0.5, r: 0.1 };
const poly: Region = {
  kind: "polygon",
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.6, y: 0.3 },
    { x: 0.4, y: 0.7 },
  ],
};

/** Float-tolerant containment: a 1e-9 slack absorbs IEEE-754 noise from polygon scaling. */
const EPS = 1e-9;
const inUnitSquare = (r: Region) => {
  const b = boundingBox(r);
  return b.x >= -EPS && b.y >= -EPS && b.x + b.w <= 1 + EPS && b.y + b.h <= 1 + EPS;
};

/** Compare a box without asserting exact float equality on computed values. */
const expectBox = (r: Region, x: number, y: number, w: number, h: number) => {
  const b = boundingBox(r);
  expect(b.x).toBeCloseTo(x);
  expect(b.y).toBeCloseTo(y);
  expect(b.w).toBeCloseTo(w);
  expect(b.h).toBeCloseTo(h);
};

describe("boundingBox", () => {
  it("passes a rect through", () => {
    expect(boundingBox(rect)).toEqual({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 });
  });

  it("squares a circle", () => {
    expect(boundingBox(circle)).toEqual({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
  });

  it("spans a polygon's extremes", () => {
    expectBox(poly, 0.2, 0.2, 0.4, 0.5);
  });
});

describe("moveRegion keeps regions on the scene", () => {
  it("translates without resizing", () => {
    const moved = boundingBox(moveRegion(rect, 0.1, 0.05));
    expect(moved.x).toBeCloseTo(0.3);
    expect(moved.y).toBeCloseTo(0.35);
    expect(moved.w).toBeCloseTo(0.4);
    expect(moved.h).toBeCloseTo(0.2);
  });

  it.each([
    ["rect", rect],
    ["circle", circle],
    ["polygon", poly],
  ] as const)("clamps %s at the far edge instead of escaping", (_name, region) => {
    const out = moveRegion(region, 99, 99);
    expect(inUnitSquare(out)).toBe(true);
    const b = boundingBox(out);
    expect(b.x + b.w).toBeCloseTo(1);
    expect(b.y + b.h).toBeCloseTo(1);
  });

  it.each([
    ["rect", rect],
    ["circle", circle],
    ["polygon", poly],
  ] as const)("clamps %s at the near edge", (_name, region) => {
    const out = moveRegion(region, -99, -99);
    expect(inUnitSquare(out)).toBe(true);
    expect(boundingBox(out).x).toBeCloseTo(0);
    expect(boundingBox(out).y).toBeCloseTo(0);
  });

  it("preserves the region kind", () => {
    expect(moveRegion(circle, 0.1, 0).kind).toBe("circle");
    expect(moveRegion(poly, 0.1, 0).kind).toBe("polygon");
  });

  /**
   * Exact, not approximate. A circle at an edge must sit *precisely* flush, which only holds
   * because moveRegion derives the centre from the clamped box (cx = boxX + r) instead of adding
   * the delta to cx — the latter leaves a ~1e-17 overhang. Asserting `toBe(0)` is what keeps
   * that implementation choice from silently regressing.
   */
  it("puts a clamped circle exactly flush against the edge", () => {
    const atOrigin = boundingBox(moveRegion(circle, -99, -99));
    expect(atOrigin.x).toBe(0);
    expect(atOrigin.y).toBe(0);

    const atFarEdge = moveRegion(circle, 99, 99);
    const b = boundingBox(atFarEdge);
    expect(b.x + b.w).toBe(1);
    expect(b.y + b.h).toBe(1);
  });

  it("keeps a clamped rect exactly flush too", () => {
    const b = boundingBox(moveRegion(rect, -99, -99));
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
  });
});

describe("resizeRegion", () => {
  it("anchors the opposite corner when dragging br", () => {
    const out = boundingBox(resizeRegion(rect, "br", 0.8, 0.9));
    expect(out.x).toBeCloseTo(0.2);
    expect(out.y).toBeCloseTo(0.3);
    expect(out.w).toBeCloseTo(0.6);
    expect(out.h).toBeCloseTo(0.6);
  });

  it("anchors the opposite corner when dragging tl", () => {
    const out = boundingBox(resizeRegion(rect, "tl", 0.1, 0.1));
    expect(out.x).toBeCloseTo(0.1);
    expect(out.y).toBeCloseTo(0.1);
    expect(out.w).toBeCloseTo(0.5);
    expect(out.h).toBeCloseTo(0.4);
  });

  it("keeps a circle circular rather than squashing it", () => {
    const out = resizeRegion(circle, "br", 0.95, 0.6);
    expect(out.kind).toBe("circle");
    const b = boundingBox(out);
    expect(b.w).toBeCloseTo(b.h);
  });

  it("never resizes to nothing", () => {
    const b = boundingBox(resizeRegion(rect, "br", 0.2, 0.3));
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });

  it("stays inside the scene for any handle and target", () => {
    for (const h of ["tl", "tr", "bl", "br"] as const) {
      for (const [x, y] of [[-5, -5], [5, 5], [-5, 5], [5, -5]]) {
        expect(inUnitSquare(resizeRegion(rect, h, x!, y!))).toBe(true);
        expect(inUnitSquare(resizeRegion(poly, h, x!, y!))).toBe(true);
      }
    }
  });
});

describe("regionFromDrag", () => {
  it("normalizes a drag regardless of direction", () => {
    const a = regionFromDrag("rect", { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.3 });
    expectBox(a, 0.2, 0.3, 0.4, 0.4);
  });

  it("builds a circle inscribed in the drag box", () => {
    const c = regionFromDrag("circle", { x: 0.2, y: 0.2 }, { x: 0.6, y: 0.4 });
    expect(c.kind).toBe("circle");
    if (c.kind === "circle") {
      expect(c.cx).toBeCloseTo(0.4);
      expect(c.cy).toBeCloseTo(0.3);
      expect(c.r).toBeCloseTo(0.1); // smaller axis wins
    }
  });

  it("gives a degenerate drag a minimum size", () => {
    const b = boundingBox(regionFromDrag("rect", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }));
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });
});

describe("polygonClipPath", () => {
  it("expresses points relative to the bounding box, so 0% and 100% both appear", () => {
    const clip = polygonClipPath(poly);
    expect(clip).toMatch(/^polygon\(/);
    expect(clip).toContain("0.00% 0.00%");
    expect(clip).toContain("100.00%");
  });

  it("is undefined for non-polygons", () => {
    expect(polygonClipPath(rect)).toBeUndefined();
    expect(polygonClipPath(circle)).toBeUndefined();
  });
});

describe("clamp01 / describeRegion", () => {
  it("clamps out-of-range values", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it("labels each kind with the right axes", () => {
    expect(describeRegion(rect).values.map(([k]) => k)).toEqual(["x", "y", "w", "h"]);
    expect(describeRegion(circle).values.map(([k]) => k)).toEqual(["cx", "cy", "r"]);
    expect(describeRegion(poly).label).toContain("3 points");
  });
});
