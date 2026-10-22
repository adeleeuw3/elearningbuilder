# Prism — vibecode prompt

Plak dit blok bovenaan je gesprek met een AI-coding tool (Claude Code, Cursor, v0, …), samen met `DESIGN_SYSTEM.md` en `tokens.css` (of `tokens.json` / `tailwind.preset.js`) als context.

---

Je bouwt **Prism**, een node-based e-learning app. Gebruik het bijgevoegde design system als de enige bron van waarheid voor styling. Regels:

1. **Kleur draagt betekenis, nooit decoratie.** Drie paren:
   - Flow (blauw) = actief / focus / verbinding / primaire actie
   - Glow (geel→perzik) = voltooid / unlocked / beloning
   - Bloom (roze→magenta) = speciaal / AI / nieuw
   Vergrendeld = neutraal + opacity .55. Rust = platte elevation-schaduw.

2. **Gebruik uitsluitend de tokens** uit `tokens.css` / de Tailwind-preset. Verzin geen nieuwe hexwaarden, radii of schaduwen. Zet class `prism-app` op de root-wrapper voor het canvas + ambient glow.

3. **Geometrie (Fluent/WinUI):** controls 4px, kaarten 8px, panelen 12px radius.

4. **Glow spaarzaam:** een glow-schaduw (`--glow-flow/glow/bloom`) vervangt de rand alleen op een betekenisvolle state. Max. één glowkleur per element.

5. **Componenten** volgen Fluent-patronen: NavigationView met glowende selectie-strip, AccentButton in Flow, RewardButton in Glow, ToggleSwitch/Slider/ProgressRing/Expander/InfoBar/PipsPager/Chip zoals beschreven in het design system.

6. **Typografie:** HK Grotesk (fallback Segoe UI Variable → system-ui). Display strak negatief gespatieerd, labels wijd in kapitaal.

7. **Motion — expressive springs** (zie `motion.md`): gebruik de springs `snappy` (controls), `flow` (node-selectie/hover) en `bloom` (unlocks/beloningen) i.p.v. vaste duur+bezier. Koppel de spring aan de betekenis. In React: Framer Motion met de gegeven stiffness/damping/mass; framework-loos: de `--spring-*` easings uit `tokens.css`.

8. **Kwaliteitsvloer:** responsive tot mobiel, zichtbare keyboard-focus, `prefers-reduced-motion` respecteren (overshoot uit).

Bevestig kort dat je het systeem hebt begrepen, en bouw dan het gevraagde scherm. Wijk je bewust af van een token, zeg dan waarom.

---

**Voorbeeld-vervolgprompts:**
- "Bouw het 'Mijn leerpad'-scherm: een NavigationView-shell met een grid van course-cards in verschillende node-states."
- "Maak een node-canvas waar lessen als knopen met verbindingslijnen staan; actieve node in Flow, voltooide in Glow."
- "Bouw een moduledetailpagina met een ProgressBar, Expander met lesinhoud, en een RewardButton om te voltooien."
