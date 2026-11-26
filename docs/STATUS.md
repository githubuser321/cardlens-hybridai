# CardLens status

Last updated: 2026-11-26 (Asia/Jerusalem). Update only when the project state materially changes.

## Priority

Hackathon submission on **29 November 2026** comes first. Every transition step below is **post-submission** and must not delay it. The hosted URL must stay reachable through 16 December 2026.

## Live

- https://cardlens-hybrid.web.app serves `main` at `d431979e611be0ce419f564929cccfff6e6a6c74` (the PR #14 merge: cloud pending state and tab focus ring), merged 2026-11-26 18:46.
- Hosting version `66fc5c792fdf34a3`, bundle `index-Ce6Mpnp4.js`. The post-merge live smoke test passed (App Check exchange 200, `generateContent` 200).
- Firebase project `cardlens-hybrid`, Spark plan. Remote Config "Restricted regions" (EEA, UK, CH) sets `cloud_fallback_enabled` to `false`.
- The browser API key referrer list allows only the live origins and the `pr13` preview origin.

## Open work

| Item | State |
| --- | --- |
| PR #14 | Merged to `main` as `d431979` on 2026-11-26. Live smoke on the cloned Hosting version passed. |
| Duplicate banner | The compliance fallback banner still appears above the new cloud error card. Changing this is deferred until after submission. |
| Docs and templates | This PR adds `AGENTS.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/TESTING.md`, and the issue/PR templates. Not merged. |

## Next steps

Submission:
1. Submit the live site for the hackathon by 29 November 2026. Live already serves the approved PR #14 build.

Post-submission:

2. Decide whether to hide the compliance fallback banner when the new cloud error card is shown.
3. Policy scan and E2E workflow.
4. Manual deploy helpers.

## Known gaps

- Gemini Nano cannot run in CI; E2E covers basic sorting.
- The manual accessibility pass (`docs/compliance/accessibility-checklist.md`) is not done.
