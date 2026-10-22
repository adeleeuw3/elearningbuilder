# Plan 3 — UI/UX Design Plan (for Claude design)

> **Goal:** a design plan structured so you can hand pieces of it directly to **Claude design**
> (or any AI design tool) and get coherent screens, plus a design system that keeps everything
> consistent. Each screen section ends with a **ready-to-paste design brief**.
>
> Two distinct experiences to design:
> 1. **The Studio** — the authoring app (instructional designers build artifacts).
> 2. **The Runtime** — what a learner sees inside the exported package on an LMS.

---

## 1. Design principles

1. **The artifact is the hero.** The illustration fills the canvas; chrome recedes. High
   contrast between the realistic scene and flat, calm UI.
2. **Direct manipulation.** Authoring hotspots = drawing on the image, not filling forms about
   the image. The canvas is the primary verb.
3. **Confidence through preview.** What the author sees in preview is pixel-identical to the
   exported runtime (same renderer, normalized coords).
4. **Calm, focused, legible.** Education tool — generous spacing, strong type hierarchy, no
   visual noise competing with the realistic art.
5. **Accessible by construction.** WCAG 2.2 AA is a *constraint*, not a phase. Visual artifacts
   carry text alternatives so they're learnable without sight.
6. **Forgiving.** Drafts autosave; destructive actions are soft + reversible; long AI jobs are
   transparent and cancellable.

**Product personality:** trustworthy, scientific, modern-museum. Think "interactive exhibit," not
"enterprise dashboard." Realistic art + clean editorial UI.

---

## 2. Personas

| Persona | Role | Needs | Designed-for moments |
|---|---|---|---|
| **Maya — Instructional Designer** | Author | Build artifacts fast, place hotspots precisely, map learning objectives | Hotspot canvas, scoring, preview |
| **Sam — SME Reviewer** | Reviewer | Check accuracy, comment, request changes, approve | Review mode, comments, diff |
| **Priya — Org Admin** | Admin/Owner | Members, roles, SSO, usage, audit | Tenant settings, members, audit |
| **Leo — Learner** | Viewer (runtime) | Explore, understand, get assessed, on any device | The exported runtime experience |

---

## 3. Information architecture / sitemap

```
Studio
├─ Auth (OIDC) → Tenant picker (if multi-org)
├─ Dashboard           # recent artifacts, status, "New artifact"
├─ Artifacts (list)    # filter by subject/state/owner; grid of thumbnails
│   └─ Artifact detail
│       ├─ Editor       # ← the core: scene canvas + hotspot tools + panels
│       ├─ Versions     # history, diff, publish
│       ├─ Review       # comments, approve/request-changes
│       ├─ Preview      # full runtime preview (explore + assess)
│       └─ Export       # profile (xAPI/cmi5), build, download, launch-test
├─ Assets / Media library
├─ Settings
│   ├─ Members & roles
│   ├─ SSO / SCIM
│   ├─ LRS test targets (dev)
│   ├─ Branding (per-tenant)
│   └─ Audit log
└─ Account / profile

Runtime (exported package)
├─ Title / objectives screen
├─ Explore mode        # the scene + interactive hotspots
├─ Guided mode         # step-through narrated tour of components
├─ Assessment          # interactions per component / page
└─ Results / completion # score, mastery, retry
```

---

## 4. Key user flows

**F1 — Create artifact (golden path):**
New → name + subject + language → **generate or upload scene** → (AI job progress) → **place
hotspots** (draw region → label → learn-content → xAPI mapping) → add rubric/scoring → **preview**
(explore + assess) → **publish** → **export** (pick xAPI/cmi5) → download / launch-test.

**F2 — Review:** Reviewer opens Review mode → comments anchored to hotspots → request changes /
approve → author resolves → publish.

**F3 — Version compare:** Versions tab → pick v1 vs v2 → visual + structural diff (added/removed/
moved hotspots, changed content) → restore creates a new draft.

**F4 — Admin onboarding:** Owner sets up SSO (WorkOS) → invites/SCIM-syncs members → assigns roles
→ configures branding + LRS test target.

**F5 — Learner (runtime):** launch from LMS → objectives → explore scene (tap hotspots, content
reveals) → guided tour optional → assessment → results; xAPI fires throughout.

---

## 5. Screen specs + design briefs

> Each brief is written to paste into Claude design. Reuse the **design tokens (§7)** and
> **component library (§8)** so outputs are consistent. Design **desktop-first for the Studio**,
> **responsive/mobile-first for the Runtime**.

### 5.1 Editor — the hotspot authoring canvas (the heart of the product)

**Layout:** three-pane.
- **Left rail — Components/Layers panel:** ordered list of hotspots (name, type icon, visibility,
  lock). Reorder = z-order. Multi-page artifacts get a page strip above.
- **Center — Scene canvas:** the realistic image fills the area; hotspots overlaid as
  semi-transparent shapes with handles. Zoom/pan; pixel-grid + snapping. A **toolbar** with:
  select, **rect**, **circle**, **polygon**, label-placement, and "✨ Suggest regions"
  (segmentation assist). Normalized-coordinate readout.
- **Right rail — Properties panel** (contextual to selection): label, rich learn-content editor
  (sanitized), media attach, **xAPI mapping** (activity type + verb-on-interact, with a live
  preview of the statement IRI), assessment binding (link to rubric/interaction), and alt-text /
  description field (a11y, required to publish).

**States:** empty (no scene yet → generate/upload CTA), generating (progress), placing, selected,
multi-select, locked, error.

> **Design brief — Editor canvas**
> "Design a desktop authoring screen for an educational artifact builder. Three panes: left
> 'Components' layer list (reorderable, each with type icon, eye/lock toggles, and a page strip on
> top); a large center canvas showing a realistic illustration (e.g. a volcano cross-section) with
> semi-transparent interactive hotspot regions (rectangle, circle, polygon) overlaid and selection
> handles; a floating canvas toolbar (select, rectangle, circle, polygon, label, '✨ Suggest
> regions', zoom). Right pane is a contextual Properties panel with: label field, rich-text
> 'Learn content' editor, media attach, an 'xAPI event' section showing activity-type dropdown +
> verb chips + a read-only generated IRI, an 'Assessment' binding, and a required 'Alt description'
> field. Calm, museum-modern aesthetic; realistic art is the focal point; flat, low-chroma UI
> chrome. Use the provided design tokens. Include the empty state (large 'Generate or upload a
> scene' dropzone) and a 'generating…' progress state."

### 5.2 AI scene generation modal

Prompt input + **subject presets** (cross-section, cutaway, exploded view, labeled-ready clean
background), style controls (realistic illustration), aspect ratio, regenerate/variations,
generation history, and a clear **provider/cost/quota** indicator. Long-running → progress with
cancel; result lands on the canvas.

> **Design brief — Generation modal**
> "Design a modal for AI-generating a realistic educational illustration: large prompt field with
> subject-preset chips (Cross-section, Cutaway, Exploded view, Clean background), style + aspect
> controls, a 'Generate' button, a grid of result variations to pick from, a thumbnail history
> strip, and a small quota/credits indicator. Include the in-progress state with a progress bar and
> Cancel. Match tokens; keep it focused and uncluttered."

### 5.3 Artifacts list / dashboard

Thumbnail grid; each card = scene thumbnail + title + subject + **state badge** (Draft/Published/
In review) + version + owner. Filters (subject, state, owner), search, "New artifact" primary CTA.

### 5.4 Preview (runtime in a frame)

Renders the *actual* runtime: explore mode + guided + assessment, with a device-size switcher
(desktop/tablet/mobile) and an **xAPI statement inspector** drawer (shows statements that *would*
fire) — invaluable for authors and for trust.

### 5.5 Versions & diff

Timeline list; select two versions → **visual diff** (hotspots added/removed/moved highlighted on
the scene) + **structural diff** (content/scoring changes). Publish button (with immutability
warning); restore.

### 5.6 Review mode

Read-mostly canvas; comment pins anchored to hotspots; comment thread sidebar; approve / request
changes; status banner.

### 5.7 Export

Choose profile (**xAPI** / **cmi5**), options (privacy: account vs hashed mbox; language), **Build**
→ progress → download ZIP + **"Launch test"** against a configured dev LRS, showing the statements
that landed. Show the manifest `activityId` for verification.

### 5.8 Settings — Members & roles, SSO/SCIM, Audit, Branding

Standard B2B settings: members table with role dropdowns (role matrix from security plan §4),
SSO/SCIM connect (WorkOS), audit log table (filter by actor/action/date), per-tenant branding
(logo/colors that flow into exported package theming).

### 5.9 Runtime — the learner experience (design responsively, mobile-first)

- **Objectives screen:** title, what you'll learn, "Start."
- **Explore:** the scene fills the viewport; hotspots are discoverable (subtle pulse/outline on
  hover/focus); tapping opens a **content sheet** (label + learn-content + media). Progress
  indicator of "components explored."
- **Guided:** stepper that pans/zooms to each component with narration.
- **Assessment:** interaction per component/page (multiple choice, hotspot-identify, ordering);
  immediate or end feedback per config.
- **Results:** score, mastery vs threshold, retry, completion confirmation.
- All states emit xAPI (`initialized/experienced/answered/completed/passed/failed`).

> **Design brief — Runtime explore (mobile + desktop)**
> "Design the learner-facing screen of an exported interactive lesson: a realistic illustration
> filling the viewport with discoverable interactive hotspots (subtle focus ring / pulse), a small
> top bar with title + progress ('4 of 9 explored'), and a bottom sheet (mobile) / side panel
> (desktop) that slides in when a hotspot is tapped, showing the component label, learn content,
> and optional media. Include a floating 'Guided tour' button and an 'Assessment' entry. Mobile-
> first, large touch targets, high contrast, fully keyboard-navigable. Calm museum-exhibit feel."

---

## 6. Accessibility (WCAG 2.2 AA — a constraint, not a phase)

The hard problem: **a realistic image is invisible to a screen reader.** Controls:
- **Required alt/long-description per component** (authoring blocks publish without it) → the
  runtime exposes an **accessible list view** of components + descriptions as an equivalent path.
- Hotspots are **real focusable controls** (buttons/regions), keyboard-reachable in a logical
  order, with visible focus, ARIA names from labels.
- Color is never the only signal (state badges have text/icon); contrast ≥ 4.5:1 for text,
  ≥ 3:1 for UI/graphical objects; respect `prefers-reduced-motion` (hotspot pulses, guided pans).
- Content sheets are dialog-pattern (focus trap, ESC, restore focus).
- Assessments are operable by keyboard and screen reader (hotspot-identify offers a list fallback).
- Target sizes ≥ 24×24 CSS px (AA 2.2); larger on the runtime touch UI.
- Captions/transcripts for any audio/video learn-content.

---

## 7. Design system — tokens

> **SUPERSEDED — the design system is now Prism.** The token set below was the original proposal.
> The project has since adopted **Prism** (`design/prism/`), which is the single source of truth:
> light mode, Fluent/WinUI geometry, three semantic color pairs, expressive springs.
> Read `design/prism/DESIGN_SYSTEM.md` + `design/prism/motion.md` before any UI work, and see
> the CLAUDE.md "UI — Prism design system" section for the app-specific semantic mapping:
>
> | Pair | Meaning in Observation Builder |
> |---|---|
> | **Flow** (blue) | active / busy node, selection, connections, primary action |
> | **Glow** (yellow→peach) | completed, validated, published, explored hotspot |
> | **Bloom** (pink→magenta) | AI generation nodes, optional & unexplored content |
>
> Locked = `opacity:.55`, no glow. Rest = flat `--elevation`. **Max one glow per element.**
> Live implementation of all screens: `design/ui-mockups.html`.
> The screen specs, flows, personas and a11y requirements in this document all still apply —
> only the visual token layer changed.

<details>
<summary>Original (pre-Prism) token proposal — kept for history</summary>

Implement as CSS variables / Tailwind theme; flow tenant branding into the runtime.

**Color (semantic):**
- `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`
- `--primary` (action) + `--primary-contrast`; `--accent`
- State: `--draft`, `--published`, `--review`, `--danger`, `--success`, `--warning`
- Hotspot overlay: `--hotspot-fill` (low-alpha), `--hotspot-stroke`, `--hotspot-selected`,
  `--hotspot-focus`
- Light + **dark mode** pairs (museum-dark works beautifully behind realistic art).

**Type:** humanist sans for UI (e.g. Inter); a slightly editorial serif option for learn-content
headings. Scale: 12 / 14 / 16 / 20 / 24 / 32 / 40. Line-height 1.5 body, 1.2 headings.

**Spacing:** 4-pt base → 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.

**Radius:** 6 (controls) / 12 (cards) / 16 (sheets). **Elevation:** 3 soft shadow steps.

**Motion:** 150ms (controls), 250ms (sheets/panels), ease-out; all gated by reduced-motion.

</details>

---

## 8. Component library (build in `packages/ui`)

> Build these as **Prism/Fluent (WinUI) control shapes** per `design/prism/DESIGN_SYSTEM.md` §6:
> Button / AccentButton / RewardButton, NavigationView rail (selected item gets a Flow gradient
> strip with glow + wash background), Card, ToggleSwitch 44×22, Slider (Bloom fill), ProgressBar
> (4px, flow-from→glow-from), ProgressRing (conic Flow), InfoBar (Glow wash, gradient icon tile),
> Expander, PipsPager, Chip. `design/prism/components.html` is the working visual reference.


Buttons (primary/secondary/ghost/danger), inputs, select, **role badge**, **state badge**,
**thumbnail card**, **toolbar + tool button**, **layer list item** (icon + visibility + lock),
**properties section/accordion**, **rich-text editor (sanitized)**, **dropzone**, **progress /
job status**, **modal**, **bottom sheet / side panel**, **comment pin + thread**, **diff
highlight**, **stepper (guided)**, **statement inspector row**, **toast**, **empty state**,
**data table** (members/audit). Define states for each: default / hover / focus-visible / active /
disabled / loading / error.

---

## 9. Content & states discipline (don't skip)

For every screen, design the **empty, loading, partial, error, and success** states — especially:
- AI generation: queued → generating (cancellable) → ready → failed (retry).
- Export: building → ready (download + launch-test) → failed.
- Offline-in-runtime: a quiet indicator that statements are queued and will sync.
- Microcopy: plain, encouraging, specific ("Place a region on the magma chamber, then add a
  label"); error copy says what happened + the next action.

---

## 10. Internationalization

UI strings externalized; learn-content authored per `language`; runtime sets `language` from
`navigator.language` (matches the xAPI context). Design for **text expansion (+30–40%)** and
**RTL**. Don't bake text into the realistic illustration — keep labels in the overlay so they're
translatable and accessible.

---

## 11. How to use this with Claude design (workflow)

1. **Seed the system first.** Paste §7 (tokens) + §1 (principles) + §8 (component list) and ask
   Claude design to produce the **design-token sheet + core components** (light + dark). Lock it.
2. **Then generate screens** using the per-screen briefs (§5), each time referencing "use the
   established tokens and components." Do the **Editor canvas (5.1)** and **Runtime explore (5.9)**
   first — they define the product.
3. **Design states, not just happy paths** (§9) — ask for the empty/loading/error variants
   explicitly.
4. **Accessibility annotations.** Ask Claude design to annotate focus order, ARIA names, and
   contrast for the Editor and Runtime.
5. **Handoff to Claude Code:** export the token sheet to `packages/ui` CSS variables / Tailwind
   theme; build the component library to match; the Studio and the exported runtime share the
   token set (with tenant branding overrides on the runtime).

---

## 12. Priority order for design

1. Design system (tokens + core components).
2. **Editor / hotspot canvas (5.1)** — the make-or-break screen.
3. **Runtime explore + content sheet (5.9)** + accessible list view.
4. AI generation modal (5.2), Preview (5.4), Export (5.7).
5. Versions/diff (5.5), Review (5.6).
6. Dashboard/list (5.3), Settings/members/audit (5.8), Runtime assessment + results.
