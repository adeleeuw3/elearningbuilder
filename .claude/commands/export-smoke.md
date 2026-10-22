---
description: Build a sample export package, run the secret scan, and open index.html to verify offline render.
---

Build and smoke-test an export package end to end:

1. Ensure `packages/xapi-runtime` and `packages/exporter` are built (`pnpm --filter @ob/xapi-runtime build && pnpm --filter @ob/exporter build`).
2. Export a sample published version for both profiles (xapi and cmi5) into `./.smoke/`.
3. Run the secret scanner over the output: `node packages/exporter/dist/secret-scan.js ./.smoke`. It MUST report "clean".
4. Assert the manifest `activityId` (tincan.xml / cmi5.xml) equals `iri.parent(base, artifactId)` from the observation document.
5. Serve `./.smoke/xapi` statically and confirm `index.html` renders the scene + hotspots with NO network calls except (attempted) LRS ones. Report any console errors.
6. Summarize: files in the ZIP, secret-scan result, activityId match, and offline render status.

Do not commit the `.smoke/` directory.
