import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Built at runtime so this file does not contain the forbidden mode names. */
const cloudOnlyMode = ['ONLY', 'IN', 'CLOUD'].join('_');
const preferCloudMode = ['PREFER', 'IN', 'CLOUD'].join('_');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('firebase module', () => {
  it('sets the App Check debug token only inside the dev branch', () => {
    const sourcePath = fileURLToPath(new URL('./firebase.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');
    const devBranch = source.indexOf('if (import.meta.env.DEV)');
    const call = source.indexOf('applyAppCheckDebugToken(');

    expect(devBranch).toBeGreaterThanOrEqual(0);
    expect(call).toBeGreaterThan(devBranch);
    expect(source.indexOf('applyAppCheckDebugToken(', call + 1)).toBe(-1);
    expect(source).not.toContain('self.FIREBASE_APPCHECK_DEBUG_TOKEN');
    expect(source).toContain('useLimitedUseAppCheckTokens: true');
    expect(source).toContain('InferenceMode.ONLY_ON_DEVICE');
    expect(source).toContain('InferenceMode.PREFER_ON_DEVICE');
    expect(source).not.toContain(preferCloudMode);
    expect(source).not.toContain(cloudOnlyMode);
    expect(source).toContain('model: CLOUD_MODEL');
    expect(source).toContain('initializeDeviceModel');
    expect(source).toContain('ensureCloudAppCheck');
    expect(source).toContain('conservativeSafetySettings');
    expect(source).toContain('installRecaptchaNetRewrite');
    const branch = source.indexOf("decision.kind === 'recaptcha-enterprise'");
    const constructor = source.indexOf('new ReCaptchaEnterpriseProvider(');
    expect(branch).toBeGreaterThanOrEqual(0);
    expect(constructor).toBeGreaterThan(branch);
    expect(source.indexOf('new ReCaptchaEnterpriseProvider(', constructor + 1)).toBe(-1);
    expect(source).toContain("decision.kind === 'disable-cloud'");
    const onDeviceFn = source.indexOf('export function getCardLensModels');
    const hybridFn = source.indexOf('export async function getHybridModels');
    const ensureFn = source.indexOf('export async function ensureCloudAppCheck');
    expect(onDeviceFn).toBeGreaterThanOrEqual(0);
    expect(hybridFn).toBeGreaterThan(onDeviceFn);
    expect(ensureFn).toBeGreaterThan(hybridFn);
    const consentless = source.slice(onDeviceFn, hybridFn);
    const consented = source.slice(hybridFn, ensureFn);
    expect(consentless).toContain('InferenceMode.ONLY_ON_DEVICE');
    expect(consentless).not.toContain('InferenceMode.PREFER_ON_DEVICE');
    expect(consentless).not.toContain('initializeAppCheck');
    expect(consented).toContain('InferenceMode.PREFER_ON_DEVICE');
    expect(consented).not.toContain('InferenceMode.ONLY_ON_DEVICE');
    expect(source.slice(ensureFn, source.indexOf('function buildModels'))).toContain('initializeAppCheck');
  });

  it('does not reuse an AI instance created before App Check for hybrid calls', () => {
    const sourcePath = fileURLToPath(new URL('./firebase.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).not.toContain('let aiHandle');
    expect(source).not.toContain('function getOrCreateAi(');

    const onDeviceFn = source.indexOf('function getOrCreateOnDeviceAi');
    const cloudFn = source.indexOf('function getOrCreateCloudAi');
    const onDeviceEnd = source.indexOf('/**', onDeviceFn + 1);
    const cloudEnd = source.indexOf('/**', cloudFn + 1);
    const onDeviceBody = source.slice(onDeviceFn, onDeviceEnd);
    const cloudBody = source.slice(cloudFn, cloudEnd);
    expect(onDeviceBody).toContain('getAI(getFirebaseApp()');
    expect(onDeviceBody).not.toContain('getCloudFirebaseApp');
    expect(cloudBody).toContain('getAI(getCloudFirebaseApp()');
    expect(cloudBody).toContain('hybridAiAllowed');
    expect(cloudBody).toContain('useLimitedUseAppCheckTokens: true');
    expect(source).toContain("const CLOUD_FIREBASE_APP_NAME = 'cardlens-cloud'");

    const hybridFn = source.indexOf('export async function getHybridModels');
    const ensureFn = source.indexOf('export async function ensureCloudAppCheck');
    const hybridBody = source.slice(hybridFn, ensureFn);
    const ensureCall = hybridBody.indexOf('await ensureCloudAppCheck()');
    const cloudCall = hybridBody.indexOf('getOrCreateCloudAi()');
    expect(ensureCall).toBeGreaterThanOrEqual(0);
    expect(cloudCall).toBeGreaterThan(ensureCall);
    expect(hybridBody).not.toContain('getOrCreateOnDeviceAi');
    expect(hybridBody).toContain('InferenceMode.PREFER_ON_DEVICE');

    const prep = source.slice(ensureFn, source.indexOf('function buildModels'));
    const initAt = prep.indexOf('initializeAppCheck');
    const tokenAt = prep.indexOf('getToken(');
    const usableAt = prep.indexOf('isUsableAppCheckToken');
    expect(initAt).toBeGreaterThanOrEqual(0);
    expect(tokenAt).toBeGreaterThan(initAt);
    expect(usableAt).toBeGreaterThan(tokenAt);
    expect(prep).toContain('getCloudFirebaseApp()');
    expect(prep).not.toContain('getOrCreateCloudAi');
    expect(prep).not.toContain('getOrCreateOnDeviceAi');
    expect(prep.indexOf('initializeAppCheck')).toBeLessThan(prep.indexOf('cloudTokenReady = true'));

    const build = source.slice(source.indexOf('function buildModels'), source.indexOf('function devDebugAppCheckProvider'));
    expect(build).not.toContain('getAI(');
    expect(build).not.toContain('getOrCreate');
    expect(source).not.toContain(['ONLY', 'IN', 'CLOUD'].join('_'));
    expect(source).toContain('InferenceMode.PREFER_ON_DEVICE');
  });

  it('never names a cloud-only inference mode and does not bypass safety filters', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const files = sourceFiles(root);
    const everything = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    const production = files
      .filter((file) => !file.endsWith('.test.ts'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(everything).not.toContain(cloudOnlyMode);
    expect(production).not.toContain(preferCloudMode);
    expect(production).not.toContain('BLOCK_NONE');
    expect(production).toContain('BLOCK_LOW_AND_ABOVE');
    expect(production).toContain('InferenceMode.ONLY_ON_DEVICE');
    expect(production).toContain('InferenceMode.PREFER_ON_DEVICE');
    expect(production).toContain('selectInferenceMode');
  });

  it('imports without Firebase env vars', async () => {
    const module = await import('./firebase');
    expect(module.missingFirebaseEnv().length).toBeGreaterThan(0);
    expect(module.missingFirebaseEnv()).not.toContain('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY');
    expect(module.missingFirebaseEnv()).toContain('VITE_FIREBASE_API_KEY');
    expect(() => module.getCardLensModels()).toThrow(/not configured/i);
  });
});
