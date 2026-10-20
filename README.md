# dlmnt-clipper

Browser extension (Chrome, Edge, Firefox) that extracts the readable text of the current page
and saves it to dlmnt for the signed-in user.

Built with [WXT](https://wxt.dev) + Vue 3 + TypeScript + Less, Manifest V3 for every browser.
Extraction uses [Mozilla Readability](https://github.com/mozilla/readability), falling back to
the current selection or the page's text, and the output is sanitized with DOMPurify before it
leaves the page.

## Requirements

- Node `>=24.12.0`, npm 11
- Chrome / Edge (stable) and/or Firefox `>=142`
- A running [`dlmnt-be`](../dlmnt-be) for sign-in and saving (local: `https://dlmnt.test`)

## Setup

```sh
npm install
cp .env.example .env.development   # local environment
```

`.env.development` points the extension at the local backend:

```dotenv
WXT_API_URL=https://dlmnt.test/v3
```

## Commands

| Command                             | What it does                                                    |
| ----------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                       | Opens Chrome with the extension loaded; the popup hot-reloads   |
| `npm run dev:firefox`               | Same for Firefox                                                |
| `npm run build -- -b <browser>`     | Type-checks and builds for `chrome`, `edge` or `firefox`        |
| `npm run build:all`                 | Builds all three browsers                                       |
| `npm run zip -- -b <browser>`       | Zips a build for store upload (Firefox also gets a sources zip) |
| `npm run check-types`               | Type-checks with `vue-tsc`                                      |
| `npm run lint` / `npm run lint:fix` | oxlint + ESLint                                                 |
| `npm run lint:firefox`              | `web-ext lint` on the Firefox build (run a Firefox build first) |
| `npm run format` / `format:check`   | Prettier                                                        |
| `npm test` / `npm run test:watch`   | Vitest                                                          |

Builds land in `.output/<browser>-mv3-dev/` (local) or `.output/<browser>-mv3-<mode>/`.

## Using it

1. Open the popup on any page and sign in with your dlmnt account. On Firefox you may be asked
   to let the extension access the dlmnt site.
2. The popup previews what will be saved: the article (**Article**), your highlighted text
   (**Selection**) or the page's visible text (**Full page text**).
3. Click **Save**. The save runs in the background, so closing the popup doesn't cancel it.

You stay signed in for 24 hours. _Sign out_ revokes the token on the server.

## Loading the extension manually

- **Chrome:** `chrome://extensions` → enable _Developer mode_ → _Load unpacked_ →
  `.output/chrome-mv3-dev`
- **Edge:** `edge://extensions` → enable _Developer mode_ → _Load unpacked_ →
  `.output/edge-mv3-dev`
- **Firefox:** `about:debugging#/runtime/this-firefox` → _Load Temporary Add-on…_ → pick
  `.output/firefox-mv3-dev/manifest.json`

Non-production builds are named `dlmnt-clipper (<env>)` so they can sit next to each other.

### Firefox and the local HTTPS certificate

Herd's local certificate for `dlmnt.test` is trusted by the macOS keychain, which Chrome and
Edge use. Firefox has its own certificate store. If requests to `https://dlmnt.test` fail in
Firefox, either set `security.enterprise_roots.enabled` to `true` in `about:config`, or import
Herd's CA certificate under _Settings → Privacy & Security → Certificates → View Certificates
→ Authorities_.

Firefox also lets users revoke an extension's host permission. If saving fails with a
permission error, open the popup again and allow access to the dlmnt site when asked.

## Environments

There's one build per environment, and the API URL is baked in at build time.

| Environment | Env file           | Build                                          |
| ----------- | ------------------ | ---------------------------------------------- |
| local       | `.env.development` | `npm run build -- -b chrome` (default)         |
| stage       | `.env.stage`       | `npm run build -- -b chrome --mode stage`      |
| production  | `.env.production`  | `npm run build -- -b chrome --mode production` |

Only local is set up for now. To add stage or production, copy `.env.example` to
`.env.stage` / `.env.production` and set `WXT_API_URL`. `wxt.config.ts` derives the
extension's only host permission from that URL, and the build fails if it's missing.

Don't use a file named `.env.local`: Vite/WXT load it in **every** mode, so it would override
stage and production builds.

All `.env.*` files except `.env.example` are git-ignored.

## Project layout

```
wxt.config.ts            WXT config; manifest comes from src/manifest.ts
src/
  manifest.ts            manifest builder (permissions, host permission, Firefox settings)
  entrypoints/           popup, background, injected extractor
  components/            popup UI components
  lib/                   extraction, API client, storage, typed messages
  styles/                Less variables and base styles
public/icons/            placeholder icons
tests/                   Vitest unit and component tests, HTML fixtures
```

## Releasing

Run `npm run check`, `npm run build:all` and `npm run lint:firefox`, then try the extension by
hand on all three browsers.

## Permissions

| Permission                  | Why                                                    |
| --------------------------- | ------------------------------------------------------ |
| `activeTab`                 | Read the current tab only when you click the extension |
| `scripting`                 | Inject the extractor into that tab on demand           |
| `storage`                   | Keep the sign-in token (local only, never synced)      |
| host permission for the API | Call the dlmnt API (derived from `WXT_API_URL`)        |

There are no content scripts: nothing runs on a page until you open the popup on it.

## Known lint notices

`npm run lint:firefox` reports `UNSAFE_VAR_ASSIGNMENT` (innerHTML) warnings in two bundles.
Neither comes from this project's code:

- `chunks/popup-*.js`: Vue's runtime inserts static template content with `innerHTML`.
- `extract.js`: Mozilla Readability, DOMPurify and Turndown use `innerHTML` internally, on
  detached copies of the content (that is how DOMPurify parses what it sanitizes).

Extracted content is sanitized before it leaves the page and is never rendered as HTML in the
popup.
