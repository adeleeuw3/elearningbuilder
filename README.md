# Observation Builder — Interactive Learning Artifact Platform

A multi-tenant SaaS for authoring **micro-learning / e-learning artifacts** — realistic,
explorable models (a volcano, a CPU die with every component, a cell, an engine) built from a
**realistic illustration + interactive hotspot overlays**. Artifacts are exported as **xAPI /
cmi5-compliant static packages** that run offline and stream `xAPI` statements to any LRS.

> Platform identifier used in xAPI `context.platform`: **`Observation Builder`**

---

## The three plans

| # | Plan | Use it with | File |
|---|------|-------------|------|
| 1 | **App Development Plan** | Claude Code (build) | [plans/01-app-development-plan.md](plans/01-app-development-plan.md) |
| 2 | **Security Plan** | Claude Code (`/security-review`, hooks, CLAUDE.md) | [plans/02-security-plan.md](plans/02-security-plan.md) |
| 3 | **UI/UX Design Plan** | Claude design / artifact-driven design | [plans/03-ui-ux-design-plan.md](plans/03-ui-ux-design-plan.md) |

---

## Product decisions (locked)

1. **Artifact engine — AI image + hotspot overlays.** Author generates or uploads a realistic
   illustration, then places interactive regions (rect / circle / polygon) on a **normalized
   coordinate overlay**. Each region is a *component* with a label, learn-content, optional
   assessment binding, and a **stable IRI**. Component interactions emit xAPI `experienced` /
   `answered`. (See the honest risk note in the dev plan: text-to-image gives you pixels, not
   semantic boundaries — hotspot placement is author-driven, optionally assisted by segmentation.)

2. **Recommended stack (my recommendation, beyond your spec).** Summarized below; full
   justification + alternatives in [the dev plan](plans/01-app-development-plan.md#2-recommended-stack).

---

## Recommended stack at a glance

| Layer | Choice | Why |
|-------|--------|-----|
| App + BFF | **Next.js 15 (App Router, RSC), TypeScript** | One deployable for UI + API; great DX in Claude Code; streaming UI for long AI jobs. |
| Auth / OIDC | **WorkOS AuthKit** (or Auth0) | B2B multi-tenant SSO, OIDC, SAML, **SCIM directory sync** out of the box — schools/enterprises demand it. Roles map cleanly to your 5 roles. |
| Database | **Postgres** (Neon or Supabase) with **RLS** | First-class row-level tenant isolation + service-layer guards (defense in depth). |
| ORM | **Drizzle** | Typed, thin, sets per-request `app.tenant_id` GUC so RLS "just works"; SQL-transparent. |
| Object storage | **Cloudflare R2** (S3-compatible) | Zero egress fees (you serve lots of image/asset bytes), per-tenant prefixes, SSE at rest, signed URLs. AWS S3 is the drop-in alt. |
| Background jobs | **Inngest** | Durable steps + retries for image generation, thumbnailing, ZIP export, LRS test launches. |
| AI image | **Provider-abstraction layer** (pluggable diffusion API) + optional segmentation assist | Don't marry one vendor; segmentation (SAM-style) *suggests* hotspot regions to cut author time. |
| Exported runtime | **Framework-free TS → esbuild bundle** | `xapi-bootstrap.js` + `xapi_client_min.js` authored in TS, bundled tiny, **no React in the package** → small, offline-robust. |
| Validation | **Zod** + JSON Schema for the "observation" document | One source of truth; generates TS types and runtime guards. |
| Testing | **Vitest** + **Playwright** + statement snapshots | e2e package-launch tests against **Learning Locker / Veracity** in CI. |
| Observability | **Sentry** + OpenTelemetry + Postgres audit log | Errors, traces, and an immutable audit trail for sensitive ops. |
| Hosting | **Vercel** (app) + **Inngest Cloud** (jobs) | Fast path; Fly.io/Render container is the self-managed alternative. |

---

## Repository layout (target)

```
xapi-artifact-developer/
├─ apps/
│  └─ studio/                 # Next.js authoring app (UI + API routes / server actions)
├─ packages/
│  ├─ schema/                 # Zod + JSON Schema for the "observation" document; shared types
│  ├─ xapi-runtime/           # TS source for the EXPORTED package (bootstrap + client)
│  ├─ exporter/               # ZIP builder: templates tincan.xml / cmi5.xml, bundles runtime
│  ├─ db/                     # Drizzle schema, migrations, RLS policies, tenant-session helper
│  └─ ui/                     # Shared React component library + design tokens
├─ packages/xapi-runtime/dist # esbuild output copied into export packages
├─ e2e/                       # Playwright launch tests vs test LRS
├─ docs/ (← plans live in /plans)
├─ CLAUDE.md                  # build + security conventions for Claude Code
└─ .claude/                   # slash commands, agents, hooks, settings
```

---

## Suggested build order (milestones)

`M0` Foundations → `M1` Authoring + schema → `M2` Versioning/publish → `M3` Exporter + runtime →
`M4` xAPI launch + LRS e2e → `M5` Multi-tenant + RBAC + audit → `M6` AI image + hotspot assist → `M7` Hardening.

Details and per-milestone Claude Code prompts are in [the dev plan](plans/01-app-development-plan.md#7-build-phases).
