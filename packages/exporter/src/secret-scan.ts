/**
 * Export secret-scanner — the single most important automated gate (security plan §B2).
 *
 * The exported package is PUBLIC and STATIC. It must contain NO endpoints, credentials,
 * keys, or tokens — all LRS access is discovered at runtime. This scanner runs:
 *   - in the exporter before a ZIP is written,
 *   - in a pre-commit / pre-export hook over packages/xapi-runtime/dist,
 *   - in CI as a required check.
 *
 * Usage (CLI): `node dist/secret-scan.js <dir-or-file> [...more]`  -> exit 1 on any finding.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export interface Finding {
  file: string;
  line: number;
  rule: string;
  excerpt: string;
}

interface Rule {
  name: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { name: "authorization-header", re: /Authorization\s*[:=]\s*["'`]?\s*(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/i },
  { name: "basic-auth-inline", re: /\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{16,}\b/ },
  { name: "lrs-endpoint-literal", re: /https?:\/\/[^\s"'`]*\/(xapi|xAPI|data\/xAPI|statements)\b/ },
  { name: "url-with-basic-auth", re: /https?:\/\/[^\s/@"'`]+:[^\s/@"'`]+@/ },
  { name: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "generic-secret-assign", re: /\b(secret|api[_-]?key|auth[_-]?token|access[_-]?token|password|passwd)\b\s*[:=]\s*["'`][^"'`]{8,}["'`]/i },
  // High-entropy base64/hex blobs assigned to a var (heuristic).
  { name: "high-entropy-literal", re: /["'`][A-Za-z0-9+/]{40,}={0,2}["'`]/ },
];

// Files that legitimately contain launch KEYS to discover at RUNTIME (not our secrets)
// are excluded by content: discovery reads params/globals, it never hardcodes values.
const SCANNABLE_EXT = new Set([".js", ".mjs", ".cjs", ".html", ".json", ".css", ".xml", ".txt", ".map"]);

/**
 * Spec-mandated namespace IRIs that WE emit into the manifests.
 *
 * These are constant, public identifiers — not endpoints and not secrets. They are listed here
 * because `lrs-endpoint-literal` matches any `/xapi` path segment, and the cmi5 course-structure
 * namespace legitimately contains one. Without this list every cmi5 package is blocked by its own
 * required namespace, which is exactly the false positive that erodes trust in the gate.
 *
 * This is a list of EXACT strings, deliberately not a pattern. A pattern would excuse anything
 * that merely resembles these; an exact string can only ever excuse itself. Nothing that varies
 * per tenant, per environment, or per build belongs here — if it varies it is not a constant, and
 * a URL we cannot name in advance is precisely what this scanner exists to catch.
 */
const SPEC_NAMESPACE_IRIS = [
  "https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd",
] as const;

/** The line with the known-safe constants removed, so a rule can only match what remains. */
function withoutSpecIris(line: string): string {
  let out = line;
  for (const iri of SPEC_NAMESPACE_IRIS) out = out.split(iri).join("");
  return out;
}

export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    // Matched against the redacted line: a line may carry both a legitimate namespace and a real
    // secret, and only the namespace is excused.
    const scanbaar = withoutSpecIris(line);
    for (const rule of RULES) {
      if (rule.re.test(scanbaar)) {
        findings.push({ file, line: i + 1, rule: rule.name, excerpt: line.trim().slice(0, 160) });
      }
    }
  });
  return findings;
}

export function scanPath(target: string): Finding[] {
  const st = statSync(target);
  if (st.isDirectory()) {
    return readdirSync(target).flatMap((entry) => {
      if (entry === "node_modules" || entry.startsWith(".")) return [];
      return scanPath(join(target, entry));
    });
  }
  if (!SCANNABLE_EXT.has(extname(target))) return [];
  return scanText(target, readFileSync(target, "utf8"));
}

/** Programmatic gate — call from the exporter over the assembled package before zipping. */
export function assertNoSecrets(targets: string[]): void {
  const findings = targets.flatMap(scanPath);
  if (findings.length > 0) {
    const msg = findings
      .map((f) => `  ${f.file}:${f.line} [${f.rule}] ${f.excerpt}`)
      .join("\n");
    throw new Error(`Export blocked — potential secret(s) in package output:\n${msg}`);
  }
}

// CLI entry
if (require.main === module) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("usage: secret-scan <dir-or-file> [...]");
    process.exit(2);
  }
  const findings = targets.flatMap(scanPath);
  if (findings.length) {
    console.error("SECRET SCAN FAILED:");
    for (const f of findings) console.error(`  ${f.file}:${f.line} [${f.rule}] ${f.excerpt}`);
    process.exit(1);
  }
  console.log("secret-scan: clean");
}
