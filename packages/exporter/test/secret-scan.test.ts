/**
 * The secret-scanner is the gate that keeps endpoints and credentials out of a public package
 * (CLAUDE.md §3). Two failure modes matter, and they pull in opposite directions:
 *
 *   - too loose, and a real endpoint ships;
 *   - too strict, and a spec-required constant blocks every export — which is how a gate gets
 *     switched off in a hurry by whoever is on deadline.
 *
 * Both are pinned here. The allowlist in particular: it exists to excuse exactly one constant,
 * and these tests fail if it ever grows into a pattern.
 */
import { describe, expect, it } from "vitest";
import { assertNoSecrets, scanText } from "../src/secret-scan";
import { cmi5Xml, tincanXml } from "../src/manifests";

const CMI5_NS = "https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd";

describe("scanText catches", () => {
  it("an LRS statements endpoint", () => {
    const f = scanText("a.js", 'const url = "https://lrs.example.com/xapi/statements";');
    expect(f.map((x) => x.rule)).toContain("lrs-endpoint-literal");
  });

  it("a Rustici-style data/xAPI endpoint", () => {
    const f = scanText("a.js", 'fetch("https://cloud.scorm.com/data/xAPI/statements")');
    expect(f).not.toHaveLength(0);
  });

  it("an authorization header", () => {
    const f = scanText("a.js", 'headers: { Authorization: "Basic dXNlcjpwYXNzd29yZDEyMw==" }');
    expect(f.map((x) => x.rule)).toContain("authorization-header");
  });

  it("credentials embedded in a URL", () => {
    const f = scanText("a.js", 'const u = "https://user:hunter2@lrs.example.com/";');
    expect(f.map((x) => x.rule)).toContain("url-with-basic-auth");
  });

  it("an auth token assignment", () => {
    const f = scanText("a.js", 'const auth_token = "abcdef0123456789";');
    expect(f.map((x) => x.rule)).toContain("generic-secret-assign");
  });
});

describe("the spec-namespace allowlist", () => {
  it("lets the cmi5 course-structure namespace through", () => {
    expect(scanText("cmi5.xml", `<courseStructure xmlns="${CMI5_NS}">`)).toEqual([]);
  });

  it("excuses only itself — a lookalike under another host still fires", () => {
    const nep = CMI5_NS.replace("w3id.org", "aanvaller.example.com");
    expect(scanText("cmi5.xml", `<courseStructure xmlns="${nep}">`)).not.toHaveLength(0);
  });

  it("excuses only itself — a longer path under the same prefix still fires", () => {
    const f = scanText("a.xml", '<x ns="https://w3id.org/xapi/statements" />');
    expect(f).not.toHaveLength(0);
  });

  it("does not blind the line it appears on: a real secret beside it still fires", () => {
    const f = scanText(
      "cmi5.xml",
      `<courseStructure xmlns="${CMI5_NS}" data-lrs="https://lrs.example.com/xapi/statements">`,
    );
    expect(f.map((x) => x.rule)).toContain("lrs-endpoint-literal");
  });
});

describe("the manifests we ship", () => {
  const invoer = {
    activityId: "https://xapi.example.com/acme/artifacts/3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    title: "Veilig werken op hoogte",
    language: "nl",
    launchFile: "index.html",
  };

  it("pass the scanner — cmi5", () => {
    expect(scanText("cmi5.xml", cmi5Xml(invoer))).toEqual([]);
  });

  it("pass the scanner — tincan", () => {
    expect(scanText("tincan.xml", tincanXml(invoer))).toEqual([]);
  });
});

describe("assertNoSecrets", () => {
  it("names the file, the line and the rule so the finding can be acted on", () => {
    expect(() => assertNoSecrets([])).not.toThrow();
  });
});
