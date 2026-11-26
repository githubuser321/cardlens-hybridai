# AGENTS.md — CardLens

This file is the single home of the standing rules. Other docs, templates and Issues reference it and do not repeat it.

## What CardLens is

A credit-card statement analyzer for the Firebase #BuildHybridAI 2026 hackathon. A statement is parsed, redacted and categorized in the browser. Firebase AI Logic runs Gemini Nano on the device when Chrome can, and the Gemini Developer API in the cloud only after explicit consent. Keyword rules are the fallback. Publisher: Dash Buddies Games.

## Repo map

| Path | What it is |
| --- | --- |
| `web/` | Vite + TypeScript PWA. All product work happens here. |
| `web/src/main.ts`, `web/src/ui/` | UI: hash routes `#home`/`#results`/`#settings` (`ui/router.ts`), dashboard, consent and terms dialogs, source badges (`ui/source-badge.ts`, `ui/source-explain.ts`). |
| `web/src/compliance/` | Consent store, consent copy and `CONSENT_TEXT_VERSION` (`copy.ts`), region gate (`region.ts`, `cloud-gate.ts`), `selectInferenceMode`, Clear my data. |
| `web/src/firebase.ts`, `web/src/analyze/`, `web/src/scan/` | The only Firebase AI Logic call sites. `ONLY_ON_DEVICE` before consent, `PREFER_ON_DEVICE` after. |
| `web/src/parse/`, `web/src/redact/`, `web/src/insights/`, `web/src/compare/` | Parser, redaction, subscriptions/anomalies, month comparison. All local. |
| `web/src/legal/` | Privacy, Terms, Accessibility pages. |
| `web/public/demo/` | Fictional demo statement, built by `web/scripts/make-demo-fixtures.mjs`. |
| `web/firebase.json`, `web/.firebaserc` | Hosting config (static, Spark). |
| `shared/schema/` | Transaction contract for web and Android. |
| `android/` | Kotlin M0 skeleton. Out of scope unless the Issue says so. |
| `docs/` | `STATUS.md`, `DECISIONS.md`, `TESTING.md`, `compliance/`. |

`README.md` holds the full architecture and data-flow description.

## Hard rules

1. **English only** in product, repo, commits and PRs. Hebrew only in the parser/redaction files listed in `web/src/i18n/hebrew-guard.test.ts`.
2. **No personal names or personal data** anywhere in the repo. The only public identity is Dash Buddies Games, dashbuddies.games@gmail.com.
3. **Consent is never granted silently.** Nothing reaches the cloud without the user's explicit action in the existing consent dialog. Terms agreement is not cloud consent. Checkboxes start unchecked.
4. **`CONSENT_TEXT_VERSION` stays `2026-11-15-free-b`.** Keep the existing consent, privacy and compliance tests passing. Never weaken or delete them.
5. **Free tiers only.** Firebase Spark, no Cloud Functions, no paid services, no payment methods, no service-account keys.
6. **No secrets** in git, PRs, logs, screenshots or artifacts. `web/.env.example` stays empty.
7. **Fictional data only** in tests, fixtures and screenshots.
8. **Never merge, deploy, or change repository, GitHub or Firebase settings.** Open a PR and stop. Never run `npm run deploy` or `firebase` write commands.
9. **Never act as the owner.** Do not use the owner's identity, tokens or admin bypass. Do not mention any bot in GitHub.

## Protected changes (need the owner's separate approval)

These paths and topics change only when the Issue carries an approval comment written by the repo owner (@githubuser321) for that specific change. An Issue written by a bot is not approval.

- `AGENTS.md`, `.github/**` (workflows, CODEOWNERS, templates), permissions
- CI/CD and deploy config: `web/firebase.json`, `web/.firebaserc`, `scripts/ci/**`, `scripts/deploy/**`
- Security code and checks: `web/src/compliance/**`, `web/src/redact/**`, `web/src/firebase.ts`, App Check files
- Legal/compliance text: `web/src/legal/**`, `docs/compliance/**`, consent copy

Without that approval, stop and report. If approved, list each protected file at the top of the PR.

## Working efficiently

- Read only the docs the task needs: `docs/TESTING.md` when you change tests, `docs/DECISIONS.md` when the task touches product behavior, `docs/STATUS.md` only if you must update it.
- No repo-wide scans or full-tree reads. Open only the files the task touches and their direct imports or tests.
- No refactoring, renaming or formatting outside the task. No new dependencies unless the Issue asks.
- No subagents or parallel agents.
- If two fix attempts make no progress, or a material blocker appears, stop and report what blocks you. Blockers include a missing approval, unclear Acceptance Criteria, a needed secret, or a conflict with these rules.
- Run `npm ci` in `web/` only if `node_modules` is missing or `web/package-lock.json` changed.

## Local checks by change type

From `web/`. CI runs the full mandatory set on every PR, so locally run only what matches your change:

| Change | Run |
| --- | --- |
| Logic in one module | `npx vitest run <related test files>` + `npm run typecheck` |
| UI / DOM / copy | the related tests + `src/a11y` tests + `npm run typecheck` |
| Compliance, consent, redaction, firebase | `npm test` (full) + `npm run typecheck` |
| Dependencies, build or config | `npm run lint && npm run typecheck && npm test && npm run build` |
| Docs only | nothing |

## Definition of done

- Every Acceptance Criterion is met, with evidence in the PR: a test name, a command summary, or a screenshot from fictional data.
- Behavior changes have tests with fictional data. Existing consent, privacy and compliance tests still pass.
- Docs are updated only where the change makes them wrong:
  - `docs/TESTING.md` when tests or commands change;
  - `docs/DECISIONS.md` when a decision is recorded;
  - `README.md` when behavior or setup changes;
  - `docs/STATUS.md` only when project state materially changes (a milestone, a release, a new blocker).
- The PR uses `.github/pull_request_template.md` and links the Issue with `Closes #N`.
- Nothing was merged or deployed.

## Code Review Rules

- Flag any path that reaches `getHybridModels` or `PREFER_ON_DEVICE` without a recorded consent choice.
- Flag protected changes without the owner's approval comment.
- Flag real-looking personal data in fixtures, and any secret-like string.
- Flag third-party GitHub Actions not pinned to a full commit SHA.
