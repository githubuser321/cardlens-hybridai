# CardLens testing

Each check runs in exactly one place. Local runs by change type are in `AGENTS.md`. This file covers CI and E2E.

| Layer | Covers | Runs in |
| --- | --- | --- |
| Unit / component (vitest, jsdom, axe-core) | Parser, redaction, categorization. Consent, privacy and compliance: consent store, region gate, `selectInferenceMode`, `CONSENT_TEXT_VERSION`, dialogs. Hebrew guard for `web/`. Hosting config. Empty `.env.example`. Contrast. | `web.yml` |
| Lint, typecheck, build | ESLint, `tsc --noEmit`, `vite build` | `web.yml` |
| Policy scan (planned) | Hebrew outside `web/`. Secret patterns in the diff. Protected paths touched. Runs on PR code with **no secrets**. | `policy.yml` |
| Blocked terms (planned) | Diff vs. a private term list. Runs from `main` in a trusted job that never checks out or executes PR code. | `policy-trusted.yml` |
| Browser E2E (planned) | Desktop 1280×800 and mobile 412×915 against the preview | `e2e.yml` |
| Android | Gradle build, lint, unit tests | `android.yml` |

## Required checks

Required checks must not block PRs that skip their paths. Each workflow runs on every PR. A first `changes` step detects relevant paths, and the job reports success as a no-op when nothing relevant changed. No workflow-level `paths:` filters on required checks.

## Test data

- Fictional only:
  - the demo files in `web/public/demo/*` (`npm run demo-fixtures`);
  - `web/src/parse/sample-statement.ts`;
  - inline test fixtures.
- Hebrew fixtures only in the files listed in `web/src/i18n/hebrew-guard.test.ts`.

## E2E

The owner's rule: before any merge request or live deploy, E2E runs in a real browser at desktop and ~412px on a preview, and the results go into the request.

**Traceability.** Every run records three things:
- the PR number;
- the commit SHA;
- the Firebase Hosting `VERSION_ID`.

The build writes `/version.json` with the commit SHA and PR. The run fails if the served SHA differs from the SHA it was asked to test, which catches a preview overwritten mid-test. The `VERSION_ID` comes from the deploy output and is passed in as an input. The summary table and screenshot names include all three.

**One preview at a time.** The API key referrer list allows only `pr13` and live, so there is one shared preview channel. Only one PR may hold `pr13` at a time:
- The deploy-and-test sequence is serialized: the `e2e.yml` concurrency group is `preview-pr13` and `cancel-in-progress` is false.
- The owner deploys the next PR only after the previous run finishes.
- Per-PR channels would need a referrer entry for each.

**Scenario** (fresh context, no cloud send; the run fails if a request reaches the Firebase AI Logic endpoint):
1. The landing page renders with `lang="en"` and no console errors.
2. **Try demo statement** opens "Before you start". The box is unchecked, and Agree stays disabled until it is checked.
3. After Agree, the app goes to Results with no cloud dialog. The total is in USD, and the badge shows basic sorting.
4. The badge opens "Why basic sorting?" by click and by keyboard. Esc closes it.
5. **Improve with Cloud AI** opens the consent dialog. The test chooses **Keep it on my device**, and nothing is sent.
6. Settings shows the cloud choice, and **Clear my data** completes.
7. Mobile only: one tap on the Watch it sort pill opens the terms dialog, and the bottom tabs work.

Artifacts: screenshots plus the HTML report, kept for 7 days.

## Known limits

- On-device Gemini Nano can't run in CI.
- The 412px run is Chromium emulation; a quick check on a real phone is still worth doing.
