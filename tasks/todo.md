# dlmnt-clipper — Tasks

Plan: [`plan.md`](plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task also meets the standing bar: `npm run check-types && npm run lint && npm test`
green, no new suppressions, spec updated if a decision changed.

---

## Phase 1 — Foundation and tracer bullet

### Task 1: Tooling scaffold

**Status:** done (Checkpoint 1 confirmed by user 2026-10-20).

**Description:** Set up WXT with the Vue module, TS 6, Less, Vitest + jsdom, oxlint + ESLint,
Prettier. Rules are copied from dlmnt-fe (`semi: false`, `singleQuote`, `printWidth: 100`,
`noUncheckedIndexedAccess`). Add an empty popup that renders "dlmnt-clipper" with a scoped Less
style, plus one smoke unit test. Also `.gitignore`, `.editorconfig`, `.npmrc` and `engines`
(Node ≥ 24.12).

**Acceptance criteria:**

- [x] `npm run dev` opens Chrome with the extension and the popup shows "dlmnt-clipper".
- [x] `check-types`, `lint`, `format -- --check` and `test` scripts exist and pass.
- [x] No dependency outside SPEC → Tech Stack.

**Verification:**

- [x] `npm install && npm run check-types && npm run lint && npm test`
- [x] `npm run build` succeeds
- [x] Manual: popup opens in Chrome dev profile

**Dependencies:** None

**Files likely touched:** `package.json`, `wxt.config.ts`, `tsconfig.json`,
`eslint.config.ts` + `.oxlintrc.json` + `.prettierrc.json`, `vitest.config.ts`,
`src/entrypoints/popup/{index.html,main.ts,App.vue}`, `src/styles/{variables,base}.less`

**Estimated scope:** M. This is config-heavy; most files are boilerplate.

---

### Task 2: Manifest, environments and permissions

**Status:** done (Checkpoint 1 confirmed). The env file is
`.env.development` (see plan.md → Decisions).

**Description:** Configure the manifest in `wxt.config.ts`: name `dlmnt-clipper` (with the env
suffix when mode ≠ production), permissions `activeTab`, `scripting` and `storage`,
`host_permissions` derived from `WXT_API_URL`, Firefox `gecko.id = clipper@dlmnt`, and
placeholder icons 16/32/48/128. Add `.env.local` (git-ignored) and `.env.example`. Add
`build:all` (chrome, edge, firefox) and `zip` scripts.

**Acceptance criteria:**

- [x] All three `.output/*-mv3/manifest.json` files have `manifest_version: 3`, exactly the
      three permissions, only the `https://dlmnt.test/*` host permission, and no
      `content_scripts`.
- [x] The Firefox manifest has `browser_specific_settings.gecko.id = "clipper@dlmnt"`.
- [x] The build fails with a clear message if `WXT_API_URL` is missing or not a URL.

**Verification:**

- [x] `npm run build:all`, plus a unit test over the manifest builder function
      (permissions, host derivation, missing env)
- [x] Manual: Load unpacked in Chrome and Edge, `about:debugging` in Firefox, with zero
      warnings

**Dependencies:** T1

**Files likely touched:** `wxt.config.ts`, `src/manifest.ts` (pure builder, testable),
`tests/unit/manifest.test.ts`, `.env.example`, `public/icons/*`

**Estimated scope:** S

---

### Task 3: Tracer bullet — click → inject → Readability → popup shows title

**Status:** done (Checkpoint 1 confirmed).

**Description:** Riskiest path first. The popup sends `clip:preview` and the background injects
`extract.ts` into the active tab. The extractor runs Readability on a document clone and
returns `{ title, wordCount, method: 'readability' }`, and the popup renders it. Typed message
definitions go in `lib/messages.ts`. Settle and record in `plan.md` how the result comes back
(injection result or a message fallback) on all three browsers. Check the `extract.js` bundle
size.

**Acceptance criteria:**

- [x] On a real article, the popup shows the article title and a word count in Chrome, Edge
      and Firefox.
- [x] Unit test: `readabilityExtractor` on `tests/fixtures/pages/article.html` returns the
      expected title.
- [x] `extract.js` is < 150 KB minified, and the transport decision is written into `plan.md`.

**Verification:**

- [x] `npm test -- readability`
- [x] `npm run build:all`
- [x] Manual: load each build and open the popup on an article

**Dependencies:** T2

**Files likely touched:** `src/entrypoints/{background.ts,extract.ts}`,
`src/lib/extract/{types.ts,readability.ts}`, `src/lib/messages.ts`,
`src/entrypoints/popup/App.vue`, `tests/fixtures/pages/article.html`

**Estimated scope:** M

---

### Checkpoint 1: Foundation

- [x] Loads in Chrome, Edge and Firefox with zero manifest warnings
- [x] Popup shows the title of a real article in all three
- [x] `check-types`, `lint`, `test` green
- [x] Review with human before proceeding

---

## Phase 2 — Extraction quality

### Task 4: Sanitize, normalize, Markdown

**Status:** done.

**Description:** Write pure lib functions. `sanitize(html, baseUrl)` uses DOMPurify with an
allow-list: it strips `script`, `style`, `iframe`, `form`, `on*` attributes and `javascript:`
/ `data:` URLs (except images), and resolves `href`/`src` to absolute URLs. `normalizeText`
handles whitespace, NBSP and blank-line collapsing. `toMarkdown` uses Turndown with GFM-style
headings and fenced code. Then wire all three into the Readability extractor so
`ExtractedPage` has `html`, `text` and `markdown`.

**Acceptance criteria:**

- [x] A hostile fixture (scripts, handlers, `javascript:` links, relative URLs) produces HTML
      with none of them and only absolute URLs.
- [x] Article fixture `markdown` has the H1 and paragraphs, and `text` has no runs of 3+ newlines.
- [x] `ExtractedPage` fields match SPEC → Data shapes, enforced by the type and asserted by a test.

**Verification:**

- [x] `npm test -- extract` with ≥ 90% line coverage on these files

**Dependencies:** T3

**Files likely touched:** `src/lib/extract/{sanitize.ts,normalize.ts,toMarkdown.ts,readability.ts}`,
`src/types/extracted-page.ts`, `tests/unit/extract/*.test.ts`, `tests/fixtures/pages/hostile.html`

**Estimated scope:** M

---

### Task 5: Fallback chain and non-injectable pages

**Status:** done (Checkpoint 2 confirmed). `isProbablyReaderable`
now picks the extractor (SPEC decision 18).

**Description:** Add `selectionExtractor`, which uses the current selection's ranges and
returns null when nothing is selected, and `fallbackExtractor`, which uses `body.innerText`.
The `extract()` runner tries selection → readability → fallback. It catches errors per
extractor and records `readerable` from `isProbablyReaderable`. The background detects
non-injectable tabs (`chrome://`, `edge://`, `about:`, Web Store/AMO, PDF viewer, or an
injection error) and returns a typed `not-clippable` result.

**Acceptance criteria:**

- [x] With a selection, `method === 'selection'` and the text equals the selection.
- [x] A non-readerable fixture gives `method === 'fallback'` with non-empty text. An extractor
      that throws hands over to the next one.
- [x] Non-injectable URLs return `not-clippable` (unit-tested with `fakeBrowser`) with no
      uncaught errors.

**Verification:**

- [x] `npm test -- extract background`
- [x] Manual: `chrome://extensions`, `about:addons` and a PDF tab show "can't be clipped"

**Dependencies:** T4

**Files likely touched:** `src/lib/extract/{selection.ts,fallback.ts,index.ts}`,
`src/entrypoints/background.ts`, `tests/unit/extract/chain.test.ts`,
`tests/unit/background.test.ts`, `tests/fixtures/pages/{non-readerable,spa}.html`

**Estimated scope:** M

---

### Task 6: Preview UI

**Status:** done (Checkpoint 2 confirmed).

**Description:** Add a `ClipPreview.vue` component showing title, byline, site, excerpt, word
count and a method label ("Article", "Selection", "Full page text"), with a "Save" button that
does nothing for now. Give the popup state machine `extracting | preview | not-clippable |
error` states. Styling is plain scoped Less with nothing ported. Never use `v-html`.

**Acceptance criteria:**

- [x] Component tests cover each state and each method label.
- [x] Popup width and height stay within browser popup limits (≤ 800×600), and long titles
      truncate.
- [x] The byline row is hidden when `byline` is null.

**Verification:**

- [x] `npm test -- components`
- [x] Manual: preview on article, selection and non-readerable pages in Chrome and Firefox

**Dependencies:** T5

**Files likely touched:** `src/components/ClipPreview.vue`, `src/entrypoints/popup/App.vue`,
`src/styles/variables.less`, `tests/components/ClipPreview.test.ts`

**Estimated scope:** S

---

### Checkpoint 2: Extraction

- [x] Fixture suite green, `src/lib/extract/**` coverage ≥ 90%
- [x] SPEC success criteria 3–7 hold
- [x] Review with human before proceeding

---

## Phase 3 — `clips-api` (in `../dlmnt-be`, parallel with Phase 2)

### Task 7: Write `SPEC-clips-api.md` in dlmnt-be

**Status:** done. Spec approved 2026-10-20 (separate test user, 20 saves/min).

**Description:** Expand SPEC → `clips-api` contract and backend notes into a module spec in
dlmnt-be. It covers routes, the token model, the Clip schema and indexes, validation rules,
the sanitizer allow-list, CORS, the 5 MB limit, throttles, the test plan and boundaries.

**Acceptance criteria:**

- [x] Every endpoint, status code and field in the SPEC contract appears unchanged.
- [x] The server sanitizer choice is resolved: `symfony/html-sanitizer`.
- [x] Human approved.

**Verification:**

- [x] Manual: human review

**Dependencies:** None

**Files likely touched:** `../dlmnt-be/SPEC-clips-api.md`

**Estimated scope:** XS

---

### Task 8: Sanctum personal access tokens

**Status:** done. Tokens are honoured only on `AppServiceProvider::TOKEN_ROUTES`. CORS limited
to extension origins. Tests: `ExtensionTokenTest`, `TokenScopeTest`, `ExtensionCorsTest`.

**Description:** Add `HasApiTokens` on `User` and an `App\Models\PersonalAccessToken`
(Sanctum base + `DocumentModel`, `mongodb` connection, `personal_access_tokens` collection,
index on `token`) registered via `Sanctum::usePersonalAccessTokenModel()`. Add
`POST /v3/extension/token` (`email`, `password`, `device_name`; throttle 6/min; 24 h
`expiresAt`; ability `clips:create`) and `DELETE /v3/extension/token`. Confirm `GET /v3/me`
works with a Bearer token. Publish `config/cors.php` with `/v3/*` paths for extension origins.

**Acceptance criteria:**

- [x] Feature tests: a valid login returns a token and an `expiresAt` 24 h out, bad
      credentials return 422, and the 7th attempt within a minute returns 429.
- [x] Feature tests: Bearer works on `/me`, an expired token gets 401, DELETE revokes the
      token and later calls get 401.
- [x] Existing session login and SPA flows are unchanged, and existing tests stay green.

**Verification:**

- [x] `cd ../dlmnt-be && php artisan test && ./vendor/bin/pint --test`

**Dependencies:** T7

**Files likely touched:** `app/Models/{User,PersonalAccessToken}.php`,
`app/Http/Controllers/Api/ExtensionTokenController.php`, `routes/api.php`,
`app/Providers/AppServiceProvider.php`, `config/cors.php`,
`tests/Feature/ExtensionTokenTest.php`

**Estimated scope:** M

---

### Task 9: Clip model and `POST /v3/clips`

**Status:** done. Throttle is 20/min; a token without `clips:create` gets 403. Tests: `ClipTest`.

**Description:** Add a `Clip` model (`clips` collection, `user_id`, all `ExtractedPage` fields,
`clipped_at`, timestamps, index on `user_id` + `created_at`). Add a FormRequest for validation
and a controller that re-sanitizes `html` and stores the clip. Require the `clips:create`
ability, a 5 MB request-size check and a throttle (proposal 30/min). Document the PHP
`post_max_size` and `upload_max_filesize` settings for Herd.

**Acceptance criteria:**

- [x] Feature tests: 201 with `{ id, createdAt }`, the clip is owned by the token's user, and
      `<script>` in the input is absent from the stored `html`.
- [x] Feature tests: 401 without a token, 422 when required fields are missing, 413 over 5 MB,
      429 over the throttle.
- [x] A clip can't be created for another user (`user_id` in the body is ignored).

**Verification:**

- [x] `cd ../dlmnt-be && php artisan test && ./vendor/bin/pint --test`
- [x] Manual: `curl` against `https://dlmnt.test/v3/clips` with a real token

**Dependencies:** T8 (`symfony/html-sanitizer` approved)

**Files likely touched:** `app/Models/Clip.php`, `app/Http/Controllers/Api/ClipController.php`,
`app/Http/Requests/StoreClipRequest.php`, `routes/api.php`, `tests/Feature/ClipTest.php`

**Estimated scope:** M

---

### Checkpoint 3: Backend

- [x] dlmnt-be tests green (29/30; the stock `ExampleTest` already failed before this work), Pint
      green on every changed file
- [x] Token, then a clip saved (201), expired token gets 401, 413 over 5 MB, token revoked,
      all via `curl` on local (`artisan serve --env=testing`; Herd was not running)
- [ ] Review with human before proceeding

---

## Phase 4 — Auth and save in the extension

### Task 10: API client and token storage

**Status:** done. A 403 (token without `clips:create`) maps to `forbidden`.

**Description:** `lib/storage.ts` holds typed `getAuth`, `setAuth` and `clearAuth` over
`storage.local` (`{ token, expiresAt, user }`), and `isExpired()` checks expiry locally.
`lib/api/client.ts` is a fetch wrapper. It builds URLs from `WXT_API_URL`, adds the Bearer
header and JSON headers, and maps errors to a typed `ApiError` (`unauthorized`, `too-large`,
`validation`, `throttled`, `network`, `server`). `auth.ts` and `clips.ts` are thin endpoint
functions, all tested with mocked `fetch`.

**Acceptance criteria:**

- [x] Each status in the SPEC contract maps to the right `ApiError.kind`, unit-tested. Network
      failure maps to `network`.
- [x] An expired token is never sent: `isExpired` short-circuits to `unauthorized` with no
      fetch.
- [x] Nothing is written to `storage.sync` (asserted with `fakeBrowser`).

**Verification:**

- [x] `npm test -- api storage` with ≥ 90% line coverage on `src/lib/api/**` and `storage.ts`

**Dependencies:** T3

**Files likely touched:** `src/lib/storage.ts`, `src/lib/api/{client,auth,clips}.ts`,
`src/types/api.ts`, `tests/unit/api/*.test.ts`

**Estimated scope:** M

---

### Task 11: Sign-in and sign-out slice

**Status:** code complete. The Firefox permission prompt and the real-browser sign-in are
pending (Checkpoint 4). `permissions.request` is the first await of the submit handler, so
Firefox still counts it as part of the click.

**Description:** `SignInForm.vue` takes email and password and shows field errors and the
throttle message. The background handles `auth:sign-in` (with `device_name =
dlmnt-clipper/<browser>`), `auth:sign-out` (DELETE, then clear, clearing even if DELETE fails)
and `auth:status`. The popup shows sign-in when signed out or expired and the user's email
with a "Sign out" link when signed in. On Firefox, before sign-in, it checks the API host
permission and asks for it if missing.

**Acceptance criteria:**

- [x] Component tests cover signed-out, submitting, invalid credentials (422), throttled (429)
      and signed-in.
- [x] Background tests: sign-in stores auth, sign-out calls DELETE and clears auth even when
      the call fails, and an expired auth reports signed-out.
- [ ] Firefox: with the host permission revoked in `about:addons`, sign-in prompts for it and
      then succeeds.

**Verification:**

- [x] `npm test -- SignInForm background`
- [ ] Manual: sign in and out in Chrome and Firefox against the mock, then against local
      dlmnt-be once T8 lands

**Dependencies:** T10 (T8 for the real backend)

**Files likely touched:** `src/components/SignInForm.vue`, `src/entrypoints/background.ts`,
`src/lib/messages.ts`, `src/entrypoints/popup/App.vue`, `tests/components/SignInForm.test.ts`

**Estimated scope:** M

---

### Task 12: Save slice

**Status:** code complete. Real-browser end-to-end pending (Checkpoint 4). The API flow was
verified with curl against Herd. The cached page is dropped when its tab navigates or closes.

**Description:** The background handles `clip:save`. It uses the cached `ExtractedPage` for the
tab and re-extracts if the cache was evicted. It adds `clippedAt`, checks the serialized size
(> 5 MB means `too-large` with no POST) and POSTs to `/clips`. A 401 clears auth. The
`ClipStatus.vue` component shows saving, "Saved", and a distinct message plus "Retry" for each
error. The request runs in the background, so it finishes if the popup closes.

**Acceptance criteria:**

- [x] Background tests: success, re-extract on cache miss, too-large pre-check, and 401 clears
      auth and returns `unauthorized`.
- [x] Component tests cover saving, saved and each error kind with Retry.
- [ ] Manual: closing the popup right after clicking Save still produces a clip in local
      MongoDB.

**Verification:**

- [x] `npm test`
- [ ] Manual: end-to-end against local dlmnt-be in Chrome, Edge and Firefox

**Dependencies:** T6, T11 (T9 for the real backend)

**Files likely touched:** `src/entrypoints/background.ts`, `src/components/ClipStatus.vue`,
`src/entrypoints/popup/App.vue`, `src/lib/messages.ts`, `tests/unit/background.save.test.ts`

**Estimated scope:** M

---

### Checkpoint 4: End-to-end on local

- [ ] Sign in → preview → save → "Saved" in Chrome, Edge and Firefox against `https://dlmnt.test`
- [ ] The clip exists in MongoDB `clips` with the correct `user_id` and sanitized `html`
- [ ] Closing the popup mid-save still saves, and sign-out revokes the token (the next call gets 401)
- [ ] Review with human before proceeding

---

## Phase 5 — Hardening

### Task 13: Coverage, legacy check, docs, smoke checklist

**Description:** Enforce coverage thresholds in `vitest.config.ts` (`src/lib/**` ≥ 90% lines).
Add an `npm run check:legacy` script that runs
`grep -riE "slice|mixpanel|herokuapp" src public wxt.config.ts` and fails on any match. Write
a README covering setup, the local env, loading each browser, Herd TLS on Firefox, and how to
add `.env.stage`/`.env.production`. Add `docs/smoke-checklist.md` and run it on all three
browsers.

**Acceptance criteria:**

- [ ] `npm test -- --coverage` fails if coverage drops below the threshold.
- [ ] `npm run check:legacy` passes.
- [ ] The smoke checklist is filled in for Chrome, Edge and Firefox, and all 11 SPEC success
      criteria are ticked.

**Verification:**

- [ ] `npm run check-types && npm run lint && npm test -- --coverage && npm run check:legacy && npm run build:all`
- [ ] Manual: smoke checklist

**Dependencies:** T12, T9

**Files likely touched:** `vitest.config.ts`, `package.json`, `README.md`,
`docs/smoke-checklist.md`

**Estimated scope:** S

---

### Checkpoint 5: Complete

- [ ] All SPEC success criteria met
- [ ] Ready for review
