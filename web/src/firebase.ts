import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  CustomProvider,
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type AI } from 'firebase/ai';
import {
  APP_CHECK_TOKEN_ATTEMPTS,
  cloudAppCheckFailureMessage,
  hybridAiAllowed,
  isUsableAppCheckToken,
  warnCloudFailure,
} from './app-check-binding';
import { decideAppCheckInit, type AppCheckInitDecision } from './app-check-init';
import { applyAppCheckDebugToken } from './app-check-debug';
import { installRecaptchaNetRewrite, preloadRecaptchaNet } from './compliance/recaptcha-net';
import { conservativeSafetySettings } from './compliance/safety';
import {
  buildInsightsResponseSchema,
  buildScanLinesResponseSchema,
} from './schema/model-schemas';
import {
  buildCategorizationResponseSchema,
  transactionResponseJsonSchema,
} from './schema/shared-schema';

/**
 * Dev-only App Check debug token.
 * The whole call sits inside `import.meta.env.DEV` so production builds drop it,
 * including any `VITE_APPCHECK_DEBUG_TOKEN` value. Never set the token outside this branch.
 */
if (import.meta.env.DEV) {
  applyAppCheckDebugToken(true, import.meta.env.VITE_APPCHECK_DEBUG_TOKEN);
}

/** Cloud model used when the user has agreed to a cloud call. */
export const CLOUD_MODEL = 'gemini-3.5-flash-lite';

export const FIREBASE_NOT_CONFIGURED_MESSAGE =
  'Firebase is not configured. Copy web/.env.example to web/.env.local and fill it in. Parsing and rule-based categorization still run fully offline, and nothing is sent to the cloud.';

const FIREBASE_ENV = [
  ['VITE_FIREBASE_API_KEY', () => import.meta.env.VITE_FIREBASE_API_KEY],
  ['VITE_FIREBASE_AUTH_DOMAIN', () => import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
  ['VITE_FIREBASE_PROJECT_ID', () => import.meta.env.VITE_FIREBASE_PROJECT_ID],
  ['VITE_FIREBASE_STORAGE_BUCKET', () => import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', () => import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID],
  ['VITE_FIREBASE_APP_ID', () => import.meta.env.VITE_FIREBASE_APP_ID],
] as const;

export function missingFirebaseEnv(): string[] {
  return FIREBASE_ENV.filter(([, read]) => !read()).map(([name]) => name);
}

/** Site key present → reCAPTCHA Enterprise. Dev without a key → debug token. Otherwise cloud calls stay off. */
export function appCheckDecision(): AppCheckInitDecision {
  return decideAppCheckInit({
    siteKey: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
    isDev: Boolean(import.meta.env.DEV),
  });
}

/** Cloud calls need Firebase config and an App Check provider. On-device calls need Firebase config only. */
export function cloudAiEnabled(): boolean {
  return missingFirebaseEnv().length === 0 && appCheckDecision().kind !== 'disable-cloud';
}

const DEFAULT_FIREBASE_APP_NAME = '[DEFAULT]';

/**
 * Cloud calls use a second Firebase app.
 * @firebase/ai caches one AIService per app and backend. Its constructor copies
 * app-check-internal once and never refreshes that copy. On-device getAI() runs
 * before consent, so that copy is null and a later hybrid generateContent sends
 * no App Check header. This app is created only for cloud, after App Check init.
 */
const CLOUD_FIREBASE_APP_NAME = 'cardlens-cloud';

export function getFirebaseApp(): FirebaseApp {
  return firebaseAppNamed(DEFAULT_FIREBASE_APP_NAME);
}

function getCloudFirebaseApp(): FirebaseApp {
  return firebaseAppNamed(CLOUD_FIREBASE_APP_NAME);
}

function firebaseAppNamed(name: string): FirebaseApp {
  const missing = missingFirebaseEnv();
  if (missing.length > 0) {
    throw new Error(FIREBASE_NOT_CONFIGURED_MESSAGE);
  }
  const existing = getApps().find((app) => app.name === name);
  if (existing) {
    return existing;
  }
  const options = firebaseOptions();
  return name === DEFAULT_FIREBASE_APP_NAME ? initializeApp(options) : initializeApp(options, name);
}

function firebaseOptions(): FirebaseOptions {
  return {
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
  };
}

function requireEnv(name: (typeof FIREBASE_ENV)[number][0]): string {
  const entry = FIREBASE_ENV.find(([key]) => key === name);
  const value = entry?.[1]() ?? '';
  if (!value) {
    throw new Error(`Missing ${name}. Copy web/.env.example to web/.env.local and fill it from the Firebase console.`);
  }
  return value;
}

export interface CardLensModels {
  /** Merchant categorization. */
  categorization: ReturnType<typeof getGenerativeModel>;
  /** Statement field extraction. Nothing in the UI calls generateContent on it. */
  extraction: ReturnType<typeof getGenerativeModel>;
  /** Redacted aggregate insights. */
  redactedAggregates: ReturnType<typeof getGenerativeModel>;
  /** Scanned-page transcription. */
  scan: ReturnType<typeof getGenerativeModel>;
}

let onDeviceAi: AI | undefined;
let cloudAi: AI | undefined;
let onDeviceModels: CardLensModels | undefined;
let hybridModels: CardLensModels | undefined;
let appCheckHandle: AppCheck | undefined;
let cloudTokenReady = false;
let cloudAppCheckTask: Promise<void> | undefined;

/** On-device AI. May be constructed before App Check. It must not be reused for hybrid calls. */
function getOrCreateOnDeviceAi(): AI {
  if (!onDeviceAi) {
    onDeviceAi = getAI(getFirebaseApp(), {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: true,
    });
  }
  return onDeviceAi;
}

/**
 * Cloud AI. Call only after ensureCloudAppCheck has a usable token.
 * getAI() on the cloud app then binds the live App Check instance.
 */
function getOrCreateCloudAi(): AI {
  const binding = cloudTokenReady ? 'after-app-check' : 'before-app-check';
  if (!hybridAiAllowed(binding)) {
    throw new Error('App Check must be ready before the cloud model is created.');
  }
  if (!cloudAi) {
    cloudAi = getAI(getCloudFirebaseApp(), {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: true,
    });
  }
  return cloudAi;
}

/**
 * On-device models. Mode is ONLY_ON_DEVICE, so a missing local model throws
 * instead of sending the prompt to Gemini. App Check is not initialized here.
 */
export function getCardLensModels(): CardLensModels {
  if (onDeviceModels) {
    return onDeviceModels;
  }
  const missing = missingFirebaseEnv();
  if (missing.length > 0) {
    throw new Error(FIREBASE_NOT_CONFIGURED_MESSAGE);
  }
  onDeviceModels = buildModels(InferenceMode.ONLY_ON_DEVICE, getOrCreateOnDeviceAi());
  return onDeviceModels;
}

/**
 * Hybrid models. Call only after the user agrees to that cloud send
 * and the region gate plus cloud_fallback_enabled allow it.
 * The SDK tries the device first and may fall back to the cloud with the same prompt.
 * Initializes App Check on first use (reCAPTCHA from www.recaptcha.net, or the dev debug token).
 */
export async function getHybridModels(): Promise<CardLensModels> {
  await ensureCloudAppCheck();
  if (!hybridModels) {
    hybridModels = buildModels(InferenceMode.PREFER_ON_DEVICE, getOrCreateCloudAi());
  }
  return hybridModels;
}

/**
 * App Check starts here, not at page load, so on-device-only sessions do not load reCAPTCHA.
 * The token read finishes before getHybridModels constructs the cloud AI instance, so the
 * first generateContent is not racing an unfinished reCAPTCHA exchange.
 */
export async function ensureCloudAppCheck(): Promise<void> {
  if (cloudTokenReady) {
    return;
  }
  if (!cloudAppCheckTask) {
    cloudAppCheckTask = prepareCloudAppCheck().catch((error: unknown) => {
      cloudAppCheckTask = undefined;
      throw error;
    });
  }
  await cloudAppCheckTask;
}

async function prepareCloudAppCheck(): Promise<void> {
  if (!appCheckHandle) {
    const decision = appCheckDecision();
    if (decision.kind === 'disable-cloud') {
      throw new Error(decision.message);
    }
    const app = getCloudFirebaseApp();
    if (decision.kind === 'recaptcha-enterprise') {
      installRecaptchaNetRewrite();
      if (typeof document !== 'undefined') {
        await preloadRecaptchaNet(document);
      }
      appCheckHandle = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(decision.siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      appCheckHandle = initializeAppCheck(app, {
        provider: devDebugAppCheckProvider(),
        isTokenAutoRefreshEnabled: true,
      });
    }
  }
  await requireUsableAppCheckToken(appCheckHandle);
  cloudTokenReady = true;
}

/**
 * Waits for a real App Check JWT before any cloud generateContent.
 * The first read joins auto-refresh. A later read forces a new exchange so a
 * reCAPTCHA callback that lands late cannot leave a placeholder token on the request.
 */
async function requireUsableAppCheckToken(appCheck: AppCheck): Promise<void> {
  let cause: unknown;
  for (let attempt = 0; attempt < APP_CHECK_TOKEN_ATTEMPTS; attempt += 1) {
    try {
      const issued = await getToken(appCheck, attempt > 0);
      if (isUsableAppCheckToken(issued.token)) {
        return;
      }
      cause = new Error('App Check returned a placeholder token.');
    } catch (error) {
      cause = error;
    }
    if (attempt + 1 < APP_CHECK_TOKEN_ATTEMPTS) {
      await waitForAppCheckRetry();
    }
  }
  warnCloudFailure(cause);
  throw new Error(cloudAppCheckFailureMessage(cause));
}

/** Lets a late reCAPTCHA callback mark the widget ready before the next token read. */
function waitForAppCheckRetry(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
}

function buildModels(
  mode: typeof InferenceMode.ONLY_ON_DEVICE | typeof InferenceMode.PREFER_ON_DEVICE,
  ai: AI,
): CardLensModels {
  const safetySettings = conservativeSafetySettings();
  const categorizationSchema = buildCategorizationResponseSchema();
  const transactionSchema = transactionResponseJsonSchema();
  const insightsSchema = buildInsightsResponseSchema();
  const scanLinesSchema = buildScanLinesResponseSchema();
  const scanOnDeviceParams = {
    createOptions: {
      expectedInputs: [
        { type: 'image' as const },
        { type: 'text' as const, languages: ['en'] },
      ],
    },
    promptOptions: {
      responseConstraint: scanLinesSchema,
    },
  };

  return {
    categorization: getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: CLOUD_MODEL,
        safetySettings,
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: categorizationSchema,
        },
      },
      onDeviceParams: { promptOptions: { responseConstraint: categorizationSchema } },
    }),
    extraction: getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: CLOUD_MODEL,
        safetySettings,
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: transactionSchema,
        },
      },
      onDeviceParams: { promptOptions: { responseConstraint: transactionSchema } },
    }),
    redactedAggregates: getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: CLOUD_MODEL,
        safetySettings,
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: insightsSchema,
        },
      },
      onDeviceParams: { promptOptions: { responseConstraint: insightsSchema } },
    }),
    scan: getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: CLOUD_MODEL,
        safetySettings,
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: scanLinesSchema,
        },
      },
      onDeviceParams: scanOnDeviceParams,
    }),
  };
}

/**
 * Placeholder provider for the dev debug-token path.
 * The SDK exchanges `FIREBASE_APPCHECK_DEBUG_TOKEN` and does not call `getToken`.
 * This is not a reCAPTCHA provider and it does not invent an attestation token.
 */
function devDebugAppCheckProvider(): CustomProvider {
  return new CustomProvider({
    getToken() {
      return Promise.reject(new Error(
        'ReCaptchaEnterpriseProvider is not created without a site key. Dev App Check uses the debug token instead.',
      ));
    },
  });
}

/**
 * Download / initialize the on-device model.
 * Must be called from a user gesture (the Prepare button). Chrome rejects the
 * Prompt API download when this runs without activation.
 * Does not initialize App Check or reCAPTCHA.
 */
export async function prepareOnDeviceModel(
  onProgress?: (progress: number) => void,
): Promise<void> {
  const { categorization, scan } = getCardLensModels();
  await categorization.initializeDeviceModel((progress) => {
    onProgress?.(progress * 0.5);
  });
  try {
    await scan.initializeDeviceModel((progress) => {
      onProgress?.(0.5 + progress * 0.5);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan model preparation failed';
    throw new Error(`Categorization model is ready. Scan model: ${message}`, { cause: error });
  }
}
