/**
 * Extends the SAME Prism preset as @ob/ui — the token layer is never forked.
 * The second content path is essential: without it Tailwind tree-shakes the classes used
 * inside packages/ui and every component renders unstyled.
 */
module.exports = {
  presets: [require("../../design/prism/tailwind.preset.js")],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};
