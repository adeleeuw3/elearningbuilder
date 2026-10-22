/**
 * Extends the shared Prism preset — the token layer is never forked (CLAUDE.md).
 * The packages/ui content path is required, or Tailwind tree-shakes the classes used inside
 * @ob/ui and its components render unstyled.
 */
module.exports = {
  presets: [require("../../design/prism/tailwind.preset.js")],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};
