# CardLens decisions

Newest first. Dates are Asia/Jerusalem. Only the repo owner changes a decision; add a new dated row instead of editing old ones.

| Date | Decision | Source |
| --- | --- | --- |
| 2026-11-26 | Changes to AGENTS.md, `.github/**`, permissions, CI/CD, deploy config, security code or legal/compliance text need the owner's separate explicit approval. A bot-written Issue is not approval. | Owner |
| 2026-11-26 | Deploys (preview and live) stay manual by the owner for now. No CI credential that can deploy, because Hosting has no preview-only role. Live is promoted by cloning the exact approved `VERSION_ID`. | Owner |
| 2026-11-26 | The blocked-terms check never runs with PR code. It runs only in a trusted context, reading the diff as data. | Owner |
| 2026-11-26 | Third-party GitHub Actions are pinned to full commit SHAs. Required checks always run and no-op when their paths are untouched. | Owner |
| 2026-11-25 | Development moves to Issues → PRs, after the submission. No duplicate checks. UX review only for user-visible changes. Agents never merge, deploy or change settings. | Owner |
| 2026-11-25 | Automated tests use fictional data only. | Owner |
| 2026-11-22 | Results first: sort on the device or with rules and show results. **Improve with Cloud AI** then opens the same consent dialog. Consent wording and version are unchanged. | Owner; PR #13 `28f4412` |
| 2026-11-22 | USD demo statement: fictional Sample Bank Visa •••• 4242, October 2026, one EUR charge. | Owner; PR #13 |
| 2026-11-22 | Home / Results / Settings tabs. Plain-language source badges with a "Why basic sorting?" explanation that opens on tap. | Owner; PR #13 |
| 2026-11-22 | Remote Config condition "Restricted regions" (EU 27, IS, LI, NO, UK, CH) sets `cloud_fallback_enabled` to `false`; the default is `true`. | Console |
| 2026-11-22 | The browser API key is referrer-restricted to the live origins and the `pr13` preview origin. Hostname wildcards are not accepted, so a new preview channel needs a new entry. | Console |
| 2026-11-19 | Try demo opens a "Before you start" terms dialog. Agreeing to the terms is not cloud consent. | PR #13 `8927c0d` |
| 2026-11-18 | English-only site. | PR #10 |
| 2026-11-17 | Public identity: Dash Buddies Games, dashbuddies.games@gmail.com. | PR #9 |
| 2026-11-15 | Spark plan and the Gemini free tier only. Privacy Variant B. Cloud is off for EEA/UK/CH browsers. `CONSENT_TEXT_VERSION = 2026-11-15-free-b`, changed only after legal review. | PR #8 |
| 2026-11-13 | `shared/schema` is the single transaction contract. | PRs #2, #3 |
| standing | Every merge and deploy needs the owner's explicit approval. Before asking, E2E runs in a real browser at desktop and ~412px on a preview, and the results (commit, PR, version) go into the request. | Owner |

## Pending

- Repository visibility. GitHub Free enforces rulesets, CODEOWNERS and environment approvals only on public repos.
- Later option: automated previews in a separate Spark project, so a preview credential cannot touch production. Needs its own API key, App Check and Remote Config setup.
