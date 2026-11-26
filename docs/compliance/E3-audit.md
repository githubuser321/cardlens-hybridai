# CardLens E3 compliance audit

> **Draft prepared by an AI assistant, not a lawyer – review before use.** Prepared 15 November 2026 for the Firebase #BuildHybridAI submission (30 November 2026). The privacy policy, terms, and accessibility statement in the app carry the same note.

Owner decision: stay on **Firebase Spark** and the **Gemini Developer API free tier**. Variant B is the published Gemini wording. A1 (Blaze) is not implemented.

## What is sent to the cloud

Nothing is sent until Firebase env vars are present, App Check can be initialized, the browser is online, the region gate below allows cloud, and the user agrees. `/web` has no cloud-only inference mode. `selectInferenceMode` in `web/src/compliance/inference-mode.ts` returns on-device-only unless consent, an allowed region, and `cloud_fallback_enabled` are all true. In that one case the call is `InferenceMode.PREFER_ON_DEVICE`: the SDK tries the device first and may fall back to the cloud with the prompt already built. Otherwise the call is `InferenceMode.ONLY_ON_DEVICE`, and a failure uses keyword rules. A thrown hybrid call is not retried, and it is not retried with the original statement. The response `inferenceSource` is recorded as on-device, cloud, or rules, and the result chip follows that.

Safety settings on every cloud model are `BLOCK_LOW_AND_ABOVE` for harassment, hate speech, sexually explicit content, and dangerous content. Thresholds that allow every prompt are not set.

### 1. Categorization — `web/src/analyze/firebase-model.ts`

When: on-device `generateContent` throws (model missing or failed), the gate allows cloud, and the user chooses **Send redacted text** (or already did so in this tab).

Call: `categorization.generateContent(prompt: string)` on the `PREFER_ON_DEVICE` model. If this tab has not consented yet, an `ONLY_ON_DEVICE` attempt runs first. The hybrid call happens only after **Send redacted text**, and it receives this same string. The SDK may answer on-device or in the cloud; `inferenceSource` is stored either way.

`prompt` is `buildRedactedMerchantPrompt` in `web/src/analyze/categorize.ts`:

```text
Assign each merchant one category from the response schema enum.
Categories: <category enum>.
Return a JSON object {"categorizations":[{"merchant":"...","category":"..."}]} with one item per merchant, same order.
Merchants:
1. <redacted merchant>
```

The merchant strings have already passed `prepareCloudMerchantPayload`. Amounts, dates, and raw lines are not in this prompt. The same string is what the on-device attempt received. The response schema is the categorization JSON schema. No image.

### 2. Insights — `web/src/analyze/firebase-insights.ts`

When: same gate and the same text consent as categorization (one "yes" covers later text calls in the tab until **Turn off cloud for this session** or **Never use cloud**). A later call in that tab starts on `PREFER_ON_DEVICE` and does not use the on-device-only model.

Call: `redactedAggregates.generateContent(prompt: string)` on `PREFER_ON_DEVICE` after consent. The prompt is unchanged from the redacted aggregate below.

`prompt` is `buildInsightsPrompt` around `redactInsightsAggregate`. The JSON is:

```text
{
  transactionCount,
  categoryTotals, monthTotals, currencyTotals,
  subscriptions: [{ merchant, cadence, currency, occurrences, monthlyCost }],
  anomalyCounts
}
```

Merchant names inside that JSON are redacted. There are no raw transaction lines. The instructions tell the model to use only that JSON.

### 3. Scanned image — `web/src/scan/firebase-scan.ts`

When: on-device vision throws, the gate allows cloud, and the user checks **I understand and want to send this image.** and presses **Send image**. The checkbox starts unchecked. Text consent does not count. The next image asks again. After that yes, the same image goes to one `PREFER_ON_DEVICE` call.

Call: `scan.generateContent(parts)` where `parts` is:

```text
[
  { type: "text", text: "<buildScanPrompt()>" },
  { type: "inlineData", inlineData: { mimeType, data: "<base64 image>" } }
]
```

The image is not redacted. The prompt asks the model not to copy card numbers, IDs, phones, emails, or the address into the returned lines. That is not a redaction of the upload.

### 4. Calls that do not send statement content

| Call | When | Body |
| --- | --- | --- |
| `prepareOnDeviceModel` | User clicks **Download on-device model** and Firebase env is set | No statement. Does not initialize App Check or reCAPTCHA. |
| `runHybridDemo` | **Run hybrid demo** | The four sample merchant names only, `ONLY_ON_DEVICE`. A cloud `inferenceSource` is discarded and not followed by another call. |
| Extraction model | Never. `generateContent` is not called. | The object exists so the shared transaction schema stays wired. It is not a live call site. |
| Remote Config `fetchAndActivate` | Page load, when Firebase env is set | Installation ID and the parameter names below. No statement text is written into a parameter. Personalization is not enabled in code. |
| App Check / reCAPTCHA | First time the user chooses a cloud call | Device signals and the reCAPTCHA exchange. No statement. The enterprise script URL is rewritten to `https://www.recaptcha.net/recaptcha/enterprise.js`. |
| Firebase Hosting | Browser loads the static app | IP, URL, time, user-agent, handled by Google. Statement bytes are not a Hosting upload. |

There is no `console.log` / `debug` / `info` / `warn` / `error` in `web/src` (the demo-fixture script logs output file paths only). Categorization and insights drop an error string that contains the prompt or is longer than 300 characters, so a SDK error cannot become a copy of the statement in the on-screen log. The session log is in memory only.

## What is stored locally

CardLens does not persist raw statements or images. Results live in page memory until refresh. `Clear my data` deletes every `localStorage` and `sessionStorage` key on the origin, every IndexedDB database the browser lists plus the known Firebase names, every Cache Storage entry, expires first-party cookies, calls `deleteInstallations()` when Firebase is configured (before IndexedDB is deleted), unregisters service workers, and re-registers `/sw.js` in production.

The `_GRECAPTCHA` cookie is set on Google's or recaptcha.net's domain after a cloud choice. This button cannot delete it.

| Name | Where | Purpose |
| --- | --- | --- |
| `cardlens.device-onboarding.v1` | localStorage | Onboarding dismiss flag and last device availability. No statement text. |
| `cardlens.consent.v1` | localStorage | Preference `ask` or `never`, and records `{ kind, decision, at, textVersion, locale }`. Text version is `2026-11-15-free-b`. No statement text. |
| `cardlens.first-run.v1` | localStorage | First-run acknowledgement, time, and text version `2026-11-15`. |
| `cardlens.locale.v1` | localStorage | `en` or `he`. |
| `cardlens.cloud-session.v1` | sessionStorage | `unset`, `granted`, or `off` for text cloud in this tab. Image consent is not stored here. |
| `firebase-installations-database` | IndexedDB | Firebase installation ID (`firebase-installations-store`). |
| `firebase-app-check-database` | IndexedDB | App Check token cache. Created only after a cloud choice. Token ≤ 7 days. |
| `firebase_remote_config` | IndexedDB | Cached template. |
| `firebase-heartbeat-database` | IndexedDB | SDK heartbeat (`firebase-heartbeat-store`). |
| `cardlens-shell-v4` | Cache Storage | App shell. The HTML document is network-first and bypasses the HTTP cache; other shell assets stay network-first. Older `cardlens-shell-*` caches are deleted on activate. |
| `_GRECAPTCHA` | cookie, third-party | reCAPTCHA risk analysis. Commonly up to about 6 months. Not a first-party cookie. |

`/privacy` section 11 is rendered from `STORAGE_INVENTORY` in `web/src/compliance/storage-inventory.ts`.

## Analytics

No Analytics, Performance Monitoring, Crashlytics, or gtag. `web/package.json` dependencies are `firebase` and `pdfjs-dist`. `web/src/bundle-guard.test.ts` builds the production bundle and checks it. `@firebase/app` contains sibling package-name constants such as `@firebase/analytics`; the test ignores that `@` prefix and fails on `firebase/analytics`, `getAnalytics(`, `getPerformance(`, `gtag(`, and `googletagmanager`. No consent banner is added, because no analytics SDK is loaded (E2).

## Region gate (`cloud_fallback_enabled`)

Chosen behavior, implemented in `web/src/compliance/cloud-gate.ts` and `region.ts`:

1. If any `navigator.languages` region subtag, or `Intl` timezone, is in the EEA / UK / Switzerland lists, cloud text and cloud image are **off**. A fetched Remote Config value of `true` does not override this. That covers the time before the console condition exists. It false-positives on `en-GB` or `Europe/London` outside those places.
2. If the fetch succeeded and the value is not exactly true (`false`, empty, or unrecognized), cloud is **off** for everyone. That is the kill switch.
3. If the fetch failed and a restricted signal is present, cloud is **off** (fail closed).
4. If the fetch failed and there is no language region and no timezone, cloud is **off** (fail closed).
5. If the fetch failed and the signals are present and not restricted, the parameter is treated as open. Consent, App Check, and being online are still required. A person physically in Germany with `en-US` and `America/New_York`, whose fetch fails, is **not** blocked by the client.
6. The in-app Remote Config default is the string `true`, so a successful fetch before the parameter exists looks like `true`. Rule 1 still blocks a restricted browser.

Client-side only. A VPN does not change locale or timezone. IP geolocation happens only if Dash Buddies Games publishes a Remote Config country condition. Fetch interval is 5 minutes, so a published `false` can take that long to arrive; a restricted browser is already off without it.

### Console steps only Dash Buddies Games can do

1. Firebase console → Remote Config → parameter `cloud_fallback_enabled` (Boolean), default `true`.
2. Condition: country/region in the EEA, the United Kingdom, and Switzerland. Value for that condition: `false`. Publish the template.
3. Do not enable Remote Config personalization. Do not store secrets or personal data in parameters.
4. App Check → enforce Firebase AI Logic. Create a reCAPTCHA Enterprise **site** key. Set `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` only in the deploy environment. Do not commit the secret.
5. Restrict the web API key (HTTP referrers: production origin and localhost; API restrictions: the Firebase APIs this client uses).
6. The legal pages name the publisher as Dash Buddies Games. Privacy, accessibility, and general contact use dashbuddies.games@gmail.com. No postal address is published.
7. Confirm the project is still Spark (no Blaze billing link), unless the decision changes. If it changes, publish privacy Variant A and remove the free-tier sentences.
8. Deploy is manual (`npm run deploy` from `web/`). This change does not deploy.
9. Do not make the GitHub repository public from this work. H1 below found no secrets; flipping visibility is still a step for Dash Buddies Games, after the scan looks satisfactory.

## gitleaks

- Tool: gitleaks 8.30.1
- Command: `gitleaks detect --log-opts="--all" --redact`
- History: `git rev-parse --is-shallow-repository` was `false` (16 commits scanned, about 1.31 MB). No unshallow was required.
- Result: **no leaks found** (0 findings).

No secret values are recorded here. Repository settings were not changed.

## Requirement table

| ID | Status | Notes |
| --- | --- | --- |
| A1 Blaze | Not done | Owner decision: stay on Spark. |
| A2 EEA/UK/CH off, Variant B warning | Partial | Client gate is in. Country condition is **Needs Dash Buddies Games**. |
| A3 No cloud without consent; no unredacted retry; no statement logs | Done | `ONLY_ON_DEVICE` without consent. `PREFER_ON_DEVICE` only when consent, region, and `cloud_fallback_enabled` all allow it. Same redacted payload. No `console.*` in `web/src`. |
| A4 Redaction tests and placeholders | Done | Spaced PANs, masked partials, ID, IBAN, phone, email, header name, header address. Placeholders such as `[REDACTED_NAME]` show in the preview. Names are not a general detector. |
| A5 App Check, no debug token in prod | Partial | Lazy App Check and a production-bundle guard are in. Enforcement in the console is **Needs Dash Buddies Games**. |
| A6 Conservative safety settings | Done | `BLOCK_LOW_AND_ABOVE`. No allow-all threshold. |
| B1 Text dialog, Variant B | Done | Exact English title, body (paid "does not train" sentence omitted because it would be false; free-tier sentence included), equal buttons, default focus **Keep it on my device**. |
| B2 Image dialog | Done | Checkbox starts unchecked. **Send image** disabled until checked. Not the old persistent checkbox. |
| B3 Hebrew dialogs | Done | `עברית` toggle. English remains. |
| B4 Stored consent, withdraw | Done | Timestamp, text version `2026-11-15-free-b`, Settings **Always ask** / **Never use cloud**, session off switch. |
| B5 Result label and chip | Done | `AI-generated – may contain mistakes. Not financial advice.` plus **Analyzed on your device** or **Analyzed in the cloud (redacted)**. Hebrew line added when the UI is Hebrew. |
| C1 `/privacy` `/terms` `/accessibility` | Done | English and Hebrew. Draft note kept. Variant B only. |
| C2 Footer on every screen | Done | Including the legal routes, which share `index.html`. |
| C3 First-run notice | Done | Non-blocking. Dismissed once in `cardlens.first-run.v1`. |
| C4 mailto contact | Done | Privacy, accessibility, the footer, and general contact use `dashbuddies.games@gmail.com`. |
| D1 reCAPTCHA disclosure | Done | Badge `visibility: hidden`. Sentence in the footer and under the dialog buttons. Link is `/privacy#security`. No Google privacy/terms links on that sentence. |
| D2 recaptcha.net, lazy App Check, CSP | Done | Script URL rewrite plus preload. App Check runs on the first cloud choice. CSP in `firebase.json` and injected into the production `index.html`. `npm run dev` does not send the CSP (Vite). |
| E1 No analytics banner needed | Done | Confirmed by the bundle test. |
| E2 Analytics opt-in banner | Not done | Not added, on purpose. |
| E3 Storage inventory | Done | This file and privacy §11. |
| E4 Clear my data | Done | Includes `deleteInstallations()`. |
| E5 No raw statement persistence | Done | No default history and therefore no expiry window. |
| F1 No secrets or personalization in Remote Config | Done | Code only reads three flags. Do not enable personalization in the console (**Needs Dash Buddies Games** to leave it off). |
| F2 `cloud_fallback_enabled` | Partial | Client done. Console condition **Needs Dash Buddies Games**. |
| G1 Accessibility link on every page | Done | Footer. |
| G2 Automated a11y plus manual checklist | Partial | Focus trap, `aria-modal`, Escape = refuse, chart tables, contrast tests, `lang`/`dir`. Manual list: `docs/compliance/accessibility-checklist.md`. |
| G3 Android accessibility | Not done | P2. `/android` was not modified. |
| H1 Full-history secret scan | Done | gitleaks 8.30.1, 0 findings. |
| H2 Gitignore for secrets | Done | Root `.gitignore` ignores service-account JSON, `google-services.json` (keeps the Android example), debug-token filenames, pem/p12/jks. `.env*` was already ignored. |
| H3 Restrict the web API key | Needs Dash Buddies Games | Console only. |
| H4 No real statements or personal contacts | Done | Demo fixtures stay fictional. Public contact is `dashbuddies.games@gmail.com`. No postal address is published. |
| H5 LICENSE, notices, README, pre-existing code | Done | `LICENSE` was already Apache-2.0. `NOTICE` added. README privacy section updated. The About box on GitHub updates when the repo is public, which this work does not do. |
| H6 Judge instructions | Partial | README "Judges" section: no login, sample statement, English, free through 16 December 2026. Public URL **Needs Dash Buddies Games** (deploy). |
| I1–I4 Android store forms | Not done | P2. Out of scope. |

## What remains

- Dash Buddies Games: Remote Config country condition, App Check enforcement, reCAPTCHA site key in the deploy env (not in git), API key restrictions, lawyer review of the drafts, deploy, and any decision to make the repo public.
- A person: the manual accessibility checklist (NVDA/TalkBack, 200% zoom, RTL visual pass).
- If the project moves to Blaze, replace Variant B in the policy and the dialogs and remove the region block.
- Android still uses `PREFER_ON_DEVICE` and an automatic `ONLY_IN_CLOUD` retry. That was left unchanged.
