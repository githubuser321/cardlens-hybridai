# CardLens demo script

Draft for a recording of up to 3 minutes. Narration is meant to be spoken. Actions are what the camera should see. The statement in the app is fictional. Do not open a real card statement on camera.

Items marked **Needs a prepared Chrome** will not appear on a laptop that cannot run Gemini Nano. Say so in the narration and show the rules path instead of pretending the badge changed.

## Before you record

- Web app: `cd web && npm ci && npm run dev`. No `.env.local` is enough for the rules path, the demo PDF, redaction, subscriptions, the duplicate, and month comparison.
- On-device badge and a real scan transcription: **Needs a prepared Chrome.** Chrome 148 or newer, `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled, and hardware that can run the model (22 GB free disk, and a GPU with more than 4 GB of VRAM or 16 GB of RAM with at least 4 cores). Click **Download on-device model** once and wait until the badge says Available. `LanguageModel.availability()` is what the page reads.
- Cloud fallback or the hybrid demo tag `IN_CLOUD`: a Firebase web app, App Check, and either a reCAPTCHA Enterprise site key or a registered debug token in `VITE_APPCHECK_DEBUG_TOKEN`. Do not show the token or any key on screen.
- Offline reload of the app shell: `npm run build` then `npx vite preview`. The dev server does not register the service worker. Toggling offline after the page is already open is enough to show the banner and a second local analysis.
- Android: only mention what the repo contains. Do not show a PDF import. A device recording needs `google-services.json` (gitignored) and a debug App Check token. Skip the device if you do not have one.

## Script

### 0:00–0:18 Problem

Narration: "A card statement is a few pages of transactions, and it starts with your name, your id, and the full card number. The useful part is buried: a subscription you just added, and a charge that went through twice."

On screen: CardLens header. Do not scroll yet. No real statement in the frame.

### 0:18–0:38 Privacy-first hybrid

Narration: "CardLens reads the file in the browser. It parses locally and strips personal details before any text model sees merchant names. On-device Gemini runs when it can. Cloud Gemini runs only if you agree, and only with that redacted text. If you say no, keyword rules finish the job. The cloud never receives the raw PDF. On the free tier, people whose browser looks like the EEA, the UK, or Switzerland are not offered cloud at all."

On screen: Point to the sentence under the title, then the on-device section. Read the badge out loud. On an unprepared browser it says Unknown or Not supported, and the status says keyword rules still run.

**Needs a prepared Chrome** to show Available. If the badge is not Available, say: "On this machine the on-device model is not ready, so the next step stays on rules. A Chrome 148 profile with the Prompt API flag shows Available after the download."

### 0:38–1:05 Try demo statement

Narration: "This is a fictional English statement from August through October. Nothing in it is a real cardholder."

Action: Click **Try demo statement**.

On screen: The status line says the text stayed in the browser. The dashboard fills: transaction count, insights, subscriptions, month comparison, anomalies, and the table. Open **Extracted text lines** for one second so the transaction rows are visible, then close it.

### 1:05–1:20 On-device badge

Narration: "Every row carries a source badge. Right now these are Rules, because categorization never left the machine."

On screen: The Source column. Rules badges.

**Needs a prepared Chrome** plus Firebase config for those badges to read On-device. If you have that setup, say: "The same PDF, with the model downloaded, badges On-device. The log still says the statement was not sent." Do not claim On-device if the badge says Rules.

### 1:20–1:42 Redaction and what was sent

Narration: "The header still has a name, a test card number, a phone, and an email in the local text. Those never go into a model prompt. The log shows the merchant list with the name masked, and it records that this run was not sent."

Action: Scroll to **What is sent to the cloud**. Leave the entry expanded.

On screen: Placeholders such as `[REDACTED_NAME]` and `[REDACTED_PAN]`, source Rules, and the note that keyword rules ran on device. Do not hover any real secret. There is nothing real in this fixture, but do not zoom a debug token if one is in the console.

### 1:42–2:05 Insights: new subscription and duplicate

Narration: "Spotify shows up as a new subscription in October. It was billed in August and October, not in September, so the month comparison marks it New. Netflix keeps running. And GETT appears twice, same amount, one day apart. That is the duplicate. The Amazon line is a refund, so the amount is negative. The bookshop charge is in euros."

On screen: Subscription changes (Spotify, New), the anomaly list (Duplicate on both GETT rows), the negative refund, and the foreign-currency row. Hover or scroll so both the New badge and one Duplicate label are in frame.

### 2:05–2:22 Offline

Narration: "Pull the network. The banner says cloud calls are paused. The demo PDF still parses, and rules still categorize. Comparison stays on this device."

Action: DevTools → Network → Offline. Confirm the offline banner. Click **Try demo statement** again. The dashboard returns.

**Needs a production preview** only if you reload the tab while offline and want the shell to come back. Say that if you do not show a reload.

### 2:22–2:40 Scanned image and consent

Narration: "The other file is a photo of the same page, slightly rotated and noisy. A picture cannot be redacted as text, so it does not go to the cloud unless a separate dialog asks and you check the box. That box starts empty."

Action: Set the network back to online. Click **Try scanned image**. If a dialog appears, press Escape or **Cancel**.

On screen: The status explains that the scan was not sent. That refusal is the privacy beat.

**Needs a prepared Chrome** (or a configured cloud project and a checked consent box) to transcribe the photo into rows. If you do not have that, stop after the refusal. Say: "Transcription needs the on-device model, or explicit consent plus App Check. We are not sending this image."

### 2:40–2:50 Month comparison

Narration: "September versus October is calculated locally. Large swings are marked Notable. Remote Config can hide this block. The default is on, and a failed fetch keeps that default. No function call is involved."

On screen: The month-over-month bars and the Spotify New row, if they are not already in frame. This works with no env vars.

### 2:50–3:00 Android and close

Narration: "The Android app in this repo is the M0 skeleton. It checks Gemini Nano, can download it, and categorizes a built-in sample with an on-device or cloud badge. It does not import a PDF yet. On the web, the statement is parsed here first, and the cloud only sees what redaction left behind."

On screen: Stay on the web dashboard. Do not imply an Android PDF flow. A device shot is optional and **needs a phone with the debug build**. If you have one, cut in the status card and the sample badge only.

End on the CardLens title or the redaction log.
