# Implementation Plan: dlmnt-clipper

Source of truth: [`../SPEC.md`](../SPEC.md) (draft v3, approved 2026-10-20). Task checklist:
[`todo.md`](todo.md).

## Overview

Build an MV3 extension (Chrome, Edge, Firefox) with WXT + Vue 3 + TS + Less. It extracts the
current page with Readability, falling back to the selection or the page text, sanitizes the
result and saves it to a new `POST /v3/clips` endpoint in `dlmnt-be` using a 24 h Sanctum
personal access token. Only the `local` environment is configured in v1.

The work is two modules (see SPEC → Modules): `extension` (this repo) and `clips-api`
(`dlmnt-be`). The contract between them is frozen in SPEC, so the extension is built against a
mocked API and the backend can be built in parallel. They meet at Checkpoint 4.

## Architecture Decisions

- **WXT drives the manifest.** `wxt.config.ts` builds the manifest from env (`WXT_API_URL` →
  `host_permissions`) and per-browser settings (`gecko.id = clipper@dlmnt`). There is no
  hand-written `manifest.json`.
- **No content scripts.** The background injects `extract.ts` (an unlisted script) with
  `scripting.executeScript({ files: ['/extract.js'] })` on user action and reads the
  `ExtractedPage` from the injection result. **Settled in T3:** WXT builds unlisted scripts as an
  IIFE whose value is `main()`'s return value, which is the script's completion value and so
  becomes `InjectionResult.result` (confirmed in the built `extract.js`). No message round-trip
  is needed. Real-browser confirmation is part of Checkpoint 1.
- **All extraction runs in the page context.** Readability, DOMPurify and Turndown are bundled
  into `extract.ts`, so only sanitized data crosses into the extension.
- **The background owns network and auth.** The popup is a thin Vue view that talks to the
  background through typed messages (`lib/messages.ts`). This keeps saves alive when the popup
  closes and keeps the token in one place.
- **Token lifecycle.** `{ token, expiresAt }` lives in `storage.local`. Expiry is checked
  locally before every call, and a 401 also clears the token.
- **`Extractor` interface.** `selection`, `readability` and `fallback` are tried in order. Each
  returns `null` to pass to the next. Defuddle can be added later as another implementation.
- **Backend sanitizes again.** The server never trusts client HTML.

## Dependency Graph

```
T1 tooling scaffold
 └─ T2 manifest + env + permissions
     └─ T3 tracer bullet: click → inject → Readability → popup shows title   ◀ highest risk
         ├─ T4 sanitize / normalize / markdown (lib)
         │   └─ T5 fallback chain + non-injectable pages
         │       └─ T6 preview UI
         └─ T10 API client + token storage (mocked fetch)
             └─ T11 sign-in / sign-out slice
                 └─ T12 save slice  ◀── needs T9 for real integration (mock until then)

T7 SPEC-clips-api.md (dlmnt-be)  ── human approval
 └─ T8 Sanctum tokens + /extension/token + CORS
     └─ T9 Clip model + POST /clips

T12 + T9 → Checkpoint 4 (end-to-end on local)
 └─ T13 hardening: coverage, legacy-grep, build:all, README, smoke checklist
```

## Phases

### Phase 1 — Foundation and tracer bullet (T1–T3)

Get a real MV3 extension loading in all three browsers that extracts a page title end-to-end.
This settles the riskiest unknowns first: WXT + Vue + Less on Vite, Firefox MV3, and getting
the injection result back from `executeScript`.

**Checkpoint 1:** loads in Chrome, Edge and Firefox with zero manifest warnings. Clicking the
icon on a real article shows its title in the popup. Lint, type-check and tests are green.

### Phase 2 — Extraction quality (T4–T6)

Build the full extraction pipeline and preview against HTML fixtures, with no backend
involved. Covers SPEC success criteria 3–7.

**Checkpoint 2:** the fixture suite passes and `src/lib/extract/**` coverage is ≥ 90%. The
manual preview works on an article, a selection, a non-readerable page and a `chrome://` page.

### Phase 3 — `clips-api` in dlmnt-be (T7–T9) — can run in parallel with Phase 2

Write and approve `SPEC-clips-api.md` in `dlmnt-be`, then implement the contract with Laravel
feature tests.

**Checkpoint 3:** dlmnt-be's `php artisan test` is green. With `curl` against
`https://dlmnt.test/v3`, you can get a token, save a clip (201), get 401 with an expired token,
get 413 when over 5 MB, and revoke the token.

### Phase 4 — Auth and save in the extension (T10–T12)

Wire the extension to the API: mocked in unit tests, real against local dlmnt-be once
Checkpoint 3 is done.

**Checkpoint 4:** end-to-end on local dlmnt-be in all three browsers: sign in → preview →
save → "Saved", and the clip is visible in MongoDB `clips` with the right `user_id`. Closing
the popup mid-save still saves. Sign-out revokes the token.

### Phase 5 — Hardening (T13)

**Checkpoint 5 (done):** all 11 SPEC success criteria are checked off and the smoke checklist
passes on all three browsers. Ready for review.

## Parallelization

- Phase 3 (backend) runs alongside Phases 2 and 4. The contract is frozen in SPEC.
- T4 and T10 are independent once T3 is done.
- T12 can be finished against the mock and integrated once T9 lands.

## Risks and Mitigations

| Risk                                                                                 | Impact | Mitigation                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `executeScript` result from a WXT unlisted script differs per browser            | High   | Settled in T3 across all 3 browsers. If it doesn't come through, fall back to `runtime.sendMessage` from the injected script.                       |
| Firefox doesn't trust the Herd local TLS cert for `dlmnt.test`                       | Med    | Document `security.enterprise_roots.enabled` (or importing Herd's CA) in the README. Verify at Checkpoint 4.                                        |
| Firefox host permission is not granted or gets revoked                               | Med    | Check with `permissions.contains` before calling the API and ask with `permissions.request` from the popup (T11).                                   |
| Readability throws or returns junk on SPAs or very large DOMs                        | Med    | Wrap each extractor in try/catch so a failure moves to the next one. Fixtures include an SPA-like page and a huge page.                             |
| Payload over 5 MB                                                                    | Low    | Measure the serialized size in the background before POSTing and show the 413 message without a network call. The server limit stays authoritative. |
| No Mongo Sanctum token model in `laravel-mongodb` 5                                  | Med    | Custom `PersonalAccessToken` (Sanctum base class + `DocumentModel` trait). Feature tests cover token lookup, expiry and revoke (T8).                |
| dlmnt-be has no published `config/cors.php`, so Laravel's default paths miss `/v3/*` | Low    | Publish and configure it in T8. Browsers with granted host permissions bypass CORS, so this is a fallback.                                          |
| Bundled extractor too large or slow to inject                                        | Low    | Check the `extract.js` size in T3; budget < 150 KB minified.                                                                                        |
| WXT 0.x breaking changes                                                             | Low    | Pin exact minor (`~0.21`), commit lockfile.                                                                                                         |

## Decisions

- 2026-10-20: local env file is `.env.development`, not `.env.local`. Vite and WXT load
  `.env.local` in every mode, so it would leak into stage and production builds.
- 2026-10-20: Firefox minimum is 142, the first version supporting
  `data_collection_permissions`. AMO requires that key for new add-ons.
- 2026-10-20: `web-ext` added as a dev dependency. It's WXT's browser runner and lints the
  Firefox build.
- 2026-10-20: popup⇄background messages reply via `sendResponse` + `return true`. Promise
  returns from `onMessage` are not reliable across all three browsers.

- 2026-10-20: server-side sanitizer for dlmnt-be is `symfony/html-sanitizer`.
- 2026-10-20: no git commits for now; work stays uncommitted until the user asks.

## Open Questions

None.
