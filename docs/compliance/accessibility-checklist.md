# CardLens accessibility checklist

Draft prepared by an AI assistant, not a lawyer or an accessibility auditor. Automated checks are in the test suite. The items below still need a person.

## Done by tests in this repository

- axe-core 4.14.0 on the main screen, dashboard, and onboarding states (`web/src/a11y/screens.test.ts`). Color contrast is turned off there because jsdom does not lay out pixels. Contrast of the palette, including footer text (`#5e574c` on `#f4efe6`) and panel text (`#1c1915` on `#fffdf8`), is checked in `web/src/a11y/contrast.test.ts`.
- Consent dialog: `role="dialog"`, `aria-modal="true"`, initial focus on **Keep it on my device** or **Cancel**, Escape refuses the send, the image checkbox starts unchecked, and **Send image** stays disabled until it is checked (`web/src/ui/consent-dialog.test.ts`).
- The page is English: `lang="en"` and `dir="ltr"`.
- `prefers-reduced-motion: reduce` shortens animation in `web/src/style.css`.
- Bar charts append an HTML table with the same labels and amounts (`web/src/ui/chart-table.ts`).

## Manual pass still to do

Use a real browser. Record the date and the assistive technology.

1. Keyboard only, no mouse: open the app, continue past the first-run notice, load the demo statement, open **See exactly what will be sent** if a cloud dialog appears, refuse with Escape, and reach Settings → **Clear my data**. Confirm focus is visible and nothing is skipped.
2. Confirm the page stays `lang="en"` and `dir="ltr"`, and the footer reads Privacy Policy · Terms of Use · Accessibility Statement · Contact.
3. Screen reader (NVDA + Chrome, and TalkBack if an Android browser is available): the consent dialog is announced as a dialog, the image checkbox state is announced, and the chart table is reachable.
4. Zoom to 200% at a 1280px-wide window and at a 390px-wide window. Text should reflow. The hidden reCAPTCHA badge must not cover **Clear my data** or the dialog buttons. The footer disclosure must remain readable.
5. Confirm the result line **AI-generated – may contain mistakes. Not financial advice.** and the chip **Analyzed on your device** or **Analyzed in the cloud (redacted)** are present after a result.
6. Open `/privacy`, `/terms`, and `/accessibility` from the footer on the main screen and from a direct URL. The accessibility statement is in the footer on each of those pages.

File gaps and the planned fix on the accessibility statement. The statement does not claim this manual pass has been done.
