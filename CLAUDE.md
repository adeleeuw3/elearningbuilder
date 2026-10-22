# CLAUDE.md — build & security conventions

Observation Builder: a multi-tenant SaaS that authors realistic learning artifacts
(image + interactive hotspots) and exports **xAPI / cmi5** static packages that run offline and
stream statements to any LRS. Read `plans/` for the full design.

## Stack (see plans/01 §2)
Next.js 15 (App Router, RSC, TS) · WorkOS (OIDC/SAML/SCIM) · Postgres + RLS · Drizzle ·
Cloudflare R2 (S3-compatible) · Inngest (jobs) · esbuild-bundled framework-free export runtime ·
Zod + JSON Schema · Vitest + Playwright.

## Repo map
- `packages/schema` — the observation document (Zod = source of truth), IRI builders. Import as `@ob/schema`.
- `packages/xapi-runtime` — code that ships INSIDE export packages (discovery + client + statements). No secrets, no framework.
- `packages/db` — Drizzle, migrations, RLS, `withTenant`. Import as `@ob/db`.
- `packages/exporter` — ZIP builder, manifests, secret-scan.
- `packages/ui` — Prism React components (`@ob/ui`). ALL app UI is built from these; don't
  hand-roll a styled div when a component exists. See `packages/ui/README.md`.
- `apps/studio` — Next.js authoring app.

## Security invariants — DO NOT VIOLATE. If a task seems to require breaking one, stop and flag it.
1. **Tenancy.** All tenant-data access goes through `withTenant(tenantId, fn)` from `@ob/db`.
   Never use a raw `db` client in a request path. Never read `tenant_id` from client
   body/query — derive it from the authenticated session/membership.
2. **Authorization.** Every mutating handler calls `authorize(actor, action, resource)` BEFORE
   doing work. Deny by default. Role matrix is in plans/02 §4.
3. **No secrets in exports.** NOTHING in `packages/xapi-runtime`, `packages/exporter` output, or
   any export ZIP may contain an endpoint, auth header, key, or token. LRS access is discovered
   at runtime only (`discoverLRS`). The exporter runs `assertNoSecrets()` before zipping.
4. **Sanitize authored HTML** on save AND on render. Never `innerHTML`/`dangerouslySetInnerHTML`
   on un-sanitized author input; use the `Sanitized` wrapper.
5. **Validate at the boundary** with `@ob/schema` (`parseObservation`). Reject unknown fields
   (schemas are `.strict()`). Bound array/string sizes.
6. **SSRF.** Any user-influenced URL (image-gen, dev LRS target) goes through `assertSafeUrl()`
   (allowlist + block private/link-local/metadata ranges).
7. **Audit.** Emit an append-only audit entry on: publish, export, delete/restore, role change,
   LRS config change.
8. **Uploads.** Images: magic-byte check + re-encode + EXIF strip; reject SVG scenes.

## UI — Prism design system (single source of truth)
The app's look is defined by **Prism**, in `design/prism/`. Read `design/prism/DESIGN_SYSTEM.md`
and `design/prism/motion.md` before ANY UI task. Never invent colors, radii, shadows or easings.
- Import `design/prism/tokens.css` once at the root; put class `prism-app` on the top wrapper.
  React/Tailwind stacks use `design/prism/tailwind.preset.js`. `tokens.json` is for tooling.
- **Color = meaning.** Three pairs, one meaning each; the two tints always run as a 135° gradient:
  **Flow** (blue) = active/busy/selected/connection/primary action ·
  **Glow** (yellow→peach) = completed/unlocked/validated/reward ·
  **Bloom** (pink→magenta) = AI generation, optional & new content.
  Locked = `opacity:.55`, no glow. Rest = flat `--elevation`.
- **Max ONE glow color per element.** When a node is both AI and busy, state owns the glow and the
  category shows as a wash chip. Glow only where state earns it — never decoration.
- Fluent geometry: controls `--r-control` 4px · cards/nodes `--r-card` 8px · panels `--r-large` 12px.
- Type roles (HK Grotesk, fallback `"Segoe UI Variable"`): Title 30/700/-.02em · Subtitle 20/600 ·
  Body 15/400 · Label 12/600/+.12em UPPERCASE · Caption 11/500. Never load a font from a CDN.
- Motion = expressive springs: `--spring-snappy` (controls), `--spring-flow` (selection/hover),
  `--spring-bloom` (unlocks/celebration). Animate `transform`/`opacity` only. Honor
  `prefers-reduced-motion` (tokens already drop overshoot).
- **Use `@ob/ui`.** Never re-implement a Prism control. Components take a semantic `tone`
  (`flow|glow|bloom|rest|locked`), never a colour prop — `<Chip tone="glow">Published</Chip>`.
  The one-glow-per-element and rest/locked rules are enforced by `packages/ui/src/lib/tone.ts`
  and its test suite; go through `toneShadow()` rather than writing `shadow-glow-*` by hand.
- Working reference: `design/prism/components.html`. App prototype: `design/ui-mockups.html`.

## Product invariants
- Hotspot coordinates are ALWAYS normalized 0..1 of the scene. Never store pixels.
- Published `artifact_versions` are immutable (DB trigger enforces it). Editing = new draft.
- Soft-delete only (`deleted_at`); never hard-delete authored content.
- Stable IRIs: `artifactId`/`pageId`/`componentId` are seeds carried across versions. Use
  `iri.*` from `@ob/schema`; the manifest `activityId` MUST equal `iri.parent(base, artifactId)`.
- The `altText` fields are required to publish (WCAG AA) — `publishBlockers()` enforces it.

## xAPI discipline
- Statements are built ONLY via `packages/xapi-runtime/statements`. Don't hand-roll statement JSON.
- Every statement carries `X-Experience-API-Version: 1.0.3`, prefers `actor.account`, and sets
  `context.platform = "Observation Builder"`, `language = navigator.language`,
  `registration`, and `contextActivities.parent`.
- Delivery is idempotent (PUT with statementId) and queued/retried offline. Don't bypass `LRSClient`.
- Changing a statement shape? Update the statement-snapshot tests deliberately in the same PR.

## Testing (must stay green)
`pnpm test` (Vitest), `pnpm typecheck`, `pnpm lint`. Required suites: tenant-isolation,
statement snapshots, exporter (offline + manifest activityId equality), secret-scan.
e2e launch tests run against a containerized Learning Locker in CI.

## Workflow
- Small, reviewable PRs per plans/01 milestones. Run `/security-review` on every branch before merge.
- After edits, the post-edit hook runs typecheck + lint on changed packages; fix before continuing.
- Never commit secrets. Never weaken RLS (the app DB role must not own tables / be superuser).
