/**
 * Stable IRI builders. Identity is version-stable (artifactId/pageId/componentId are
 * carried across versions) so an LRS can aggregate a learner's history even after a
 * scene is re-illustrated. Version-scoped IRIs exist where version matters.
 *
 * The exported manifest activityId (tincan.xml / cmi5.xml) MUST equal `iri.parent(...)`.
 */

const trim = (base: string) => base.replace(/\/+$/, "");

export const iri = {
  /** Parent/course activity — the manifest activityId. Version-stable. */
  parent: (base: string, artifactId: string) =>
    `${trim(base)}/artifacts/${artifactId}`,

  /** Version-scoped activity (use when you must distinguish versions). */
  version: (base: string, artifactId: string, version: number) =>
    `${trim(base)}/artifacts/${artifactId}/v/${version}`,

  /** A page activity. */
  page: (base: string, artifactId: string, pageId: string) =>
    `${trim(base)}/artifacts/${artifactId}/pages/${pageId}`,

  /** A component (hotspot) activity. */
  component: (base: string, artifactId: string, componentId: string) =>
    `${trim(base)}/artifacts/${artifactId}/components/${componentId}`,

  /** A component's assessment interaction (cmi.interaction). */
  question: (base: string, artifactId: string, componentId: string) =>
    `${trim(base)}/artifacts/${artifactId}/components/${componentId}/q`,

  /** A media object inside a component's content. */
  media: (base: string, artifactId: string, componentId: string, suffix: string) =>
    `${trim(base)}/artifacts/${artifactId}/components/${componentId}/media/${suffix}`,
} as const;

/** Well-known xAPI verb IRIs used by the runtime. */
export const VERBS = {
  initialized: "http://adlnet.gov/expapi/verbs/initialized",
  experienced: "http://adlnet.gov/expapi/verbs/experienced",
  answered: "http://adlnet.gov/expapi/verbs/answered",
  completed: "http://adlnet.gov/expapi/verbs/completed",
  passed: "http://adlnet.gov/expapi/verbs/passed",
  failed: "http://adlnet.gov/expapi/verbs/failed",
  terminated: "http://adlnet.gov/expapi/verbs/terminated",
} as const;

/** Well-known xAPI activity type IRIs. */
export const ACTIVITY_TYPES = {
  interaction: "http://adlnet.gov/expapi/activities/interaction",
  cmiInteraction: "http://adlnet.gov/expapi/activities/cmi.interaction",
  media: "http://id.tincanapi.com/activitytype/media",
  course: "http://adlnet.gov/expapi/activities/course",
  lesson: "http://adlnet.gov/expapi/activities/lesson",
} as const;

/** cmi5 context category activity — required on cmi5 "defined" statements. */
export const CMI5_CATEGORY =
  "https://w3id.org/xapi/cmi5/context/categories/cmi5";
