# Prism Design System

Alles wat je nodig hebt om je node-based e-learning app te vibecoden met een consistente look: glowy kleurenparen, Fluent-geometrie, HK Grotesk.

## Wat zit erin

| Bestand | Waarvoor |
|---|---|
| `DESIGN_SYSTEM.md` | De volledige spec. **Geef dit altijd mee als context aan je AI-tool.** |
| `PROMPT.md` | Kant-en-klare prompt om te plakken in Claude Code / Cursor / v0. |
| `tokens.css` | CSS custom properties. Framework-loos. |
| `tokens.json` | Machineleesbare tokens voor tooling / theming. |
| `tailwind.preset.js` | Tailwind preset (React/Tailwind). |
| `components.html` | Werkend visueel referentiebestand — open in je browser. |

## Zo start je (per stack)

**React + Tailwind (v0, Cursor, Claude Code)**
1. Zet `tailwind.preset.js` in je project, voeg toe aan `tailwind.config.js`:
   ```js
   module.exports = { presets: [require('./prism-design-system/tailwind.preset.js')], content: ['./src/**/*.{js,jsx,ts,tsx}'] }
   ```
2. Plak `PROMPT.md` + `DESIGN_SYSTEM.md` in je AI-tool. Vraag om een scherm.

**Plain HTML/CSS**
1. `<link rel="stylesheet" href="tokens.css">`, zet `class="prism-app"` op je `<body>` of root-div.
2. Gebruik de variabelen: `background: var(--grad-flow); box-shadow: var(--glow-flow);`
3. `components.html` is je live voorbeeld.

**WinUI 3 / XAML**
1. Neem de hexwaarden uit `tokens.json`.
2. Override in een `ResourceDictionary`: `AccentFillColorDefaultBrush` → Flow-from, kaart-glow via `Shadow`/`ThemeShadow`.
3. `DESIGN_SYSTEM.md` beschrijft welke control welke state-kleur krijgt.

**Weet je het nog niet?** Begin met `components.html` in de browser + `DESIGN_SYSTEM.md` als context. De tokens zijn stack-neutraal.

## De ene regel om te onthouden
Kleur draagt betekenis: **Flow = actief, Glow = voltooid, Bloom = speciaal.** Glow spaarzaam, één per element, rust = platte schaduw.

---
*Font: licentieer HK Grotesk voor productie; gratis alternatief is Hanken Grotesk. Preview draait op een systeemfont.*
