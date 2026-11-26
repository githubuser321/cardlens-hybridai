import { cloudBlockedMessage, decideCloudFallback, type CloudGateDecision } from '../compliance/cloud-gate';
import { gateAllowsHybrid } from '../compliance/inference-mode';
import { clearBrowserData } from '../compliance/clear-browser';
import {
  CLEAR_UI_BUDGET_MS,
  ClearStepTimeoutError,
  withStepTimeout,
  type ClearDataResult,
} from '../compliance/clear-data';
import {
  latestRecord,
  readConsent,
  readSessionConsent,
  recordConsentChoice,
  textCloudPermission,
  writeConsent,
  writeSessionConsent,
  type StoredConsent,
} from '../compliance/consent-store';
import {
  FIRST_RUN_CONTINUE_EN,
  FIRST_RUN_EN,
  FIRST_RUN_TEXT_VERSION,
  RECAPTCHA_LINE_EN,
  RECAPTCHA_MORE_EN,
} from '../compliance/copy';
import { readBrowserRegionSignals } from '../compliance/region';
import { readFirstRun, writeFirstRun } from '../i18n/locale';
import { legalDocument } from '../legal/documents';
import { PRIVACY_EMAIL } from '../legal/placeholders';
import { renderLegalDocument } from '../legal/render';
import { pageFromPath } from '../legal/route';
import { askImageConsent, askTextConsent } from './consent-dialog';
import { formatTimestamp } from './format';

export interface CloudDecision {
  enabled: boolean;
  regionAllowed: boolean;
  cloudFallbackEnabled: boolean;
  message: string;
  reason: CloudGateDecision['reason'] | 'offline' | 'app-check';
}

export interface ComplianceHandle {
  cloudDecision(online: boolean): CloudDecision;
  /** Text consent already stored for this tab. Does not open a dialog. */
  textConsentGranted(): boolean;
  setRemote(remote: { fetched: boolean; value: boolean | null }): void;
  requestTextConsent(preview: string): Promise<boolean>;
  requestImageConsent(previewUrl: string): Promise<boolean>;
  /** Records the first-run terms acknowledgement. Does not grant cloud consent. */
  acceptFirstRun(): void;
  reload(): void;
}

export function mountCompliance(options: {
  useCloud: () => boolean;
  onCleared: () => void;
  /** Test seam. Production uses the browser clear, which has its own step timeouts. */
  clearData?: () => Promise<ClearDataResult>;
  /** Runs after the person continues past Before you start. Does not grant cloud. */
  onTermsAccepted?: () => void;
}): ComplianceHandle {
  let remote = { fetched: false, value: null as boolean | null };
  const store = browserStore(localStorage);
  const sessionStore = browserStore(sessionStorage);
  let dismissingFirstRun = false;

  const continueButton = document.getElementById('first-run-continue');
  const agreeBox = document.getElementById('first-run-agree');
  agreeBox?.addEventListener('change', () => {
    syncContinue();
  });
  continueButton?.addEventListener('click', () => {
    dismissFirstRun();
  });
  continueButton?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    event.preventDefault();
    dismissFirstRun();
  });

  document.querySelectorAll<HTMLInputElement>('input[name="cloud-pref"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) {
        return;
      }
      const consent = readConsent(store);
      const preference = input.value === 'never' ? 'never' : 'ask';
      writeConsent(store, { ...consent, preference });
      if (preference === 'never') {
        writeSessionConsent(sessionStore, { text: 'off' });
      }
      paint();
    });
  });

  document.getElementById('session-cloud-off')?.addEventListener('click', () => {
    writeSessionConsent(sessionStore, { text: 'off' });
    paint();
  });

  const clearButton = document.getElementById('clear-data');
  const clearControl = clearButton instanceof HTMLButtonElement ? clearButton : null;
  const clearData = options.clearData ?? (() => clearBrowserData());
  clearButton?.addEventListener('click', () => {
    void onClear();
  });

  document.getElementById('session-cloud-on')?.addEventListener('click', () => {
    writeSessionConsent(sessionStore, { text: 'unset' });
    paint();
    const ask = document.getElementById('cloud-pref-ask');
    if (ask instanceof HTMLElement) {
      ask.focus();
    }
  });

  paint();

  return {
    cloudDecision(online: boolean): CloudDecision {
      if (!online) {
        return {
          enabled: false,
          regionAllowed: false,
          cloudFallbackEnabled: false,
          reason: 'offline',
          message: 'You are offline. Cloud analysis is paused. On-device analysis and keyword rules still run.',
        };
      }
      if (!options.useCloud()) {
        return {
          enabled: false,
          regionAllowed: false,
          cloudFallbackEnabled: false,
          reason: 'app-check',
          message: 'Cloud analysis is off until App Check is configured. On-device analysis and keyword rules still run. Nothing is sent.',
        };
      }
      const decision = decideCloudFallback({
        remoteFetched: remote.fetched,
        remoteValue: remote.value,
        signals: readBrowserRegionSignals(),
      });
      const flags = gateAllowsHybrid(decision.reason);
      return {
        enabled: decision.enabled,
        regionAllowed: flags.regionAllowed,
        cloudFallbackEnabled: flags.cloudFallbackEnabled,
        reason: decision.reason,
        message: cloudBlockedMessage(decision.reason),
      };
    },
    textConsentGranted() {
      return textCloudPermission(readConsent(store), readSessionConsent(sessionStore)) === 'allow';
    },
    setRemote(next) {
      remote = next;
      paint();
    },
    async requestTextConsent(preview: string) {
      const consent = readConsent(store);
      const session = readSessionConsent(sessionStore);
      const permission = textCloudPermission(consent, session);
      if (permission === 'deny') {
        return false;
      }
      if (permission === 'allow') {
        return true;
      }
      const granted = await askTextConsent({ preview });
      const next = recordConsentChoice(consent, {
        kind: 'cloud-text',
        decision: granted ? 'granted' : 'declined',
        at: new Date().toISOString(),
        locale: 'en',
      });
      writeConsent(store, next);
      writeSessionConsent(sessionStore, { text: granted ? 'granted' : 'off' });
      paint();
      return granted;
    },
    async requestImageConsent(previewUrl: string) {
      const consent = readConsent(store);
      if (consent.preference === 'never') {
        return false;
      }
      const granted = await askImageConsent({ previewUrl });
      writeConsent(store, recordConsentChoice(readConsent(store), {
        kind: 'cloud-image',
        decision: granted ? 'granted' : 'declined',
        at: new Date().toISOString(),
        locale: 'en',
      }));
      paint();
      return granted;
    },
    acceptFirstRun() {
      writeFirstRun(store, { continuedAt: new Date().toISOString(), textVersion: FIRST_RUN_TEXT_VERSION });
      const section = document.getElementById('first-run');
      if (section) {
        delete section.dataset.agreed;
      }
      paint();
    },
    reload() {
      paint();
    },
  };

  function termsAccepted(): boolean {
    const box = document.getElementById('first-run-agree');
    return box instanceof HTMLInputElement && box.checked;
  }

  function syncContinue(): void {
    const button = document.getElementById('first-run-continue');
    if (button instanceof HTMLButtonElement) {
      button.disabled = !termsAccepted();
    }
  }

  function dismissFirstRun(): void {
    if (dismissingFirstRun || !termsAccepted()) {
      return;
    }
    dismissingFirstRun = true;
    try {
      writeFirstRun(store, { continuedAt: new Date().toISOString(), textVersion: FIRST_RUN_TEXT_VERSION });
      const section = document.getElementById('first-run');
      if (section) {
        section.dataset.agreed = 'shown';
      }
      paint();
      moveFocusAfterFirstRun();
      options.onTermsAccepted?.();
    } finally {
      dismissingFirstRun = false;
    }
  }

  function paint(): void {
    paintChrome();
    paintFirstRun();
    paintSettings(readConsent(store));
    paintDeviceChoice(readConsent(store));
    paintLegal();
    const session = readSessionConsent(sessionStore);
    const sessionOff = document.getElementById('session-cloud-off');
    const sessionOn = document.getElementById('session-cloud-on');
    const sessionStatus = document.getElementById('session-cloud');
    if (sessionOff) {
      sessionOff.hidden = session.text !== 'granted';
    }
    if (sessionOn) {
      sessionOn.hidden = session.text !== 'off';
    }
    if (sessionStatus) {
      if (session.text === 'granted') {
        sessionStatus.hidden = false;
        sessionStatus.textContent = 'Redacted text may be sent during this tab session. You can turn that off.';
      } else if (session.text === 'off') {
        sessionStatus.hidden = false;
        sessionStatus.textContent = 'Cloud is off for this tab session.';
      } else {
        sessionStatus.hidden = true;
        sessionStatus.textContent = '';
      }
    }
  }

  async function onClear(): Promise<void> {
    const status = document.getElementById('clear-status');
    if (clearControl) {
      clearControl.disabled = true;
    }
    const section = document.getElementById('first-run');
    if (section) {
      delete section.dataset.agreed;
    }
    const box = document.getElementById('first-run-agree');
    if (box instanceof HTMLInputElement) {
      box.checked = false;
    }
    options.onCleared();
    if (status) {
      status.textContent = 'Clearing…';
    }
    try {
      const result = await withStepTimeout(clearData(), CLEAR_UI_BUDGET_MS, 'Clear my data');
      if (status) {
        const extra = result.partial
          ? 'Some saved browser data could not be removed. '
          : '';
        status.textContent = `Local data cleared. ${extra}Content already sent to Google is not deleted.`;
      }
    } catch (error) {
      if (status) {
        status.textContent = error instanceof ClearStepTimeoutError
          ? 'Clearing did not finish. Some data on this device may still be saved. Try again, or clear this site\'s data in the browser.'
          : (error instanceof Error && error.message ? error.message : 'Clear failed');
      }
    } finally {
      if (clearControl) {
        clearControl.disabled = false;
      }
      paint();
    }
  }
}

function moveFocusAfterFirstRun(): void {
  const agreed = document.getElementById('first-run-agreed');
  if (agreed instanceof HTMLElement && !agreed.hidden) {
    agreed.tabIndex = -1;
    agreed.focus();
    return;
  }
  const heading = document.getElementById('onboarding-heading');
  if (heading instanceof HTMLElement && heading.offsetParent !== null) {
    heading.tabIndex = -1;
    heading.focus();
    return;
  }
  const main = document.getElementById('main');
  if (main instanceof HTMLElement) {
    main.tabIndex = -1;
    main.focus();
  }
}

function paintChrome(): void {
  text('app-lede', 'See where your money goes');
  text('footer-studio', 'Dash Buddies Games');
  text('privacy-details-body', 'On the free tier, Google may use that text to improve its products. Cloud analysis is off when this browser looks like the EEA, the UK, or Switzerland.');
  text('scan-note', 'A scanned image cannot be redacted. It stays on this device unless on-device reading fails and you agree to send that image. The checkbox starts unchecked.');
  text('link-privacy', 'Privacy Policy');
  text('link-terms', 'Terms of Use');
  text('link-accessibility', 'Accessibility Statement');
  text('link-contact', 'Contact');
  const contact = document.getElementById('link-contact');
  if (contact instanceof HTMLAnchorElement) {
    contact.href = `mailto:${PRIVACY_EMAIL}`;
  }
  text('recaptcha-footer-line', RECAPTCHA_LINE_EN);
  text('recaptcha-footer-more', RECAPTCHA_MORE_EN);
  text('recaptcha-home-line', RECAPTCHA_LINE_EN);
  text('recaptcha-home-more', RECAPTCHA_MORE_EN);
  text('recaptcha-results-line', RECAPTCHA_LINE_EN);
  text('recaptcha-results-more', RECAPTCHA_MORE_EN);
  const nav = document.getElementById('legal-nav');
  if (nav) {
    nav.setAttribute('aria-label', 'Legal');
  }
  text('settings-heading', 'Settings');
  text('cloud-pref-legend', 'Cloud analysis');
  text('cloud-pref-ask-label', 'Always ask');
  text('cloud-pref-never-label', 'Never use cloud');
  text('clear-data', 'Clear my data');
  text('session-cloud-off', 'Turn off cloud for this session');
  text('session-cloud-on', 'Turn cloud back on');
  text('what-is-sent-heading', 'What is sent to the cloud');
  text('footer-blurb', 'Card numbers, IDs, phones, emails, bank details, the cardholder name, and the address are stripped on this device before text is sent. An image is not redacted. Nothing is sent without consent, and a failed call is not retried with the original text.');
}

function paintFirstRun(): void {
  const section = document.getElementById('first-run');
  if (!section) {
    return;
  }
  const seen = readFirstRun(browserStore(localStorage));
  const form = document.getElementById('first-run-form');
  const agreed = document.getElementById('first-run-agreed');
  text('first-run-heading', 'Before you start');
  text('first-run-agreed', 'Agreed.');
  const copy = document.getElementById('first-run-text');
  if (copy) {
    copy.replaceChildren();
    appendFirstRun(copy, FIRST_RUN_EN);
  }
  text('first-run-continue', FIRST_RUN_CONTINUE_EN);
  if (!seen) {
    section.hidden = false;
    if (form) {
      form.hidden = false;
    }
    if (agreed) {
      agreed.hidden = true;
    }
    const button = document.getElementById('first-run-continue');
    const box = document.getElementById('first-run-agree');
    if (button instanceof HTMLButtonElement) {
      button.disabled = !(box instanceof HTMLInputElement && box.checked);
    }
    return;
  }
  const showAgreed = section.dataset.agreed === 'shown';
  if (showAgreed) {
    section.hidden = false;
    if (form) {
      form.hidden = true;
    }
    if (agreed) {
      agreed.hidden = false;
    }
    return;
  }
  section.hidden = true;
}

function appendFirstRun(container: HTMLElement, sentence: string): void {
  const termsLabel = 'Terms';
  const privacyLabel = 'Privacy Policy';
  const termsAt = sentence.indexOf(termsLabel);
  const privacyAt = sentence.indexOf(privacyLabel);
  if (termsAt < 0 || privacyAt < 0) {
    container.textContent = sentence;
    return;
  }
  const first = Math.min(termsAt, privacyAt);
  const second = Math.max(termsAt, privacyAt);
  const firstLabel = first === termsAt ? termsLabel : privacyLabel;
  const secondLabel = second === termsAt ? termsLabel : privacyLabel;
  const firstHref = firstLabel === termsLabel ? '/terms' : '/privacy';
  const secondHref = secondLabel === termsLabel ? '/terms' : '/privacy';
  container.append(document.createTextNode(sentence.slice(0, first)));
  container.append(anchor(firstHref, firstLabel));
  container.append(document.createTextNode(sentence.slice(first + firstLabel.length, second)));
  container.append(anchor(secondHref, secondLabel));
  container.append(document.createTextNode(sentence.slice(second + secondLabel.length)));
}

function paintSettings(consent: StoredConsent): void {
  const ask = document.getElementById('cloud-pref-ask');
  const never = document.getElementById('cloud-pref-never');
  if (ask instanceof HTMLInputElement && never instanceof HTMLInputElement) {
    ask.checked = consent.preference !== 'never';
    never.checked = consent.preference === 'never';
  }
  const status = document.getElementById('consent-status');
  if (!status) {
    return;
  }
  const textRecord = latestRecord(consent, 'cloud-text');
  const imageRecord = latestRecord(consent, 'cloud-image');
  const parts = [
    `Saved choice: ${consent.preference === 'never' ? 'Never use cloud' : 'Always ask'}.`,
  ];
  if (textRecord) {
    parts.push(`Last text choice: ${textRecord.decision}, ${formatTimestamp(textRecord.at)}.`);
  }
  if (imageRecord) {
    parts.push(`Last image choice: ${imageRecord.decision}, ${formatTimestamp(imageRecord.at)}.`);
  }
  parts.push(`Contact: ${PRIVACY_EMAIL} (privacy, accessibility, and general contact).`);
  status.textContent = parts.join(' ');
}

function paintDeviceChoice(consent: StoredConsent): void {
  const note = document.getElementById('device-choice');
  if (!note) {
    return;
  }
  const record = latestRecord(consent, 'cloud-text');
  note.hidden = record?.decision !== 'declined';
}

function paintLegal(): void {
  const page = pageFromPath(window.location.pathname);
  const app = document.getElementById('app-screens');
  const root = document.getElementById('legal-root');
  if (app) {
    app.hidden = page !== 'app';
  }
  if (!root) {
    return;
  }
  root.replaceChildren();
  if (page === 'app') {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  root.lang = 'en';
  root.dir = 'ltr';
  root.append(renderLegalDocument(legalDocument(page)));
  if (window.location.hash) {
    const target = root.querySelector(window.location.hash);
    if (target instanceof HTMLElement) {
      target.tabIndex = -1;
      target.focus();
    }
  }
}

function anchor(href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  return link;
}

function text(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function browserStore(store: Storage | undefined): Storage | null {
  try {
    return store ?? null;
  } catch {
    return null;
  }
}
