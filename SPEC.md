# Spec: dlmnt-clipper (browser extension)

Status: **draft v3 — awaiting approval** · Last updated: 2026-10-20

## Objective

A browser extension (Chrome, Edge, Firefox) that extracts the readable text of the current web
page and saves it to the dlmnt backend (`dlmnt-be`) for the signed-in user.

**User:** a dlmnt user browsing the web who wants to keep an article (or a part of one) without
copy-pasting.

**User stories**

1. As a user, I click the toolbar icon on an article and save its cleaned-up text with one click.
2. As a user, I select a passage first and save only that passage.
3. As a user, I see a preview (title, byline, excerpt, word count) before saving.
4. As a user, I sign in once and stay signed in until I sign out or the token is revoked.
5. As a user, I get a clear message when a page cannot be extracted or saved, and can retry.

**v1 is save-only.** No listing, viewing, editing or deleting clips — in the extension or in
dlmnt-fe.

**Reference:** `../slice-extension` is the behavioral reference for _extraction only_ (Mozilla
Readability + `isProbablyReaderable`). Nothing else is carried over (see Boundaries → Never).

### Modules

| Module id   | Responsibility                                                    | Lives in   | Depends on  |
| ----------- | ----------------------------------------------------------------- | ---------- | ----------- |
| `clips-api` | Sanctum token auth for the extension + `POST /v3/clips` + storage | `dlmnt-be` | —           |
| `extension` | MV3 extension: extract, preview, sign-in, save                    | this repo  | `clips-api` |

Build order: `clips-api` contract (below) is frozen → `extension` built against a mocked
contract → `clips-api` implemented → integrate against local `dlmnt-be`. This spec fully covers
`extension` and defines the `clips-api` **contract**; the backend implementation gets its own
`SPEC-clips-api.md` in `dlmnt-be`.

## Approach (and what changes vs. slice-extension)

| Concern            | slice-extension                                                                                                      | dlmnt-clipper                                                                                                                                 | Why                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Manifest           | Declares v3 but uses MV2 keys (`browser_action`, `background.scripts`, string CSP, `executeScript`) — would not load | Real **MV3** for all targets: `action`, `chrome.scripting`, default CSP; background is a service worker (Chrome/Edge) or event page (Firefox) | MV2 is no longer supported in Chrome; WXT emits the right background form per browser |
| Build              | None (raw JS, Readability imported from `node_modules` at runtime)                                                   | **WXT 0.21** + `@wxt-dev/module-vue`, Vue 3 + TS + Less, bundled                                                                              | One codebase → per-browser manifests, HMR, zip/AMO-sources tooling                    |
| Injection          | Content script on **every** http(s) page + re-inject all tabs on install                                             | **On-demand** injection of a bundled extractor via `scripting.executeScript` on user action                                                   | Smallest permission set (`activeTab`), zero cost on pages the user never clips        |
| Permissions        | `tabs`, `<all_urls>`, `storage`, `activeTab`                                                                         | `activeTab`, `scripting`, `storage` + `host_permissions` for the configured API origin only                                                   | Least privilege; faster store review                                                  |
| Readable check     | `isProbablyReaderable` is a hard gate → many pages fail                                                              | Picks the extractor, never blocks: selection → Readability (readerable pages) → `body.innerText`                                              | Something useful is always extractable; UI shows which method was used                |
| Output             | Unsanitized Readability HTML string-concatenated with user name/date                                                 | Structured payload: **DOMPurify-sanitized** `html` + plain `text` + `markdown` (Turndown) + metadata                                          | Safe to store/render later                                                            |
| Network            | From popup (dies if popup closes)                                                                                    | From the **background**; popup sends a typed message and awaits the result                                                                    | Save completes even if the popup closes                                               |
| Auth               | Email/password → token stored in `storage.sync`                                                                      | Sanctum **personal access token** in `storage.local` (not synced), `Authorization: Bearer`                                                    | dlmnt-be sessions don't work from an extension origin; tokens are revocable           |
| UI                 | `innerHTML` string templates, vendor CSS/fonts                                                                       | Vue SFCs, `<script setup lang="ts">`, `<style scoped lang="less">`, no UI library                                                             | Consistent with dlmnt-fe; no ported styles                                            |
| Extractor coupling | Hard-wired                                                                                                           | `Extractor` interface; Readability is the default, Defuddle can be swapped in later                                                           | Room to evaluate Defuddle (Markdown-native, richer metadata)                          |

**Alternatives considered:** CRXJS 3 (`@crxjs/vite-plugin`) — thinner but Chromium-first; we'd
hand-roll Firefox manifest differences that WXT handles. Defuddle 0.19 as primary — pre-1.0;
kept as a pluggable option.

### Flow

```
popup (Vue)  ──msg "clip:preview"──▶  background  ──scripting.executeScript──▶  extractor (page)
     ▲                                     │   ◀──────────── ExtractedPage ────────────┘
     └────────── preview / status ─────────┤
popup  ──msg "clip:save"──▶ background ──POST /v3/clips (Bearer)──▶ dlmnt-be
```

Firefox treats MV3 `host_permissions` as user-revocable, so the background checks
`permissions.contains` for the API origin before calling it and the popup asks for it with
`permissions.request` if needed. CORS on the backend (see contract notes) is the fallback.

The background keeps the last `ExtractedPage` per tab in memory between preview and save; if
it was evicted (service worker restarted), save re-extracts.

### Data shapes

```ts
type ExtractionMethod = 'selection' | 'readability' | 'fallback'

interface ExtractedPage {
  url: string
  title: string
  byline: string | null
  siteName: string | null
  lang: string | null
  publishedTime: string | null // ISO 8601 when the page exposes it
  excerpt: string | null
  html: string // DOMPurify-sanitized, absolute URLs, no scripts/styles/handlers
  text: string // plain text, whitespace-normalized
  markdown: string // Turndown over `html`
  wordCount: number
  method: ExtractionMethod
  readerable: boolean // isProbablyReaderable() result, informational
}
```

### `clips-api` contract (provider: dlmnt-be)

All paths relative to `API_URL` (`…/v3`). Errors follow dlmnt-be's existing shape
(`{ success: false, message, errors? }`).

```
POST   /extension/token      body { email, password, device_name }       throttle 6/min
       200 { success: true, data: { token: string, expiresAt: string, user: { id, name, email } } }
       422 invalid credentials
DELETE /extension/token      Bearer — revokes the current token
       200 { success: true }
GET    /me                   Bearer — existing endpoint, must accept tokens
POST   /clips                Bearer — body ExtractedPage + { clippedAt: ISO string }
       201 { success: true, data: { id: string, createdAt: string } }
       401 missing/revoked token  → extension clears token, shows sign-in
       413 body > 5 MB            → "This page is too large to save"
       422 validation             → shows message
       429 throttled              → "Too many saves, try again shortly"
```

Backend notes for `SPEC-clips-api.md` (not built here):

- `HasApiTokens` on `User`; `laravel-mongodb` 5 ships no Sanctum token model, so add
  `App\Models\PersonalAccessToken` (extends Sanctum's, `DocumentModel` trait, `mongodb`
  connection, `personal_access_tokens` collection) and register it with
  `Sanctum::usePersonalAccessTokenModel()`.
- Tokens: name = `device_name` (e.g. `dlmnt-clipper/chrome`), ability `clips:create`,
  expiration **24 h** (`sanctum.expiration` or per-token `expiresAt`); revoked on sign-out.
- Request body limit **5 MB** for `POST /clips` (PHP `post_max_size` and web server limits
  must allow it).
- `Clip` model, `clips` collection, owned by the user (`user_id`), indexed on
  `user_id` + `created_at`. Server re-sanitizes `html` (never trust the client).
- CORS for `/v3/clips`, `/v3/extension/token` from extension origins (`chrome-extension://*`,
  `moz-extension://*`); no credentials/cookies needed.

## Tech Stack

- Node `>=24.12.0`, npm `11.x` (same as dlmnt-fe)
- TypeScript `~6.0`, Vue `^3.5`, Less `^4`, WXT `^0.21` + `@wxt-dev/module-vue`
- `@mozilla/readability` `^0.6.0`, `dompurify` `^3.4`, `turndown` `^7.2`
- Vitest + jsdom, `@vue/test-utils`, WXT `fakeBrowser` for extension-API tests
- oxlint + ESLint (flat config, `eslint-plugin-vue`, `@vue/eslint-config-typescript`), Prettier
  `3.9.6` — rules mirror `dlmnt-fe/packages/eslint-config` (copied, not depended on)
- `web-ext` (WXT's browser runner; also lints the Firefox build)
- Targets: Chrome (stable), Edge (stable), Firefox ≥ 142 (MV3; first version supporting
  `data_collection_permissions`). Safari out of scope.

## Commands

```
Install:        npm install
Dev:            npm run dev                 # Chrome, local env, HMR for popup
Dev Firefox:    npm run dev:firefox
Build:          npm run build -- -b <chrome|edge|firefox> [--mode stage|production]  # default local
Build all:      npm run build:all           # 3 browsers × local → .output/<browser>-mv3-dev
Zip:            npm run zip -- -b <browser> [--mode …]          # firefox also emits sources zip
Type-check:     npm run check-types         # vue-tsc --noEmit
Lint:           npm run lint                # oxlint . && eslint . --cache
Lint fix:       npm run lint:fix
Lint Firefox:   npm run lint:firefox        # web-ext lint on the Firefox build
Format:         npm run format              # prettier --write .
Test:           npm test                    # vitest run
Test watch:     npm run test:watch
```

Environments — one build per environment, no runtime switching:

```
.env.development  WXT_API_URL=https://dlmnt.test/v3   (local; default for dev and build)
.env.stage        added manually later (same keys)    → --mode stage
.env.production   added manually later (same keys)    → --mode production
.env.example      committed; the others are git-ignored
```

`WXT_API_URL` is the only place an API origin is defined; `host_permissions` is derived from it
in `wxt.config.ts` at build time. Non-production builds append the env to the extension name
(`dlmnt-clipper (local)`, `dlmnt-clipper (stage)`) so they can be installed side by side.

The local env uses Vite's `development` mode, not a file named `.env.local`: Vite and WXT
load `.env.local` in **every** mode as an override, so it would leak the local API URL into
stage and production builds.

## Project Structure

```
wxt.config.ts                  → manifest per browser, env → host_permissions, gecko id, Vue module
src/
  entrypoints/
    background.ts              → message router, injection, API calls
    popup/                     → index.html, main.ts, App.vue
    extract.ts                 → unlisted script injected on demand; returns ExtractedPage
  components/                  → SignInForm, ClipPreview, ClipStatus
  styles/                      → variables.less, base.less (new, minimal; nothing ported)
  lib/
    extract/                   → Extractor interface, readability.ts, selection.ts, fallback.ts,
                                 sanitize.ts (DOMPurify), toMarkdown.ts (Turndown), normalize.ts
    api/                       → client.ts (fetch, Bearer, error mapping), clips.ts, auth.ts
    messages.ts                → typed popup⇄background message definitions
    storage.ts                 → typed wrappers over storage.local (token, user)
  types/                       → shared types (ExtractedPage, ApiError, …)
public/icons/                  → placeholder dlmnt-clipper icons (16/32/48/128)
tests/
  fixtures/pages/              → saved HTML pages (article, non-readerable, selection, hostile)
  unit/                        → lib/* tests
  components/                  → popup component tests
SPEC.md, tasks/plan.md, tasks/todo.md
```

## Code Style

Mirrors dlmnt-fe: Prettier `semi: false`, `singleQuote: true`, `printWidth: 100`; 2-space
indent; `<script setup lang="ts">`; `<style scoped lang="less">`; named exports; arrow
functions for helpers; comments explain _why_, not _what_. Use the `browser` global from WXT
(not `chrome.*`) so the same code runs on Firefox.

```ts
import { Readability, isProbablyReaderable } from '@mozilla/readability'
import { sanitize } from './sanitize'
import type { Extractor } from './types'

// Readability mutates the document it parses, so it always gets a clone.
export const readabilityExtractor: Extractor = {
  method: 'readability',
  extract: (doc) => {
    const readerable = isProbablyReaderable(doc)
    const article = new Readability(doc.cloneNode(true) as Document).parse()
    if (!article?.content) return null

    return { html: sanitize(article.content), readerable, meta: pickMeta(article) }
  },
}
```

Naming: `camelCase` functions/vars, `PascalCase` components/types, `kebab-case` message ids
(`clip:preview`), no `any` (use `unknown` + narrowing), `noUncheckedIndexedAccess: true`.
Less: variables in `styles/variables.less`, component styles scoped, no global resets beyond
`base.less`.

## Testing Strategy

- **Unit (Vitest + jsdom)** — the core: every extractor against `tests/fixtures/pages/*.html`;
  fallback-chain ordering; sanitize strips `<script>`, `<style>`, `on*` attributes,
  `javascript:` URLs, and resolves relative URLs; Markdown conversion; text normalization; API
  client error mapping (401/413/422/429/network).
- **Background (Vitest + WXT `fakeBrowser`)** — message routing, token storage, 401 →
  signed-out, re-extract when cached page is missing, non-injectable tab handling.
- **Component (Vue Test Utils)** — popup states: signed-out, extracting, preview, saving,
  saved, error.
- **Manual smoke checklist** per release, run on Chrome, Edge and Firefox: long article, news
  site with overlay, docs page, SPA, PDF tab, `chrome://` / `about:` page, selection-only,
  popup closed mid-save.
- **E2E (Playwright with unpacked extension)** — not in v1; ask first.
- Coverage target: ≥ 90% lines on `src/lib/**`; components/background no hard number.

## Boundaries

- **Always:** run `check-types`, `lint`, `test` before every commit; keep permissions minimal;
  sanitize before anything leaves the page context; read API origin only from `WXT_API_URL`;
  use `browser.*` APIs; update this spec when a decision changes.
- **Ask first:** adding a runtime dependency; adding any permission or host permission; any
  change in `dlmnt-be` beyond the agreed `clips-api` contract; adding analytics/telemetry;
  adding E2E/CI; supporting Safari.
- **Never:** port anything from slice-extension other than the extraction approach — no images,
  icons, fonts, CSS, Mixpanel, manifest `key`, API URLs, app URLs, host lists, or paths; use a
  UI library (Tailwind, ant-design-vue, `@dlmnt/ui-kit`, …); commit `.env.*` (except
  `.env.example`), tokens or credentials; render unsanitized HTML (`innerHTML`/`v-html`);
  inject scripts into pages without a user action; use `eval`/remote code; store the token in
  `storage.sync`.

## Success Criteria

1. `npm run build:all` produces Chrome, Edge and Firefox MV3 builds that load (Chrome/Edge
   "Load unpacked", Firefox `about:debugging`) with **zero** manifest errors or warnings.
2. Manifest permissions are exactly `activeTab`, `scripting`, `storage`; `host_permissions`
   contains only the `WXT_API_URL` origin; no `content_scripts`; Firefox build has a
   `browser_specific_settings.gecko.id` of `clipper@dlmnt` and declares its
   `data_collection_permissions`; `npm run lint:firefox` reports 0 errors.
3. On an article fixture, extracted `text` contains the article body and excludes the nav,
   footer and comment blocks defined in the fixture; `method === 'readability'`.
4. With a text selection, only the selection is extracted; `method === 'selection'`.
5. On a non-readerable page, extraction still returns non-empty text with
   `method === 'fallback'`, and the preview labels it as such.
6. On non-injectable pages (`chrome://`, `about:`, Web Store/AMO, PDF viewer) the popup shows
   "This page can't be clipped" with no uncaught errors in the background console.
7. `html` contains no `<script>`, `<style>`, `on*` attributes or `javascript:` URLs, and all
   `href`/`src` are absolute (unit-tested against a hostile fixture).
8. Sign-in stores the token and `expiresAt` in `storage.local`; an expired token is treated as
   signed-out without a network call; sign-out calls `DELETE /extension/token` and
   clears it. A signed-in save returns 201 and shows "Saved"; closing the popup mid-save still
   completes the request; 401 clears the token and shows sign-in; 413 (> 5 MB)/422/429/network
   each show a distinct message with Retry.
9. `grep -riE "slice|mixpanel|herokuapp" src public wxt.config.ts` returns nothing.
10. `check-types`, `lint`, `test` pass; `src/lib/**` line coverage ≥ 90%.
11. Smoke checklist passes on Chrome, Edge and Firefox against local dlmnt-be (stage/production
    builds are out of v1 scope).

## Decisions log

| #   | Decision                                                                                                                    | Date       |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Save to dlmnt-be API (not local storage)                                                                                    | 2026-10-20 |
| 2   | Standalone repo, conventions mirrored from dlmnt-fe                                                                         | 2026-10-20 |
| 3   | Readability as primary extractor, behind an `Extractor` interface                                                           | 2026-10-20 |
| 4   | Auth via Sanctum personal access tokens                                                                                     | 2026-10-20 |
| 5   | Clips belong to the user                                                                                                    | 2026-10-20 |
| 6   | Store sanitized HTML + text + Markdown + metadata                                                                           | 2026-10-20 |
| 7   | v1 is save-only                                                                                                             | 2026-10-20 |
| 8   | Environments: local, stage, production (build-time)                                                                         | 2026-10-20 |
| 9   | Name `dlmnt-clipper`; placeholder icons                                                                                     | 2026-10-20 |
| 10  | Targets Chrome, Edge, Firefox                                                                                               | 2026-10-20 |
| 11  | Plain Less, no UI libraries                                                                                                 | 2026-10-20 |
| 12  | v1 configures local env only; stage/production `.env` added manually                                                        | 2026-10-20 |
| 13  | Firefox add-on id `clipper@dlmnt`                                                                                           | 2026-10-20 |
| 14  | Token expiry 24 h                                                                                                           | 2026-10-20 |
| 15  | Max clip request body 5 MB                                                                                                  | 2026-10-20 |
| 16  | Local env file is `.env.development` (`.env.local` leaks into all modes)                                                    | 2026-10-20 |
| 17  | Firefox ≥ 142; data collection: websiteContent, browsingActivity, authenticationInfo, personallyIdentifyingInfo             | 2026-10-20 |
| 18  | `isProbablyReaderable` picks the extractor: Readability on readerable pages, full page text otherwise (never blocks a clip) | 2026-10-20 |

## Open Questions

None.
