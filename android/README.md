# CardLens — Android (M0 skeleton)

Kotlin + Jetpack Compose app for the Firebase **#BuildHybridAI 2026** hackathon.
Credit-card statement analyzer using **Firebase AI Logic hybrid inference**: Gemini Nano
on-device when the phone supports it, Gemini (cloud) otherwise.

> Status: **M0 skeleton.** Model status + download + warm-up, a hybrid "Try sample"
> categorization demo with an ON-DEVICE / CLOUD badge, App Check wiring, tests and CI.
> No PDF import, parser, Room or analytics yet (M3).

## What's built

| Area | Details |
|---|---|
| App | `io.cardlens.app` (applicationId + namespace), minSdk 26, compileSdk 37, targetSdk 37, English UI |
| Toolchain | AGP 9.5.1 (built-in Kotlin), Kotlin 2.4.21, Gradle 9.9.1, Compose BOM 2026.09.00, Material 3 |
| AI | `firebase-ai` **18.2.0** + `firebase-ai-ondevice` **16.0.0-beta08**, Gemini Developer API backend, cloud model `gemini-3.5-flash-lite` |
| Hybrid | `OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE, maxOutputTokens = 256)`; status via `model.onDeviceExtension.checkStatus()`, `download()` (with byte progress), `warmUp()`; source from `response.inferenceSource` |
| App Check | Play Integrity in **release** (`src/release`), `DebugAppCheckProviderFactory` in **debug** (`src/debug`, `debugImplementation`) — release never contains the debug provider; AI Logic uses **limited-use tokens** (`useLimitedUseAppCheckTokens = true`) |
| No Firebase config | Builds and runs without `google-services.json`: the plugin is applied only if the file exists, and the app shows **"Firebase not configured"** instead of crashing |
| Tests | JUnit: status mapping (incl. unavailable → cloud message, check errors/timeouts), download progress, controller flows with a fake `AiEngine`, transaction model + schema contract |
| CI | `.github/workflows/android.yml`: JDK 17, `./gradlew assembleDebug lint testDebugUnitTest compileReleaseKotlin` on changes under `android/**`, `shared/schema/**`, or the workflow file (no Play publishing) |

### Code map

```
app/src/main/java/io/cardlens/app/
  CardLensApp.kt              Firebase init -> FirebaseAiEngine or UnconfiguredAiEngine
  MainActivity.kt
  ai/AiEngine.kt              interface (testable) + SDK-free status/download/source types
  ai/FirebaseAiEngine.kt      <- the only place Firebase AI Logic is called
  ai/ModelStatus.kt           UI status + mapping + user-facing messages
  ai/CardLensController.kt    state machine (check w/ 15 s timeout, download, warm-up, sample)
  model/Transaction.kt        transaction model for shared/schema/transaction.schema.json
  model/Categorizer.kt        short JSON prompt + tolerant response parsing
  model/SampleData.kt         fictional transactions
  firebase/FirebaseBootstrap.kt
  ui/                         Compose screen, ViewModel, theme
app/src/debug/.../AppCheckSetup.kt    debug provider
app/src/release/.../AppCheckSetup.kt  Play Integrity
```

### Device behavior

* **Supported devices** (Gemini Nano via AICore / ML Kit Prompt API — e.g. Pixel 9 and newer,
  Galaxy S25 and newer; see the ML Kit supported-devices list): status `Downloadable` →
  "Download on-device model" → progress → `Available` → warm-up → sample shows **ON-DEVICE**.
  Gemini Nano 4 preview models need the AICore Developer Preview (not enabled here; the app
  uses the default `STABLE` category).
* **Unsupported devices (e.g. Pixel 6 Pro):** status card says
  *"On-device model not available on this device, using cloud."* and "Try sample" runs in
  the cloud with a **CLOUD** badge. A check that throws or hangs (>15 s) also ends in a cloud
  state, never an endless spinner. If a hybrid call throws an on-device error instead of
  falling back, the engine retries once with an `ONLY_IN_CLOUD` model.

## Setup

1. **Firebase project** (Spark, no Analytics) → **AI Services › AI Logic › Get started** →
   choose **Gemini Developer API**. This enforces App Check for AI Logic.
2. **Register the Android app** with package **`io.cardlens.app`** and the **SHA-256** of the
   signing key you'll test with:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
     -storepass android -keypass android | grep SHA256
   ```
   (Each machine has its own debug key; add every machine that builds test APKs, and later the
   Play upload/app-signing key.)
3. **Download `google-services.json`** and save it as `android/app/google-services.json`.
   It is git-ignored — never commit it. `app/google-services.json.example` is a placeholder only.
4. **App Check**
   * Release: Firebase console › Security › App Check › Apps › register **Play Integrity**
     (needs the app's SHA-256 and, for Play builds, linking in Play Console).
   * Debug: install a debug build, open the app once, then find the token in logcat:
     ```bash
     adb logcat -s DebugAppCheckProvider
     # D DebugAppCheckProvider: Enter this debug secret into the allow list ...: <uuid>
     ```
     Console › App Check › Apps › ⋮ › **Manage debug tokens** → add it. Keep it private
     (don't paste it into the repo, issues, or screenshots).
   * Make sure **Firebase AI Logic** shows **Enforced** under App Check › APIs.
5. Build: `cd android && ./gradlew installDebug` (needs JDK 17+, Android SDK platform 37).

## Build & test

```bash
cd android
./gradlew assembleDebug lint testDebugUnitTest
```

Works with or without `app/google-services.json`.

## Shared schema

`model/Transaction.kt` matches [`../shared/schema/transaction.schema.json`](../shared/schema/transaction.schema.json)
and [`../shared/schema/categories.json`](../shared/schema/categories.json). Those files are the only
copies. `SchemaContractTest` reads them from `../shared/schema` (Gradle sets `cardlens.schemaDir`
to that directory; without the property the test walks up from the working directory). Do not add
a schema copy under `android/`.
