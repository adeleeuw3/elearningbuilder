# Prism — Motion

Beweging in Prism gebruikt **expressive springs**: fysica-gebaseerde animatie (stijfheid, demping, massa) in plaats van een vaste duur met een bezier-curve. Waarom natuurlijker: een spring versnelt en vertraagt zoals echte objecten, en kan **onderbroken worden en soepel van richting veranderen** midden in de beweging. Een duur-gebaseerde tween schokt als de gebruiker halverwege opnieuw klikt; een spring vloeit mee.

## Drie springs — gekoppeld aan de kleurenparen

| Spring | Gebruik | Karakter |
|--------|---------|----------|
| **Snappy** | Knop, toggle, chip-selectie | Kort en kwiek, geen overshoot |
| **Flow** | Node-selectie, kaart-hover, nav-strip naar actief item | Lichte overshoot — de glow "springt aan" |
| **Bloom** | Unlock, beloning, InfoBar-verschijning, vrijkomende node | Meer bounce, mag vieren |

Koppelingsregel: als een node van vergrendeld → actief gaat, verschuift de kleur naar Flow **én** speelt de Flow-spring. Beweging en betekenis versterken elkaar. Unlocks (naar Glow) gebruiken de Bloom-spring voor de viering.

## Implementatie

### Framer Motion (React) — echte springs
```jsx
const springs = {
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  flow:   { type: "spring", stiffness: 320, damping: 26, mass: 1 },
  bloom:  { type: "spring", stiffness: 240, damping: 18, mass: 1.1 },
};

// Node die actief wordt
<motion.div
  animate={{ scale: isActive ? 1.03 : 1 }}
  transition={springs.flow}
/>

// Beloning die verschijnt
<motion.div
  initial={{ opacity: 0, y: 12, scale: 0.96 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={springs.bloom}
/>
```
Springs zijn van nature onderbreekbaar in Framer Motion — geen extra werk nodig.

### CSS-only — `linear()` benadert de spring
De `linear()` easing-functie bootst de spring-curve na (incl. overshoot). Werkt met gewone `transition`.
```css
.node        { transition: transform var(--spring-flow), box-shadow var(--spring-flow); }
.node.active { transform: scale(1.03); box-shadow: var(--glow-flow); }

.btn         { transition: transform var(--spring-snappy); }
.btn:active  { transform: translateY(1px); }

.infobar     { animation: bloom-in var(--spring-bloom); }
@keyframes bloom-in { from { opacity:0; transform: translateY(12px) scale(.96); } to { opacity:1; transform:none; } }
```
Tailwind: `transition-transform duration-flow ease-flow`.

Let op: CSS-transitions zijn minder vloeiend onderbreekbaar dan echte JS-springs (bij richtingswissel midden in de animatie). Voor de meeste UI is dat prima; wil je de rijkste interruptie, gebruik dan Framer Motion op die specifieke elementen.

## Kwaliteitsvloer
`prefers-reduced-motion: reduce` → overshoot en bounce vervallen, alle springs worden een korte lineaire overgang (120ms). In `tokens.css` gebeurt dit automatisch via een media-query; in Framer Motion: lees `useReducedMotion()` en val terug op `{ duration: 0.12 }`.

## Vloeiendheid: waar beweging hoort

Een spring op een kleurovergang is geen beweging. `transition-colors` met `ease-flow` legt een
overshoot-curve op een kleurwaarde — die overshoot is onzichtbaar, en de indruk die de gebruiker
verwacht (het element dat meegeeft) blijft uit. De spring hoort op `transform`.

| Handeling | Wat beweegt | Spring |
|-----------|-------------|--------|
| Knop of icoonknop indrukken | `translateY(1px)` | Snappy |
| Klikbare tegel of rij aanwijzen | `-translate-y-px` + glow aan | Flow |
| Tegel indrukken | terug naar `translateY(.5px)` | Snappy |
| Venster of beloning verschijnt | `opacity` + `translateY` + `scale` | Bloom |

De lift bij hover is de anticipatie, de indruk is de ontlading. Dat is wat een control levend laat
voelen zonder dat er iets beweegt wat de lezer afleidt.

Gebruik `IconButton` uit `@ob/ui` voor knoppen met alleen een teken erin; die draagt dit gedrag én
dwingt een toegankelijke naam af. Een met de hand gemaakte `<button>` mist allebei.

## Do / Don't
- **Do**: match de spring aan de betekenis — Snappy voor directe controls, Bloom alleen voor vieringen.
- **Do**: animeer `transform` en `opacity` (goedkoop), niet `width`/`top`.
- **Don't**: bounce op alles. Overshoot is een accent; te veel maakt het speelgoederig.
- **Don't**: springs langer dan ~450ms voor UI-feedback — dan voelt het traag.
