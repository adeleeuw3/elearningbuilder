/**
 * Tailwind config for @ob/ui. Consumers (apps/studio) should extend the SAME preset so the
 * token layer is shared and never forked.
 *
 *   // apps/studio/tailwind.config.js
 *   module.exports = {
 *     presets: [require("../../design/prism/tailwind.preset.js")],
 *     content: ["./app/**\/*.{ts,tsx}", "../../packages/ui/src/**\/*.{ts,tsx}"],
 *   };
 *
 * Note the second content path — without it Tailwind tree-shakes away the classes used
 * inside this package and the components render unstyled.
 */
module.exports = {
  presets: [require("../../design/prism/tailwind.preset.js")],
  content: ["./src/**/*.{ts,tsx}"],
};
