# Prism — Design System

Dit is de single source of truth voor het uiterlijk van de app. **Geef dit bestand mee als context aan je AI-coding tool** (Claude Code, Cursor, v0, etc.) bij elke UI-taak. Volg deze regels letterlijk; verzin geen eigen kleuren, radii of schaduwen.

Prism is een **node-based e-learning app**: leren stroomt van knoop naar knoop over een canvas. Light mode, Fluent-geometrie (Microsoft WinUI), zachte glow-kleuren die betekenis dragen.

---

## 1. Het centrale idee: kleur = betekenis

Er zijn drie kleurenparen. Elk paar heeft één betekenis. **Kleur is nooit decoratie.** Binnen een paar lopen de twee tinten altijd in een verloop (135°) — nooit als harde vlakken naast elkaar.

| Paar | Betekenis | from → to | ink (tekst/icoon) | wash (achtergrond) |
|------|-----------|-----------|-------------------|--------------------|
| **Flow** (blauw) | Actief · focus · verbinding · primaire actie | `#5AB8FF → #7DE3FF` | `#0B6FBF` | `#EAF6FF` |
| **Glow** (geel→perzik) | Voltooid · unlocked · beloning · highlight | `#FFD854 → #FFB07A` | `#B57A12` | `#FFF6E0` |
| **Bloom** (roze→magenta) | Speciaal spoor · optionele content · AI · nieuw | `#FF8AD8 → #C77DFF` | `#A5299B` | `#FCEBFA` |

Tekst op een gevulde gradient: Flow `#04314F`, Glow `#4A3200`, Bloom `#3D0A38`.

### Node-states (kernpatroon van de app)
- **Actief / bezig** → Flow-glow rand, Flow-ink label.
- **Voltooid / vrijgespeeld** → Glow-glow rand, Glow-ink label.
- **Speciaal / AI / nieuw** → Bloom-glow rand, Bloom-ink label.
- **Vergrendeld** → geen glow, `opacity: .55`, neutrale rand, ink-faint label.
- **Rust (neutraal)** → platte elevation-schaduw, geen glow.

---

## 1b. Waarom deze drie paren werken — en hoe je ze doseert

De paren liggen vast (§1). Wat hier bij komt is *hoeveel* je ze inzet. Drie eigenschappen bepalen
samen hoe prikkelend een scherm is; ze werken als schuiven die je tegen elkaar kunt uitruilen:

| Schuif | In Prism | Gevolg |
|--------|----------|--------|
| **Intensiteit** | washes zijn laag, gradients midden, canvas vrijwel grijs | laag gehouden — rust is de grondtoon |
| **Kleurafstand** | Flow (blauw) tegenover Glow (geel→perzik) staat bijna tegenover elkaar op de cirkel | hoog — daarom werkt één accent zo sterk |
| **Licht-donkercontrast** | licht canvas, ink `#1B1E28` voor tekst, zachte randen ertussen | gematigd — leesbaar zonder te snijden |

Omdat de kleurafstand al hoog is, is **dosering** de enige knop die overblijft. Daar volgt de regel
uit die het canvas rustig houdt:

- **Max één glow per element** (§4) — en daarnaast: **hooguit één Glow- of Bloom-accent in beeld**
  dat met Flow concurreert. Flow mag overal; de andere twee zijn interpunctie.
- **Kleine vlakken voor het accent.** Een paar vierkante centimeter Glow op een Flow-scherm geeft
  voldoening juist omdát de verhouding scheef is. Een half scherm Glow is geen accent meer maar een
  tweede hoofdkleur, en dan vechten ze.

### Verwantschap: wat de drie paren bindt
Ze delen hun lichtheidsbereik, hun intensiteit en hun verloophoek (135°). Dat is de lijm waardoor
een scherm met alle drie erop nog steeds één ding is. Breek je één van die drie — een vol verzadigd
accent, of een verloop onder een andere hoek — dan valt het uit elkaar, ook al komt de kleur uit de
lijst.

### Sfeer: waar de randen mogen vervagen
Laag licht-donkercontrast plus vage randen geeft atmosfeer in plaats van ruis. In Prism is dat de
`--ambient`-laag op de app-root en de wash-achtergronden. Daar mogen kleuren in elkaar overlopen.
Op **tekst en controls** niet: daar is het contrast functioneel, en leesbaarheid gaat vóór sfeer.

---

## 2. Neutralen & tekst

Het canvas is licht koel (`#F5F6F9`), niet puur wit — zo kan de warme glow ademen. Op de app-root staan zachte ambient-gradiënten in de hoeken (zie `--ambient`).

- canvas `#F5F6F9` · card `#FFFFFF` · card-sub `#F1F3F7` · layer `rgba(255,255,255,.68)` (mica/blur-lagen)
- stroke `#E2E5EC` · stroke-soft `#EBEDF2`
- tekst: ink `#1B1E28` · soft `#5C6272` · faint `#9AA0AE`

---

## 3. Geometrie (Fluent / WinUI)

- **Controls** (knop, input, chip, toggle): radius **4px** (`--r-control`).
- **Kaarten / overlays / nodes**: radius **8px** (`--r-card`).
- **Grote panelen**: **12px** (`--r-large`). Pills: `999px`.
- Rechthoekige vlakken met afgeronde hoeken — geen cirkels behalve avatars, ring, en toggle-thumb.

---

## 4. Schaduw & glow

- **Rust** = `--elevation` (platte, neutrale schaduw).
- **Betekenisvolle state** = een glow-schaduw die de rand vervangt: `--glow-flow`, `--glow-glow`, of `--glow-bloom`.
- **Regel: max. één glowkleur per element.** Meerdere glows tegelijk maken het canvas onrustig.
- Glow gebruik je spaarzaam — alleen waar de state het rechtvaardigt.

---

## 5. Typografie

Font: **HK Grotesk** (gelicentieerd). Fallback-stack: `"Segoe UI Variable", "Segoe UI", system-ui`. Gratis alternatief dat dichtbij komt: **Hanken Grotesk** (Google Fonts).

| Rol | Grootte | Weight | Tracking |
|-----|---------|--------|----------|
| Display XL | 46px | 700 | -0.03em |
| Titel | 30px | 700 | -0.02em |
| Subtitel | 20px | 600 | -0.01em |
| Body L | 18px | 400 | 0 |
| Body | 15px | 400 | 0 |
| Label | 12px | 600 | +0.12em, UPPERCASE |
| Caption | 11px | 500 | +0.06em |

Display strak negatief gespatieerd; labels juist wijd en in kapitaal.

---

## 6. Componenten (Fluent-patronen)

Gebruik deze WinUI-controlvormen. Elk krijgt de glow alleen op zijn betekenisvolle state.

- **Button** — neutraal: card-achtergrond + stroke. **AccentButton**: `--grad-flow` + `--glow-flow`, tekst `#04314F`. **RewardButton**: `--grad-glow` + `--glow-glow`.
- **NavigationView** — verticale rail; geselecteerd item heeft links een verticale strip in `--grad-flow` mét glow, plus `--flow-wash` achtergrond.
- **Card / course tile** — 8px radius, elevation in rust; glow-rand per node-state. Thumbnail bovenaan als kleurgradient van het bijbehorende paar.
- **ToggleSwitch** — 44×22 pill; aan-stand `--grad-flow` + `--glow-flow`, witte thumb.
- **Slider** — 4px track, gevulde deel `--grad-bloom`, ronde witte thumb met `--glow-bloom`.
- **ProgressBar** — 4px hoog, verloop `flow-from → glow-from` (van bezig naar bijna klaar).
- **ProgressRing** — conic-gradient in Flow, draaiend, subtiele drop-shadow-glow.
- **InfoBar** — voor beloningen/unlocks: `--glow-wash` achtergrond + `--glow-glow`, icoon-tegel in `--grad-glow`.
- **Expander** — 8px card, chevron roteert 90° bij openen.
- **PipsPager** — 8px dots; actieve dot `--grad-glow` met glow.
- **Chip / status** — pill, wash-achtergrond + ink-tekst + gekleurde dot per paar.

---

## 7. Motion — expressive springs

Beweging gebruikt fysica-gebaseerde springs, niet duur+bezier: natuurlijker en onderbreekbaar. Drie springs, gekoppeld aan de paren:

- **Snappy** — knop, toggle, chip. Kort, geen overshoot. (`--spring-snappy`)
- **Flow** — node-selectie, kaart-hover, nav-strip. Lichte overshoot, glow springt aan. (`--spring-flow`)
- **Bloom** — unlock, beloning, InfoBar. Meer bounce, mag vieren. (`--spring-bloom`)

Koppel beweging aan betekenis: een node die actief wordt verschuift naar Flow-kleur én speelt de Flow-spring. `prefers-reduced-motion` schakelt overshoot uit. Volledige details en code (Framer Motion + CSS `linear()`) staan in `motion.md`.

## 8. Do / Don't

- **Do**: glow alleen voor betekenisvolle states. Rust = platte schaduw.
- **Do**: laat de twee tinten van een paar altijd verlopen (135°).
- **Do**: gebruik `ink`-varianten voor tekst/iconen óp wash-achtergronden.
- **Don't**: meerdere glowkleuren op één element.
- **Don't**: kleur zonder betekenis — een blauwe node moet écht actief zijn.
- **Don't**: puur wit canvas of border-radius 0.

---

## 9. Bestanden in dit pakket

- `tokens.json` — machineleesbare tokens incl. spring-parameters (voor tooling / theming).
- `tokens.css` — CSS custom properties incl. `--spring-*`. Importeer op de root, zet class `prism-app` op je wrapper.
- `tailwind.preset.js` — Tailwind preset incl. spring-easings (React/Tailwind stacks).
- `motion.md` — de spring-spec met Framer Motion + CSS code.
- `components.html` — werkend visueel referentiebestand; springs live voelbaar.
- `PROMPT.md` — kant-en-klare prompt om aan je AI-coding tool te plakken.
