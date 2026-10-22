/**
 * Prism Design System — Tailwind preset
 * Gebruik in tailwind.config.js:
 *   module.exports = { presets: [require('./prism-design-system/tailwind.preset.js')], content: [...] }
 *
 * Dan beschikbaar als o.a.:
 *   bg-flow-from / text-flow-ink / bg-flow-wash / shadow-glow-flow
 *   rounded-control / rounded-card
 *   bg-gradient-flow (via .bg-grad-flow utility hieronder, of gebruik arbitrary values)
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        flow:  { from: '#5AB8FF', to: '#7DE3FF', ink: '#0B6FBF', wash: '#EAF6FF', on: '#04314F' },
        glow:  { from: '#FFD854', to: '#FFB07A', ink: '#B57A12', wash: '#FFF6E0', on: '#4A3200' },
        bloom: { from: '#FF8AD8', to: '#C77DFF', ink: '#A5299B', wash: '#FCEBFA', on: '#3D0A38' },
        canvas: '#F5F6F9',
        card: '#FFFFFF',
        'card-sub': '#F1F3F7',
        stroke: '#E2E5EC',
        'stroke-soft': '#EBEDF2',
        ink: { DEFAULT: '#1B1E28', soft: '#5C6272', faint: '#9AA0AE' },
      },
      borderRadius: {
        control: '4px',
        card: '8px',
        large: '12px',
      },
      boxShadow: {
        elevation:  '0 1px 2px rgba(27,30,40,.05), 0 6px 18px -10px rgba(27,30,40,.18)',
        'glow-flow':  '0 0 0 1px rgba(90,184,255,.35), 0 6px 22px -6px rgba(90,184,255,.60)',
        'glow-glow':  '0 0 0 1px rgba(255,176,122,.40), 0 6px 22px -6px rgba(255,184,90,.60)',
        'glow-bloom': '0 0 0 1px rgba(199,125,255,.38), 0 6px 22px -6px rgba(255,138,216,.55)',
      },
      backgroundImage: {
        'grad-flow':  'linear-gradient(135deg, #5AB8FF, #7DE3FF)',
        'grad-glow':  'linear-gradient(135deg, #FFD854, #FFB07A)',
        'grad-bloom': 'linear-gradient(135deg, #FF8AD8, #C77DFF)',
        'ambient': 'radial-gradient(700px 460px at 0% -8%, rgba(125,227,255,.20), transparent 60%), radial-gradient(760px 520px at 105% 4%, rgba(255,216,84,.14), transparent 55%), radial-gradient(680px 620px at 85% 108%, rgba(199,125,255,.13), transparent 60%)',
      },
      fontFamily: {
        sans: ['"HK Grotesk"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { display: '-0.03em', tight: '-0.02em', label: '0.12em' },

      // Expressive springs — gebruik als: transition-[all] duration-[280ms] ease-flow
      // of via de transitionTimingFunction-utilities: ease-snappy / ease-flow / ease-bloom
      transitionTimingFunction: {
        snappy: 'linear(0, 0.24 4%, 0.66 10%, 0.9 16%, 1.0 24%, 1 100%)',
        flow:   'linear(0, 0.18 4%, 0.55 9%, 0.9 15%, 1.06 22%, 1.02 30%, 1 44%, 1 100%)',
        bloom:  'linear(0, 0.14 4%, 0.5 9%, 0.94 15%, 1.12 21%, 1.14 25%, 1.02 34%, 0.98 42%, 1 54%, 1 100%)',
      },
      transitionDuration: {
        snappy: '180ms',
        flow:   '280ms',
        bloom:  '420ms',
      },
    },
  },
};
