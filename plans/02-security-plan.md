# Plan 2 — Security Plan (adoptable in Claude Code)

> **Goal:** a security plan you can *operationalize* in Claude Code. Two halves: (A) the controls
> themselves, mapped to this product's specific risks, and (B) **how to make Claude Code enforce
> them** — CLAUDE.md rules, hooks, the `/security-review` skill, permissions, and per-feature
> checklists.
>
> The defining security facts of this product:
> 1. **Multi-tenant** — one DB, many orgs; isolation is the #1 invariant.
> 2. **Exported packages are public, static, and leave your infrastructure** — they must contain
>    **zero secrets** and must not be a malware/XSS vector when opened in a customer LMS.
> 3. **You handle learner identity (xAPI actor)** — privacy and PII obligations (FERPA/COPPA/GDPR).

---

## A. Controls

## 1. Threat model

**Assets:** tenant content (artifacts, versions, assets), learner PII (xAPI actors), LRS
credentials/launch secrets, auth sessions, generated illustrations (IP).

**Actors / trust boundaries:**
- Browser ↔ Studio API (authenticated, tenant-scoped).
- Studio ↔ Postgres / R2 / Inngest / WorkOS (server-to-server).
- **Exported package ↔ customer LRS** — *untrusted, public, offline-capable*. Receives launch
  data at runtime; must never embed your secrets.
- AI image/segmentation provider (outbound, attacker-influenceable prompts).

**Top threats (STRIDE-flavored):**
| Threat | Example | Primary control |
|---|---|---|
| Tenant data leak | Author in tenant A reads tenant B artifact | RLS + service guards + isolation tests (§2) |
| Secret exposure in export | LRS auth/key baked into `xapi-bootstrap.js` | Autodiscovery only; export secret-scan (§6) |
| Stored XSS via authored content | Malicious HTML in learn-content runs in LMS | Sanitize on author + render; CSP in package (§6) |
| Broken access control | Reviewer publishes; Viewer exports | RBAC route+object guards (§4) |
| SSRF | Attacker sets image-gen / LRS URL to internal host | URL allowlist + egress controls (§9) |
| Malicious upload | Polyglot/SVG-with-script image | Content-type + magic-byte + re-encode (§8) |
| PII over-collection | Email in extensions without consent | actor.account default; consent gate (§7) |
| Audit tampering | Cover up a malicious publish/delete | Append-only, hash-chained audit log (§5) |
| Credential/session theft | Stolen session → tenant takeover | OIDC + short sessions + rotation (§3) |
| Supply chain | Compromised dep ships in package | Lockfile + SCA + SBOM + pinned runtime (§10) |

---

## 2. Multi-tenant isolation (the #1 invariant)

- **RLS on every tenant table**, policy `tenant_id = current_setting('app.tenant_id')::uuid` for
  both `USING` and `WITH CHECK`.
- **Service-layer guard = defense in depth.** All data access flows through `withTenant(tenantId,
  fn)` which sets `SET LOCAL app.tenant_id` inside the transaction. **Rule: no raw `db` access
  outside `withTenant`.** (Enforce via lint/CLAUDE.md, §B.)
- **The DB role used by the app must NOT be the table owner / superuser** (owners bypass RLS).
  Use a restricted role so RLS is non-bypassable.
- **R2/S3 isolation:** keys prefixed `t/{tenantId}/...`; signed URLs scoped per object; bucket
  policy denies cross-prefix; SSE (AES-256/KMS) at rest.
- **Isolation test suite (must exist, must run in CI):** seed tenants A & B; assert (a) service
  layer denies cross-tenant read/write, (b) a query with the *wrong* GUC returns zero rows,
  (c) a query with *no* GUC returns zero rows (fail-closed), (d) signed URL for A's asset can't be
  forged for B.

---

## 3. Authentication

- **OIDC via WorkOS/Auth0** (Authorization Code + PKCE). No password handling in-app.
- Sessions: short-lived, **HttpOnly + Secure + SameSite=Lax/Strict** cookies; rotate on
  privilege change; absolute + idle timeouts; server-side session store (or signed, short JWT with
  rotation). Logout invalidates server-side.
- **Org/tenant binding:** the session carries the active `tenant_id`; switching tenants
  re-resolves membership. Never trust a `tenant_id` from the client body/query — derive it from
  the session/membership.
- Enforce SSO/MFA at the IdP for Admin/Owner; support SCIM deprovisioning (revoke on offboard).

---

## 4. Authorization (RBAC)

Roles: **Owner, Admin, Author, Reviewer, Viewer.** Enforce at **route** (middleware) *and*
**object** level (service guard validates role ∧ tenant ∧ resource state).

| Action | Owner | Admin | Author | Reviewer | Viewer |
|---|---|---|---|---|---|
| Manage tenant / billing | ✅ | — | — | — | — |
| Manage members / roles | ✅ | ✅ | — | — | — |
| Create/edit draft artifact | ✅ | ✅ | ✅ | — | — |
| Comment / request changes | ✅ | ✅ | ✅ | ✅ | — |
| **Publish** version | ✅ | ✅ | ✅* | — | — |
| **Export** package | ✅ | ✅ | ✅ | ✅ | — |
| View published / preview | ✅ | ✅ | ✅ | ✅ | ✅ |
| Soft-delete / restore | ✅ | ✅ | ✅* | — | — |
| Configure LRS test target | ✅ | ✅ | — | — | — |
| Read audit log | ✅ | ✅ | — | — | — |

`*` Author limited to artifacts they own or are assigned to (object-level check). Confirm whether
Reviewers should publish — by default they cannot (separation of duties: author creates, reviewer
approves, then publish).

**Rule:** every mutating handler calls `authorize(actor, action, resource)` *before* the
`withTenant` work; deny-by-default; no role check inferred from UI state.

---

## 5. Audit logging

- **Append-only** `audit_log`; no UPDATE/DELETE (revoke those grants from the app role).
- **Hash-chained:** `hash = H(prev_hash || canonical(row))` so tampering is detectable.
- Log: actor, tenant, action, target, before/after summary (no secrets/PII bodies), timestamp, IP,
  request id. Sensitive ops: publish, export, delete/restore, role/membership change, LRS config,
  login anomalies.
- Audit reads are themselves authorized (Admin/Owner) and *also* audited.

---

## 6. Exported-package security (the part most products get wrong)

The package is **public, static, and runs on someone else's LMS.** Treat it like shipping a
browser extension.

- **No secrets, ever.** `xapi-bootstrap.js` ships with *no* endpoint/auth/key. All credentials
  arrive at runtime via the autodiscovery chain (cmi5 fetch → LaunchR → `LMSLaunchData` → URL →
  dev-only manifest). **Export must fail the build if any secret-shaped string is present.**
- **Sanitize authored content twice:** (1) on author/save — strip/clean HTML to an allowlist
  (e.g. DOMPurify-equivalent, no `<script>`, no event handlers, no `javascript:`/`data:` URLs in
  unsafe contexts); (2) the runtime renders sanitized content and *never* uses `innerHTML` on raw
  author input.
- **CSP in `index.html`:** restrict `default-src 'self'`; allow the LRS endpoint origin
  (discovered) for `connect-src`; **no inline scripts** (hash/nonce the bootstrap), no `eval`.
  Add `X-Content-Type-Options: nosniff` guidance for hosting LMSs.
- **Subresource Integrity (SRI)** on bundled scripts where the loader allows it; pin the runtime
  bundle by content hash.
- **Deterministic, reviewable output** — stable file ordering, no build-host paths/timestamps, so
  a human (or `/security-review`) can diff what ships.
- **Offline-safe:** the only network egress is the discovered LRS; the package makes no calls to
  your infrastructure.

---

## 7. xAPI privacy & data protection

- **`actor.account` is the default** identifier (opaque `homePage` + `name`), *not* `mbox`.
- If `mbox` is required by a buyer, support **`mbox_sha1sum`** (hash email) rather than raw email.
- **No PII in `extensions`** without explicit consent; consent state recorded and auditable.
- Encryption: **TLS 1.2+ in transit** everywhere; **at rest** for DB (transparent) and R2 (SSE).
- **Data residency / retention:** configurable per tenant; document subprocessors (image provider,
  WorkOS, LRS is the *customer's*). Provide data export + deletion (soft-delete + purge job).
- **Education compliance:** FERPA (education records), COPPA (under-13 — minimize, parental
  consent path), GDPR/UK-GDPR (lawful basis, DSAR, DPA). Keep learner data minimization as the
  default posture; the platform should be usable with *zero* PII (account-only actors).

---

## 8. Input validation & file uploads

- **Validate everything with Zod / JSON Schema** at the boundary; reject unknown fields on the
  observation document; bound array sizes and string lengths (DoS via huge documents).
- **Image uploads:** verify by **magic bytes** not just `Content-Type`; **re-encode** raster
  images server-side (strip EXIF, kill polyglots); **reject SVG uploads** for scenes (SVG = script
  vector) or sanitize SVG strictly if ever allowed; enforce max dimensions + file size; store
  `sha256` for dedupe/provenance.
- **Filename/key safety:** never use client filenames as storage keys; generate keys.
- Normalize and clamp hotspot coordinates to `[0,1]`.

---

## 9. SSRF & outbound egress

- **AI image / segmentation / LRS-test URLs are attacker-influenceable.** Enforce an **allowlist**
  of provider hosts; for any user-supplied URL (e.g. dev LRS target) **block private/link-local/
  metadata ranges** (RFC1918, `169.254.0.0/16`, `::1`, `fd00::/8`), resolve-then-pin the IP, and
  disable redirects to disallowed hosts.
- Run outbound calls from a network egress that cannot reach internal services / cloud metadata
  (`169.254.169.254`).

---

## 10. Secrets, dependencies, supply chain

- Secrets in a manager (Vercel/Cloud env, or Vault) — **never** in repo, client bundles, or export
  output. Rotate provider keys; scope them minimally.
- **Lockfile committed**; **SCA** (e.g. `npm audit` / Socket / Snyk) in CI; **Dependabot/Renovate**
  for updates; **pin the exported `xapi-runtime` bundle** and review any change to it as
  security-sensitive (it runs on customer machines).
- **Generate an SBOM** (CycloneDX) for the app and for the export runtime.
- **License/provenance for generated illustrations:** store model, prompt, and license per asset
  (IP defensibility + the ability to purge if a provider's terms change).

---

## 11. Application hardening (Studio)

- Security headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-
  Options`, `Referrer-Policy`, `Permissions-Policy`, frame-ancestors none (anti-clickjacking).
- **CSRF:** SameSite cookies + anti-CSRF tokens on state-changing non-idempotent routes (or rely
  on same-site + custom header for fetch).
- **Rate limiting / abuse:** per-tenant + per-IP limits on auth, export, and **AI image generation**
  (cost-control + abuse). Quotas per plan.
- **Error handling:** no stack traces / internal detail to clients; correlation IDs in logs.
- **Observability:** Sentry + OTel; alert on auth anomalies, RLS-denied spikes, export secret-scan
  failures, egress-block hits.

---

## B. Operationalizing it in Claude Code

This is the part you "adopt." Put these in the repo so Claude Code enforces the plan continuously.

### B1. `SECURITY.md` + security rules in `CLAUDE.md`
Add a **non-negotiable invariants** block to `CLAUDE.md` that Claude Code reads every session:

```md
## Security invariants (do not violate; flag if a task seems to require it)
1. All DB access goes through `withTenant(tenantId, fn)`. Never use the raw `db` client in a
   request path. Never accept `tenant_id` from client input — derive from session/membership.
2. Every mutating handler calls `authorize(actor, action, resource)` before doing work. Deny by default.
3. NOTHING in `packages/xapi-runtime`, `packages/exporter` output, or any export ZIP may contain
   an endpoint, auth header, key, token, or secret. LRS access comes only from runtime autodiscovery.
4. All authored HTML is sanitized on save AND on render. Never `innerHTML` raw author input.
5. Validate all boundary input with the Zod/JSON schema in `packages/schema`. Reject unknown fields.
6. Any user-supplied URL (image-gen, LRS target) goes through `assertSafeUrl()` (SSRF allowlist).
7. Append-only audit log on: publish, export, delete/restore, role change, LRS config.
8. Image uploads: magic-byte check + re-encode + EXIF strip; reject SVG scenes.
```

### B2. Hooks (`.claude/settings.json`)
- **Post-edit hook:** run `tsc --noEmit` + `eslint` on changed packages (catches missing tenant
  guards if you add a custom lint rule, below).
- **Pre-commit / pre-export hook — secret scanner on export output:** fail if the built package or
  `packages/xapi-runtime/dist` matches secret patterns (`Authorization`, `Basic `, `Bearer `,
  endpoint URLs, `auth=`, private keys, high-entropy strings). This is the single most important
  automated gate.
- **Block hook** preventing edits that introduce `dangerouslySetInnerHTML` / `innerHTML =` on
  un-sanitized variables, or raw `db.` usage in `apps/studio/app/**` route handlers.

### B3. Custom ESLint rules (machine-enforce the invariants)
- Ban `db.select/insert/...` outside `packages/db/**` and `withTenant` callbacks.
- Ban `innerHTML`/`dangerouslySetInnerHTML` except with the project's `Sanitized` wrapper type.
- Ban `process.env.*_SECRET` (or any secret) imports inside `packages/xapi-runtime/**` and
  `packages/exporter/templates/**`.

### B4. The `/security-review` skill in the workflow
- Run **`/security-review`** on every PR/branch before merge (it reviews the pending diff). Make it
  a required check. Pair with the built-in `/code-review` for correctness.
- Keep a **per-feature security checklist** (template below) that Claude Code fills in each PR.

### B5. CI gates (must be green to merge)
1. Tenant-isolation test suite (§2) passes.
2. Export **secret-scan** passes (no secrets in any package output).
3. Statement-snapshot tests unchanged (or intentionally updated + reviewed).
4. SCA / `npm audit` (no high/critical), license check on deps + generated assets.
5. `tincan.xml`/`cmi5.xml` schema validation + `activityId` equality check.
6. SBOM generated and stored as artifact.

### B6. Per-feature security checklist (paste into each PR)
```
- [ ] All new DB access goes through withTenant; RLS policy exists for any new table.
- [ ] authorize() called for every new mutating route; role matrix updated if needed.
- [ ] Any new authored-content surface is sanitized on save + render.
- [ ] Any new outbound URL uses assertSafeUrl(); provider host added to allowlist intentionally.
- [ ] No secret reachable from export output / xapi-runtime.
- [ ] New boundary inputs validated by schema; sizes bounded.
- [ ] Sensitive ops emit audit-log entries.
- [ ] PII: actor.account only; no new PII in extensions without consent gate.
- [ ] Tests: isolation, snapshot, and secret-scan still green.
```

### B7. Permissions / settings discipline
- In `.claude/settings.json`, allowlist routine read-only/build commands; require approval for
  anything touching secrets, infra, or `git push`. Never auto-allow commands that print env vars.

---

## C. Pre-launch security checklist (gate to production)

- [ ] Pen test / threat-model review of tenant isolation + export pipeline.
- [ ] RLS verified non-bypassable (app role is not table owner/superuser).
- [ ] Export secret-scan + CSP + sanitization verified on real packages.
- [ ] OIDC hardening (PKCE, session rotation, SCIM deprovisioning) verified.
- [ ] SSRF egress controls verified against metadata endpoint.
- [ ] DPA + subprocessor list published; FERPA/COPPA/GDPR posture documented.
- [ ] Incident response runbook + on-call + Sentry alerts wired.
- [ ] Backups + restore drill for Postgres and R2; retention/purge jobs tested.
