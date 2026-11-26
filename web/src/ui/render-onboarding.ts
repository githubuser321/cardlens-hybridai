import { onboardingCopy } from '../device/copy';
import type { DeviceAvailability } from '../device/availability';

export interface OnboardingView {
  availability: DeviceAvailability;
  nag: boolean;
  progress: number | null;
  error: string | null;
}

export function renderOnboarding(view: OnboardingView): void {
  const copy = onboardingCopy(view);
  const section = requireElement('onboarding');
  const compact = view.availability === 'not-supported';
  section.classList.toggle('is-compact', compact);
  section.setAttribute('aria-busy', copy.showProgress ? 'true' : 'false');

  const privacy = document.getElementById('onboarding-privacy');
  if (privacy) {
    privacy.hidden = compact;
  }

  const badge = requireElement('onboarding-badge');
  badge.className = 'tag';
  badge.dataset.state = copy.state;
  badge.textContent = copy.badge;

  const status = requireElement('onboarding-status');
  status.textContent = copy.status;
  status.classList.toggle('is-error', Boolean(view.error));

  const requirements = requireElement('onboarding-requirements');
  requirements.hidden = compact || copy.requirements === null;
  requirements.textContent = copy.requirements ?? '';

  const progressWrap = requireElement('onboarding-progress');
  progressWrap.hidden = !copy.showProgress;
  const meter = requireProgress('onboarding-meter');
  meter.value = copy.progressPercent;
  meter.textContent = `${copy.progressPercent}%`;
  meter.setAttribute('aria-valuenow', String(copy.progressPercent));
  meter.setAttribute('aria-valuetext', `${copy.progressPercent} percent`);

  const download = requireButton('download-model');
  download.textContent = copy.downloadLabel;
  download.disabled = !copy.downloadEnabled;
  download.hidden = !copy.showDownload;

  const dismiss = requireButton('dismiss-onboarding');
  dismiss.hidden = !copy.showDismiss;

  const actions = document.getElementById('onboarding-actions');
  if (actions) {
    actions.hidden = !copy.showDownload && !copy.showDismiss;
  }
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

function requireProgress(id: string): HTMLProgressElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLProgressElement)) {
    throw new Error(`#${id} is not a progress element`);
  }
  return element;
}
