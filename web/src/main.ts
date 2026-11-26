import {
  analyzeTransactions,
  type AnalyzedTransaction,
  type MerchantModel,
} from './analyze/categorize';
import { createGatedModel } from './analyze/gated-model';
import { firebaseHybridInsightsModel, firebaseOnDeviceInsightsModel } from './analyze/firebase-insights';
import { firebaseHybridMerchantModel, firebaseOnDeviceMerchantModel } from './analyze/firebase-model';
import { resetCloudWarn, warnCloudFailure } from './app-check-binding';
import { resolveAnalysisAccess, type AnalysisAccess } from './app-check-init';
import { createCloudLog, type CloudLogEntry } from './cloud-log';
import {
  browserAvailabilitySources,
  probeDeviceAvailability,
  readBrowserLanguageModel,
  type DeviceAvailability,
} from './device/availability';
import { downloadOnDeviceModel } from './device/download';
import {
  browserPrefsStore,
  prefsAfterDismiss,
  readOnboardingPrefs,
  shouldNag,
  writeOnboardingPrefs,
} from './device/prefs';
import { CLOUD_FAILED_ALERT, safeTechnicalDetail } from './compliance/cloud-outcome';
import { UserFacingError } from './compliance/errors';
import { parseCloudFallback } from './compliance/cloud-gate';
import {
  appCheckDecision,
  FIREBASE_NOT_CONFIGURED_MESSAGE,
  getFirebaseApp,
  missingFirebaseEnv,
  prepareOnDeviceModel,
} from './firebase';
import { flagsFromStrings, LOCAL_FLAG_DEFAULTS, type FeatureFlags } from './flags/flags';
import { readRemoteFlagValues } from './flags/load-flags';
import { runHybridDemo } from './hybrid-demo';
import { createInsights, type InsightsModel } from './insights/create-insights';
import type { Anomaly } from './insights/anomalies';
import { isBrowserOnline, withTimeout } from './offline';
import { registerAppShell } from './pwa';
import { extractPdfLines } from './pdf/extract-text';
import { renderPdfPageImage } from './pdf/render-page';
import { SAMPLE_STATEMENT_LINES } from './parse/sample-statement';
import { parseStatementLines } from './parse/statement';
import { collectStatementLines, pageNeedsScan } from './scan/collect';
import { firebaseHybridScanModel, firebaseOnDeviceScanModel } from './scan/firebase-scan';
import { runScanWithConsent } from './scan/gated-scan';
import { imageFileToScan, isImageFile, scanImagePreviewUrl, type ScanImage } from './scan/image';
import { presentScanFailure, scanBlockedMessage } from './scan/policy';
import { buildScanPrompt, parseScanLinesResponse } from './scan/prompt';
import { formatInferenceSource } from './inference-source';
import { cloudAskFrom, composeAnalysisCopy, insightsSentence } from './ui/analysis-status';
import { renderCloudLog } from './ui/render-cloud-log';
import {
  markDashboardStale,
  renderDashboard,
  renderTransactionRows,
  resetDashboard,
  type DashboardView,
} from './ui/render-dashboard';
import { renderOnboarding } from './ui/render-onboarding';
import { afterNextPaint, markReadingScan } from './ui/scan-status';
import { askDemoTerms } from './ui/consent-dialog';
import {
  CLOUD_SEND_ERROR_MESSAGE,
  cloudBannerOutcome,
  cloudSendElements,
  createCloudSendSession,
  devCloudFailureRequested,
  type CloudSendSession,
} from './ui/cloud-send';
import { createDemoEntry, openCloudImprovement, wireDemoEntry } from './ui/demo-entry';
import { openSortPopover } from './ui/source-badge';
import { isDemoStatementFile, setDemoStatementLink } from './ui/demo-statement-link';
import { bindAppNav, focusUploadZone, showResultsView } from './ui/router';
import { mountCompliance } from './ui/shell';
import { readConsent, readSessionConsent } from './compliance/consent-store';
import { readFirstRun } from './i18n/locale';
import type { SortContext } from './ui/source-explain';

const configStatus = requireElement('config-status');
const offlineStatus = requireElement('offline-status');
const downloadButton = requireButton('download-model');
const dismissButton = requireButton('dismiss-onboarding');
const onboardingStatus = requireElement('onboarding-status');
const dropZone = requireElement('drop-zone');
const pdfInput = requireInput('pdf-file');
const pdfStatus = requireElement('pdf-status');
const pdfLines = requireElement('pdf-lines');
const loadSampleButton = requireButton('load-sample');
requireButton('load-demo');
const loadDemoScanButton = requireButton('load-demo-scan');
const categoryFilter = requireSelect('category-filter');
const demoButton = requireButton('run-demo');
const demoStatus = requireElement('demo-status');
const inferenceRow = requireElement('inference-row');
const inferenceTag = requireElement('inference-tag');
const inferenceRaw = requireElement('inference-raw');
const demoResult = requireElement('demo-result');

const compliance = mountCompliance({
  useCloud: () => currentAccess().useCloud,
  onCleared() {
    cloudLog.clear();
    renderCloudLog(cloudLog.list());
    currentTransactions = [];
    currentAnomalies = [];
    lastView = null;
    resetDashboard();
    pdfStatus.replaceChildren();
    pdfStatus.classList.remove('is-error', 'is-reading');
    pdfLines.replaceChildren();
    setDemoStatementLink(document, false);
    demoStatus.replaceChildren();
    demoStatus.classList.remove('is-error');
    demoResult.textContent = '';
    inferenceRow.hidden = true;
  },
});
const demoEntry = createDemoEntry({
  termsAccepted: () => readFirstRun(localStorage) !== null,
  startDemo() {
    void loadDemoFile('/demo/demo-statement.pdf', 'demo-statement.pdf', 'application/pdf');
  },
  askTerms: () => askDemoTerms(),
  acceptTerms() {
    compliance.acceptFirstRun();
  },
});
wireDemoEntry(document, demoEntry);
bindAppNav(document);
for (const id of ['hero-upload', 'empty-upload']) {
  document.getElementById(id)?.addEventListener('click', () => {
    if (window.location.hash !== '#upload') {
      window.location.hash = '#upload';
    }
    focusUploadZone(dropZone);
  });
}
document.getElementById('privacy-info')?.addEventListener('click', () => {
  const button = document.getElementById('privacy-info');
  const body = document.getElementById('privacy-details-body')?.textContent?.trim() ?? '';
  if (button instanceof HTMLElement) {
    openSortPopover(button, {
      title: 'Privacy details',
      body,
      action: null,
      actionLabel: null,
    });
  }
});
document.getElementById('improve-cloud')?.addEventListener('click', () => {
  void improveWithCloud();
});
document.getElementById('cloud-send-retry')?.addEventListener('click', () => {
  void improveWithCloud();
});
document.getElementById('cloud-send-dismiss')?.addEventListener('click', () => {
  cloudSend?.dismiss();
});
document.addEventListener('cardlens-retry-cloud', () => {
  void improveWithCloud();
});
const cloudSend = bindCloudSend();
const cloudLog = createCloudLog();
let currentTransactions: AnalyzedTransaction[] = [];
let currentAnomalies: Anomaly[] = [];
let featureFlags: FeatureFlags = { ...LOCAL_FLAG_DEFAULTS };
let lastView: DashboardView | null = null;
let deviceAvailability: DeviceAvailability = 'unknown';
let onboardingFrozen = false;
let lastAnalysisLines: string[] | null = null;
let lastAnalysisLabel = '';

paintDevChrome();
showBanner(currentAccess().banner);
bindOffline();
registerAppShell();
renderCloudLog(cloudLog.list());
paintOnboarding(readOnboardingPrefs(browserPrefsStore()).lastAvailability ?? 'unknown');
void boot();

downloadButton.addEventListener('click', () => {
  void onDownload();
});

dismissButton.addEventListener('click', () => {
  onDismiss();
});

pdfInput.addEventListener('change', () => {
  const file = pdfInput.files?.[0];
  if (file) {
    void onIncomingFile(file);
  }
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('is-dragging');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
  const file = event.dataTransfer?.files[0];
  if (file) {
    void onIncomingFile(file);
  }
});

loadSampleButton.addEventListener('click', () => {
  pdfStatus.textContent = '';
  pdfStatus.classList.remove('is-error', 'is-reading');
  pdfLines.replaceChildren();
  setDemoStatementLink(document, false);
  markDashboardStale();
  void runAnalysis([...SAMPLE_STATEMENT_LINES], 'Sample statement');
});

loadDemoScanButton.addEventListener('click', () => {
  void loadDemoFile('/demo/demo-statement-scan.jpg', 'demo-statement-scan.jpg', 'image/jpeg');
});

categoryFilter.addEventListener('change', () => {
  renderTransactionRows(currentTransactions, categoryFilter.value, currentAnomalies);
});

demoButton.addEventListener('click', () => {
  void onDemo();
});

async function boot(): Promise<void> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
    const { applyDevPreview } = await import('./preview');
    onboardingFrozen = await applyDevPreview(window.location.search);
  }
  if (!onboardingFrozen) {
    await refreshAvailability();
  }
  try {
    const app = missingFirebaseEnv().length === 0 ? getFirebaseApp() : null;
    const remote = await readRemoteFlagValues(app);
    if (!remote) {
      featureFlags = { ...LOCAL_FLAG_DEFAULTS };
      compliance.setRemote({ fetched: false, value: null });
    } else {
      featureFlags = flagsFromStrings({
        monthComparison: remote.monthComparison,
        notableDeltaPercent: remote.notableDeltaPercent,
      });
      compliance.setRemote({ fetched: true, value: parseCloudFallback(remote.cloudFallback) });
    }
  } catch {
    featureFlags = { ...LOCAL_FLAG_DEFAULTS };
    compliance.setRemote({ fetched: false, value: null });
  }
  if (lastView) {
    showDashboard(lastView);
  }
}

async function refreshAvailability(): Promise<void> {
  const availability = await probeDeviceAvailability(browserAvailabilitySources());
  deviceAvailability = availability;
  if (availability !== 'unknown') {
    const prefs = readOnboardingPrefs(browserPrefsStore());
    writeOnboardingPrefs(browserPrefsStore(), { ...prefs, lastAvailability: availability });
  }
  paintOnboarding(availability);
}

function paintOnboarding(
  availability: DeviceAvailability,
  extras: { progress?: number | null; error?: string | null; nag?: boolean } = {},
): void {
  deviceAvailability = availability;
  const prefs = readOnboardingPrefs(browserPrefsStore());
  renderOnboarding({
    availability,
    nag: extras.nag ?? shouldNag(availability, prefs),
    progress: extras.progress ?? null,
    error: extras.error ?? null,
  });
}

async function onDownload(): Promise<void> {
  const previous = deviceAvailability;
  paintOnboarding('downloading', { progress: 0, nag: false });
  try {
    await downloadOnDeviceModel({
      initializeDeviceModel: missingFirebaseEnv().length === 0
        ? (progress) => prepareOnDeviceModel(progress)
        : null,
      languageModel: readBrowserLanguageModel(),
      onProgress(progress) {
        paintOnboarding('downloading', { progress, nag: false });
      },
    });
    const availability = await probeDeviceAvailability(browserAvailabilitySources());
    if (availability !== 'unknown') {
      const prefs = readOnboardingPrefs(browserPrefsStore());
      writeOnboardingPrefs(browserPrefsStore(), { ...prefs, lastAvailability: availability });
    }
    if (availability === 'downloading') {
      paintOnboarding('downloading', { progress: null, nag: false });
    } else if (availability === 'available') {
      paintOnboarding(availability);
    } else {
      paintOnboarding(availability, {
        error: 'The on-device model is still not ready. Keyword rules are still categorizing on this device.',
      });
    }
  } catch (error) {
    const availability = previous === 'downloading' || previous === 'available' ? 'downloadable' : previous;
    paintOnboarding(availability, { error: errorMessage(error) });
  }
  focusElement(onboardingStatus);
}

function onDismiss(): void {
  const prefs = prefsAfterDismiss(readOnboardingPrefs(browserPrefsStore()), deviceAvailability);
  writeOnboardingPrefs(browserPrefsStore(), { ...prefs, lastAvailability: deviceAvailability });
  paintOnboarding(deviceAvailability, { nag: false });
  focusElement(onboardingStatus);
}

async function loadDemoFile(url: string, name: string, type: string): Promise<void> {
  markDashboardStale();
  setDemoStatementLink(document, false);
  setStatus(pdfStatus, `Loading ${name}…`, 'info');
  pdfLines.replaceChildren();
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load the demo file ${name}.`);
    }
    const file = new File([await response.blob()], name, { type });
    const demoPdf = isDemoStatementFile(name) && type === 'application/pdf';
    await onIncomingFile(file, demoPdf ? 'demo-pdf' : 'other');
  } catch (error) {
    showFailure(pdfStatus, error);
    focusElement(pdfStatus);
  }
}

async function onIncomingFile(file: File, source: 'upload' | 'demo-pdf' | 'other' = 'upload'): Promise<void> {
  setDemoStatementLink(document, source === 'demo-pdf');
  if (isImageFile(file)) {
    await onImage(file);
    return;
  }
  if (!isPdf(file)) {
    setStatus(pdfStatus, 'Choose a PDF or a scanned image (PNG, JPEG, or WebP).', 'error');
    focusElement(pdfStatus);
    return;
  }
  await onPdf(file);
}

async function onImage(file: File): Promise<void> {
  markDashboardStale();
  setStatus(pdfStatus, `Reading scan ${file.name}…`, 'info');
  pdfLines.replaceChildren();
  try {
    const image = await imageFileToScan(file);
    const lines = await transcribe(image, file.name);
    renderPages([lines]);
    setStatus(pdfStatus, `${file.name}: scanned image. The picture was the model input.`, 'info');
    await runAnalysis(lines, file.name);
  } catch (error) {
    showFailure(pdfStatus, error);
    focusElement(pdfStatus);
  }
}

async function onPdf(file: File): Promise<void> {
  markDashboardStale();
  setStatus(pdfStatus, `Reading ${file.name}…`, 'info');
  pdfLines.replaceChildren();
  try {
    const extracted = await extractPdfLines(file);
    const collected = await collectStatementLines(extracted, async (pageNumber) => {
      const image = await renderPdfPageImage(file, pageNumber);
      return transcribe(image, `${file.name} page ${pageNumber}`);
    });
    const scanned = extracted.filter((lines) => pageNeedsScan(lines)).length;
    setStatus(pdfStatus, [
      `${file.name}: ${extracted.length} page${extracted.length === 1 ? '' : 's'}.`,
      scanned === 0 ? 'Text stayed in the browser.' : `${scanned} image-only page${scanned === 1 ? '' : 's'} needed a model.`,
      ...collected.warnings,
    ].join(' '), 'info');
    renderPages(collected.pages);
    await runAnalysis(collected.pages.flat(), file.name);
  } catch (error) {
    showFailure(pdfStatus, error);
    focusElement(pdfStatus);
  }
}

async function transcribe(image: ScanImage, label: string): Promise<string[]> {
  markReadingScan(pdfStatus, label);
  await afterNextPaint();
  const online = isBrowserOnline();
  const access = currentAccess();
  const gate = compliance.cloudDecision(online);
  if (!access.useOnDevice) {
    throw new Error(scanBlockedMessage({
      configured: false,
      online,
      allowCloud: false,
      cloudDisabled: access.block === 'cloud-disabled',
    }));
  }
  const prompt = buildScanPrompt();
  const preview = scanImagePreviewUrl(image);
  const payloadText = JSON.stringify({
    prompt,
    image: {
      label,
      mimeType: image.mimeType,
      byteLength: image.byteLength,
      note: 'The image below is the exact model input. A scan cannot be text-redacted.',
    },
  }, null, 2);
  const blockedMessage = gate.reason === 'app-check'
    ? scanBlockedMessage({ configured: true, online, allowCloud: false, cloudDisabled: true })
    : gate.reason === 'offline'
      ? scanBlockedMessage({ configured: true, online, allowCloud: false })
      : gate.enabled
        ? scanBlockedMessage({ configured: true, online, allowCloud: true })
        : scanBlockedMessage({ configured: true, online, allowCloud: false, regionBlocked: true });
  try {
    const outcome = await runScanWithConsent({
      onDevice: () => firebaseOnDeviceScanModel().generateContent({ prompt, image }),
      openHybrid: async () => {
        const model = await firebaseHybridScanModel();
        return model.generateContent({ prompt, image });
      },
      regionAllowed: gate.regionAllowed,
      cloudFallbackEnabled: gate.cloudFallbackEnabled,
      blockedMessage,
      requestConsent: () => compliance.requestImageConsent(preview),
    });
    const source = formatInferenceSource(outcome.inferenceSource);
    record({
      purpose: 'scan',
      inferenceSource: source,
      sentToCloud: outcome.sentToCloud,
      report: { findings: [], total: 0 },
      payloadText,
      note: outcome.sentToCloud
        ? 'Scanned image sent to the cloud after you agreed. It cannot be text-redacted. It was not retried.'
        : 'Scanned image stayed on device. It was not sent to the cloud.',
      imagePreviewUrl: preview,
    });
    return parseScanLinesResponse(outcome.text);
  } catch (error) {
    const shown = presentScanFailure(error, prompt);
    record({
      purpose: 'scan',
      inferenceSource: 'UNKNOWN',
      sentToCloud: false,
      report: { findings: [], total: 0 },
      payloadText,
      note: shown.message,
      imagePreviewUrl: preview,
    });
    throw new UserFacingError(shown.message, shown.detail);
  }
}

async function improveWithCloud(): Promise<void> {
  if (cloudSend?.phase() === 'pending') {
    return;
  }
  await openCloudImprovement({
    lines: lastAnalysisLines,
    ask: (preview) => compliance.requestTextConsent(preview),
    run: () => sendCloudAnalysis(),
  });
}

async function sendCloudAnalysis(): Promise<void> {
  resetCloudWarn();
  const ticket = cloudSend?.startPending() ?? 0;
  try {
    const result = await runAnalysis(lastAnalysisLines ?? [], lastAnalysisLabel, true);
    if (!result.ok) {
      cloudSend?.fail(ticket, result.message ?? CLOUD_SEND_ERROR_MESSAGE);
      return;
    }
    cloudSend?.succeed(ticket);
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : CLOUD_SEND_ERROR_MESSAGE;
    cloudSend?.fail(ticket, message);
  }
}

function warnCloudSend(reason: string): void {
  warnCloudFailure(new Error(reason));
}

function bindCloudSend(): CloudSendSession | null {
  const els = cloudSendElements(document);
  if (!els) {
    return null;
  }
  return createCloudSendSession(els, {
    onTimeout() {
      warnCloudSend('still waiting after 30s. The request was not cancelled.');
    },
  });
}

async function runAnalysis(lines: readonly string[], label: string, allowCloud = false): Promise<{ ok: boolean; message: string | null }> {
  lastAnalysisLines = [...lines];
  lastAnalysisLabel = label;
  const analysisStatus = requireElement('analysis-status');
  const dashboard = requireElement('dashboard');
  if (!allowCloud) {
    setStatus(analysisStatus, `Parsing ${label}…`, 'info');
  }
  dashboard.setAttribute('aria-busy', 'true');
  try {
    if (allowCloud && devCloudFailureRequested()) {
      throw new Error('Cloud AI did not respond.');
    }
    const parsed = parseStatementLines(lines);
    const online = isBrowserOnline();
    const access = currentAccess();
    const gate = compliance.cloudDecision(online);
    showBanner(access.banner);
    const blockedMessage = gate.message;
    const model = allowCloud && access.useOnDevice
      ? guardModel(createGatedModel({
        onDevice: firebaseOnDeviceMerchantModel(),
        openHybrid: () => firebaseHybridMerchantModel(),
        consentGranted: () => compliance.textConsentGranted(),
        regionAllowed: gate.regionAllowed,
        cloudFallbackEnabled: gate.cloudFallbackEnabled,
        blockedMessage,
        requestConsent: (prompt) => compliance.requestTextConsent(prompt),
      }), online)
      : null;
    const analysis = await analyzeTransactions(parsed, { lines, model });
    const insightsModel = allowCloud && access.useOnDevice
      ? guardInsights(createGatedModel({
        onDevice: firebaseOnDeviceInsightsModel(),
        openHybrid: () => firebaseHybridInsightsModel(),
        consentGranted: () => compliance.textConsentGranted(),
        regionAllowed: gate.regionAllowed,
        cloudFallbackEnabled: gate.cloudFallbackEnabled,
        blockedMessage,
        requestConsent: (prompt) => compliance.requestTextConsent(prompt),
      }), online)
      : null;
    const insights = await createInsights({
      lines,
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      transactions: analysis.transactions,
      anomalies: analysis.anomalies,
      model: insightsModel,
      online,
    });
    recordAnalysis(analysis, insights);
    currentTransactions = analysis.transactions;
    currentAnomalies = analysis.anomalies;
    const cloudAsk = cloudAskFrom({
      outcomes: analysis.calls.map((call) => call.outcome),
      sentToCloud: analysis.transactions.some((row) => row.inferenceSource === 'IN_CLOUD') || insights.sentToCloud,
      insightsOutcome: insights.outcome,
    });
    const copy = composeAnalysisCopy({
      label: /demo-statement\.pdf/i.test(label) ? 'Demo statement' : label,
      count: parsed.length === 0 ? 0 : analysis.transactions.length,
      sources: analysis.transactions.map((row) => row.inferenceSource),
      cloudAsk,
      insightsSentence: insightsSentence(insights.inferenceSource, insights.sentToCloud),
    });
    const cloudDetail = technicalDetails(analysis, insights);
    showDashboard({
      status: copy.status,
      cloudAsk,
      cloudDetail,
      transactions: analysis.transactions,
      aggregates: analysis.aggregates,
      subscriptions: analysis.subscriptions,
      anomalies: analysis.anomalies,
      insights: {
        summary: insights.summary,
        insights: insights.insights,
        inferenceSource: insights.inferenceSource,
        note: insights.note,
      },
      sortContext: sortContext(online, cloudAsk === 'declined'),
      foreignNote: lines.some((line) => /\bEUR\b/.test(line)) ? 'Includes 1 foreign charge (EUR).' : null,
    });
    showResultsView();
    if (!allowCloud) {
      return { ok: true, message: null };
    }
    const failedCall = analysis.calls.find((call) => (
      call.outcome === 'failed' || call.outcome === 'blocked' || call.outcome === 'declined'
    ));
    const outcome = cloudBannerOutcome({
      modelInvoked: analysis.sent || insights.outcome !== 'skipped',
      callOutcomes: analysis.calls.map((call) => call.outcome),
      callDetail: failedCall?.technicalDetail || failedCall?.detail || insights.detail,
      sentToCloud: cloudAsk === 'sent',
      sources: analysis.transactions.map((row) => row.inferenceSource),
      insightsOutcome: insights.outcome,
    });
    if (!outcome.ok) {
      warnCloudSend(outcome.message ?? CLOUD_SEND_ERROR_MESSAGE);
    }
    return outcome;
  } catch (error) {
    const shown = presentError(error);
    if (allowCloud) {
      warnCloudSend(shown.detail ? `${shown.message} ${shown.detail}` : shown.message);
    }
    setStatus(pdfStatus, shown.message, 'error', shown.detail);
    if (!dashboard.hidden) {
      setStatus(analysisStatus, shown.message, 'error', shown.detail);
    }
    focusElement(dashboard.hidden ? pdfStatus : analysisStatus);
    return { ok: false, message: shown.message };
  } finally {
    dashboard.setAttribute('aria-busy', 'false');
  }
}

function sortContext(online: boolean, declined: boolean): SortContext {
  const decision = compliance.cloudDecision(online);
  const consent = readConsent(localStorage);
  const session = readSessionConsent(sessionStorage);
  return {
    gate: online ? decision.reason : 'offline',
    preferenceNever: consent.preference === 'never',
    sessionOff: session.text === 'off',
    modelUnsupported: deviceAvailability === 'not-supported',
    declined,
  };
}

function showDashboard(view: DashboardView): void {
  lastView = view;
  renderDashboard({
    ...view,
    monthComparisonEnabled: featureFlags.monthComparisonEnabled,
    notableDeltaPercent: featureFlags.notableDeltaPercent,
  });
}

function recordAnalysis(
  analysis: Awaited<ReturnType<typeof analyzeTransactions>>,
  insights: Awaited<ReturnType<typeof createInsights>>,
): void {
  if (analysis.calls.length === 0) {
    record({
      purpose: 'categorization',
      inferenceSource: 'RULES',
      sentToCloud: false,
      report: analysis.report,
      payloadText: JSON.stringify(analysis.payload, null, 2),
      note: 'Keyword rules ran on this device. This merchant list is what a model call would receive.',
      imagePreviewUrl: null,
    });
  } else {
    for (const call of analysis.calls) {
      record({
        purpose: 'categorization',
        inferenceSource: call.inferenceSource,
        sentToCloud: call.inferenceSource === 'IN_CLOUD',
        report: analysis.report,
        payloadText: call.prompt,
        note: call.detail,
        imagePreviewUrl: null,
      });
    }
  }
  record({
    purpose: 'insights',
    inferenceSource: insights.callSource ?? insights.inferenceSource,
    sentToCloud: insights.sentToCloud,
    report: insights.report,
    payloadText: insights.payloadText,
    note: insights.note,
    imagePreviewUrl: null,
  });
}

function record(input: Omit<CloudLogEntry, 'id' | 'at'>): void {
  cloudLog.record(input);
  renderCloudLog(cloudLog.list());
}

function guardModel(model: MerchantModel, online: boolean): MerchantModel {
  return {
    async generateContent(prompt: string) {
      const pending = model.generateContent(prompt);
      return online ? pending : withTimeout(pending, 8000);
    },
  };
}

function guardInsights(model: InsightsModel, online: boolean): InsightsModel {
  return {
    async generateContent(prompt: string) {
      const pending = model.generateContent(prompt);
      return online ? pending : withTimeout(pending, 8000);
    },
  };
}

async function onDemo(): Promise<void> {
  demoButton.disabled = true;
  demoStatus.textContent = 'Running hybrid demo…';
  inferenceRow.hidden = true;
  demoResult.textContent = '';
  try {
    const result = await runHybridDemo();
    demoStatus.textContent = 'Hybrid demo finished.';
    inferenceTag.textContent = result.tag;
    inferenceTag.dataset.source = result.tag;
    inferenceRaw.textContent = result.inferenceSource ?? '';
    inferenceRow.hidden = false;
    demoResult.textContent = result.formatted;
  } catch (error) {
    const raw = errorMessage(error);
    setStatus(
      demoStatus,
      'The sample demo could not finish. Try again in a moment.',
      'error',
      safeTechnicalDetail(raw),
    );
  } finally {
    demoButton.disabled = false;
  }
}

function currentAccess(): AnalysisAccess {
  return resolveAnalysisAccess({
    missingFirebase: missingFirebaseEnv().length > 0,
    firebaseNotConfiguredMessage: FIREBASE_NOT_CONFIGURED_MESSAGE,
    decision: appCheckDecision(),
  });
}

function showBanner(banner: AnalysisAccess['banner']): void {
  const debug = isDebugView();
  if (banner.tone === 'ok' && !debug) {
    configStatus.hidden = true;
    configStatus.textContent = '';
    return;
  }
  configStatus.hidden = false;
  configStatus.textContent = banner.message;
  configStatus.className = banner.tone === 'ok' ? 'banner is-ok' : 'banner is-warning';
}

function isDebugView(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function paintDevChrome(): void {
  const debug = isDebugView();
  const eyebrow = document.querySelector('.eyebrow');
  if (eyebrow instanceof HTMLElement) {
    eyebrow.hidden = !debug;
  }
  const hybrid = document.getElementById('hybrid-demo');
  if (hybrid instanceof HTMLElement) {
    hybrid.hidden = !debug;
  }
}

function setStatus(
  element: HTMLElement,
  message: string,
  tone: 'info' | 'error',
  detail: string | null = null,
): void {
  element.replaceChildren();
  element.classList.toggle('is-error', tone === 'error');
  element.classList.toggle('is-reading', element.id === 'pdf-status' && tone === 'info' && /Reading scan/i.test(message));
  element.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  const lead = document.createElement('span');
  lead.textContent = message;
  element.append(lead);
  if (detail && detail !== message) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Details';
    const body = document.createElement('p');
    body.textContent = detail;
    details.append(summary, body);
    element.append(details);
  }
  const statement = element.id === 'pdf-status' ? element.closest('section') : null;
  if (statement) {
    statement.setAttribute('aria-busy', element.classList.contains('is-reading') ? 'true' : 'false');
  }
}

function showFailure(element: HTMLElement, error: unknown): void {
  const shown = presentError(error);
  setStatus(element, shown.message, 'error', shown.detail);
}

function presentError(error: unknown): { message: string; detail: string | null } {
  if (error instanceof UserFacingError) {
    return { message: error.message, detail: error.detail };
  }
  const raw = errorMessage(error);
  if (/https?:\/\/|AI\/fetch-error|App Check token|fetch-error/i.test(raw)) {
    return { message: CLOUD_FAILED_ALERT, detail: safeTechnicalDetail(raw) };
  }
  return { message: raw, detail: null };
}

function technicalDetails(
  analysis: Awaited<ReturnType<typeof analyzeTransactions>>,
  insights: Awaited<ReturnType<typeof createInsights>>,
): string | null {
  const parts = [
    ...analysis.calls.map((call) => call.technicalDetail),
    insights.detail,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join('\n\n') : null;
}

function focusElement(element: HTMLElement): void {
  if (!element.hasAttribute('tabindex')) {
    element.tabIndex = -1;
  }
  element.focus();
}

function bindOffline(): void {
  const render = (): void => {
    const online = isBrowserOnline();
    offlineStatus.hidden = online;
    offlineStatus.textContent = online
      ? ''
      : 'Offline. Text statements still parse, categorize, and summarize on this device. Cloud calls are paused.';
    offlineStatus.className = 'banner is-offline';
  };
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  render();
}

function renderPages(pages: string[][]): void {
  pdfLines.replaceChildren();
  pages.forEach((lines, index) => {
    const section = document.createElement('section');
    section.className = 'page';
    const heading = document.createElement('h3');
    heading.textContent = `Page ${index + 1}`;
    const list = document.createElement('ol');
    const rendered = lines.length > 0 ? lines : ['(no text)'];
    for (const line of rendered) {
      const item = document.createElement('li');
      item.dir = 'auto';
      item.textContent = line;
      list.append(item);
    }
    section.append(heading, list);
    pdfLines.append(section);
  });
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element;
}

function requireButton(id: string): HTMLButtonElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`#${id} is not a button`);
  }
  return element;
}

function requireInput(id: string): HTMLInputElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`#${id} is not an input`);
  }
  return element;
}

function requireSelect(id: string): HTMLSelectElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`#${id} is not a select`);
  }
  return element;
}
