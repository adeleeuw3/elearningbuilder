# @ob/ui — Prism component library

React implementation of the **Prism** design system (`design/prism/`). Prism is the single source
of truth; this package is the only sanctioned way to render it in the app.

## Setup

```bash
pnpm add @ob/ui
```

1. Import the tokens once at your app entry and wrap the tree:

```tsx
import "@ob/ui/tokens.css";
import { PrismApp } from "@ob/ui";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <PrismApp>{children}</PrismApp>;
}
```

2. Extend the **same** Tailwind preset — never fork the token layer:

```js
// apps/studio/tailwind.config.js
module.exports = {
  presets: [require("../../design/prism/tailwind.preset.js")],
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};
```

> The second `content` path matters. Without it Tailwind tree-shakes the classes used *inside*
> this package and every component renders unstyled.

## The core idea: `tone`, not colour

Prism's rule is **kleur = betekenis** — colour is never decoration. So components don't take
colour props. They take a **tone**, which is a statement about meaning:

| Tone | Means (in this app) |
|---|---|
| `flow` | active · busy · selected · connection · primary action |
| `glow` | completed · validated · published · explored |
| `bloom` | AI generation · optional · new |
| `rest` | neutral — flat `--elevation`, no glow |
| `locked` | unavailable — `opacity: .55`, no glow |

```tsx
<Chip tone="glow">Published</Chip>        // ✅ says something true
<Chip tone="bloom">AI generated</Chip>    // ✅
<Chip color="blue">Published</Chip>       // ❌ no such prop — by design
```

## Two invariants are enforced, not documented

1. **Max one glow per element** (Prism §4). `toneShadow()` returns a *single* class string, so
   composing two glows isn't reachable through the public API. Covered by
   `src/__tests__/tone.test.ts`.
2. **Rest is flat, locked has no glow** (Prism §1). Also asserted in the same suite.

Run them: `pnpm --filter @ob/ui test` (19 tests).

### The interesting edge case
A workflow node can be *both* an AI node and *currently running*. Prism allows one glow, so
`NodeCard` resolves it deliberately: **state owns the glow**, and the category is demoted to a
tinted icon tile plus a wash chip.

```tsx
<NodeCard title="Generate questions" state="flow" categoryTone="bloom" icon="✶">
  <ProgressBar value={0.72} />
  <div className="flex gap-1.5">
    <Chip tone="flow">running · 3 of 4</Chip>
    <Chip tone="bloom">AI</Chip>
  </div>
</NodeCard>
```

## Components

| Component | Prism role |
|---|---|
| `PrismApp` | Root wrapper: canvas, ambient gradients, keyframes |
| `Button` | `role_="neutral" \| "accent"` (Flow) `\| "reward"` (Glow) `\| "subtle"` |
| `Chip` | Status pill — wash + ink + dot |
| `Card`, `CardThumb` | 8px tile / 12px `panel`; glow per state |
| `NodeCard`, `NodePort` | Workflow canvas node + typed connection ports |
| `NavigationView` | Vertical rail; selected item gets the Flow strip + glow + wash |
| `ToggleSwitch` | 44×22, Flow when on |
| `Slider` | Bloom fill, white thumb with Bloom glow |
| `ProgressBar` | 4px, `flow-from → glow-from` |
| `ProgressRing` | Conic Flow |
| `InfoBar` | Rewards/unlocks: Glow wash + Glow glow + gradient tile |
| `Expander` | Chevron rotates 90° |
| `PipsPager` | Active dot in Glow |

`Button` has no Bloom role and no `tone` prop on purpose: Bloom means "AI / new **content**",
which is a property of content, not of a control.

## Motion

Springs come from `design/prism/motion.md` and are picked by *meaning*:
`springClasses("snappy")` for direct controls, `"flow"` for selection/hover, `"bloom"` for
celebration. `springForState()` encodes the coupling rule — an unlock (→ Glow) celebrates with
the Bloom spring. All overshoot drops automatically under `prefers-reduced-motion` (handled in
`tokens.css`), and entrance animations are additionally gated with `motion-safe:`.

## Fonts

HK Grotesk is licensed and **must not** be fetched from a CDN. The preset's stack falls back to
`"Segoe UI Variable"`, which resolves natively on Windows and suits the Fluent geometry. To use
the real face, self-host the woff2 and add a local `@font-face`.
