/**
 * Manifest builders. The activityId here MUST equal the runtime's parent activity IRI
 * (iri.parent(...)). An export test asserts this equality (plans/01 §8).
 *
 * XML is escaped; no credentials or endpoints appear in either manifest (autodiscovery only).
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface ManifestInput {
  activityId: string; // == iri.parent(base, artifactId)
  title: string;
  description?: string;
  language?: string; // BCP-47, default en-US
  launchFile?: string; // default index.html
  /** cmi5 only: mastery score 0..1 and moveOn behavior. */
  masteryScore?: number;
  moveOn?: "Passed" | "Completed" | "CompletedAndPassed" | "CompletedOrPassed" | "NotApplicable";
}

/** tincan.xml — TinCan/xAPI package manifest. */
export function tincanXml(input: ManifestInput): string {
  const lang = input.language ?? "en-US";
  const launch = input.launchFile ?? "index.html";
  return `<?xml version="1.0" encoding="UTF-8"?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities>
    <activity id="${esc(input.activityId)}" type="http://adlnet.gov/expapi/activities/course">
      <name>${esc(input.title)}</name>
      <description lang="${esc(lang)}">${esc(input.description ?? input.title)}</description>
      <launch lang="${esc(lang)}">${esc(launch)}</launch>
    </activity>
  </activities>
</tincan>
`;
}

/** cmi5.xml — cmi5 course structure (single AU). */
export function cmi5Xml(input: ManifestInput): string {
  const lang = input.language ?? "en-US";
  const launch = input.launchFile ?? "index.html";
  const moveOn = input.moveOn ?? "CompletedOrPassed";
  const mastery =
    input.masteryScore != null ? ` masteryScore="${clamp01(input.masteryScore)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="${esc(input.activityId)}">
    <title><langstring lang="${esc(lang)}">${esc(input.title)}</langstring></title>
    <description><langstring lang="${esc(lang)}">${esc(input.description ?? input.title)}</langstring></description>
  </course>
  <au id="${esc(input.activityId)}" moveOn="${esc(moveOn)}"${mastery} launchMethod="OwnWindow">
    <title><langstring lang="${esc(lang)}">${esc(input.title)}</langstring></title>
    <description><langstring lang="${esc(lang)}">${esc(input.description ?? input.title)}</langstring></description>
    <url>${esc(launch)}</url>
  </au>
</courseStructure>
`;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
