/**
 * Custom ESLint rules that machine-enforce the CLAUDE.md security invariants.
 * Wire into eslint.config.js as a local plugin:
 *
 *   import ob from "./eslint-rules/no-raw-db.js";
 *   export default [{ plugins: { ob }, rules: {
 *     "ob/no-raw-db": "error",
 *     "ob/no-unsanitized-html": "error",
 *     "ob/no-secret-in-runtime": "error",
 *   }}];
 */

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  rules: {
    // 1) Ban raw db access outside packages/db and withTenant callbacks.
    "no-raw-db": {
      meta: {
        type: "problem",
        docs: { description: "Tenant data must go through withTenant(); no raw db client." },
        messages: {
          rawDb: "Raw `db` access is forbidden here. Use withTenant(tenantId, tx => ...) from @ob/db.",
        },
      },
      create(context) {
        const filename = context.filename || context.getFilename();
        // Allowed to touch the raw client only inside the db package itself.
        if (filename.includes(`packages${slash()}db${slash()}`)) return {};
        return {
          MemberExpression(node) {
            if (
              node.object &&
              node.object.type === "Identifier" &&
              node.object.name === "db" &&
              node.property &&
              ["select", "insert", "update", "delete", "transaction", "execute"].includes(node.property.name)
            ) {
              context.report({ node, messageId: "rawDb" });
            }
          },
        };
      },
    },

    // 2) Ban innerHTML / dangerouslySetInnerHTML unless the value is a `Sanitized` wrapper.
    "no-unsanitized-html": {
      meta: {
        type: "problem",
        docs: { description: "Author HTML must be sanitized before rendering." },
        messages: {
          innerHtml: "Assigning to innerHTML/dangerouslySetInnerHTML requires a Sanitized value.",
        },
      },
      create(context) {
        const looksSanitized = (node) =>
          node &&
          ((node.type === "CallExpression" &&
            node.callee &&
            /sanitize/i.test(sourceName(node.callee))) ||
            (node.type === "Identifier" && /sanitized/i.test(node.name)));
        return {
          AssignmentExpression(node) {
            if (
              node.left.type === "MemberExpression" &&
              node.left.property &&
              node.left.property.name === "innerHTML" &&
              !looksSanitized(node.right)
            ) {
              context.report({ node, messageId: "innerHtml" });
            }
          },
          JSXAttribute(node) {
            if (node.name && node.name.name === "dangerouslySetInnerHTML") {
              context.report({ node, messageId: "innerHtml" });
            }
          },
        };
      },
    },

    // 3) Ban secret-shaped env reads inside the exported runtime / export templates.
    "no-secret-in-runtime": {
      meta: {
        type: "problem",
        docs: { description: "No secrets may reach exported packages." },
        messages: {
          secret: "Secrets/credentials must never be referenced in xapi-runtime or export templates.",
        },
      },
      create(context) {
        const filename = context.filename || context.getFilename();
        const inRuntime =
          filename.includes(`packages${slash()}xapi-runtime${slash()}`) ||
          filename.includes(`packages${slash()}exporter${slash()}templates`);
        if (!inRuntime) return {};
        return {
          MemberExpression(node) {
            // process.env.<...SECRET|TOKEN|KEY|AUTH...>
            const src = sourceName(node);
            if (/process\.env\.[A-Za-z0-9_]*(SECRET|TOKEN|KEY|AUTH|PASSWORD)/i.test(src)) {
              context.report({ node, messageId: "secret" });
            }
          },
        };
      },
    },
  },
};

function slash() {
  return "/"; // paths are normalized to forward slashes by eslint
}
function sourceName(node) {
  try {
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression")
      return `${sourceName(node.object)}.${node.property.name || ""}`;
  } catch {
    /* noop */
  }
  return "";
}

export default plugin;
