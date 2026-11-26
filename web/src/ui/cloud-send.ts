export const CLOUD_SEND_TIMEOUT_MS = 30_000;
export const CLOUD_SEND_IDLE_LABEL = 'Improve with Cloud AI';
export const CLOUD_SEND_PENDING_LABEL = 'Sending to Cloud AI…';
export const CLOUD_SEND_PENDING_DETAIL = 'The results below are still from this device. You can keep reading them.';
export const CLOUD_SEND_SUCCESS_TITLE = 'Cloud AI results ready';
export const CLOUD_SEND_SUCCESS_DETAIL = 'The summary now includes the cloud result. Your previous totals stayed on screen the whole time.';
export const CLOUD_SEND_TIMEOUT_MESSAGE = 'Cloud AI took too long.';
export const CLOUD_SEND_ERROR_MESSAGE = 'Cloud AI did not finish.';
export const CLOUD_SEND_ERROR_TITLE = 'Cloud analysis didn\'t work this time';
export const CLOUD_SEND_ERROR_BODY = 'Your on-device results are still here. You can try again.';

export type CloudSendPhase = 'idle' | 'pending' | 'success' | 'error';

export interface CloudSendElements {
  button: HTMLButtonElement;
  label: HTMLElement;
  spinner: HTMLElement;
  banner: HTMLElement;
  title: HTMLElement;
  detail: HTMLElement;
  retry: HTMLButtonElement;
  dismiss: HTMLButtonElement;
  technical: HTMLDetailsElement | null;
  technicalBody: HTMLElement | null;
}

export interface CloudSendSession {
  startPending(): number;
  succeed(ticket: number): void;
  fail(ticket: number, message?: string): void;
  dismiss(): void;
  phase(): CloudSendPhase;
}

/** Dev-only. Production builds drop this because DEV is false. */
export interface CloudBannerInput {
  modelInvoked: boolean;
  callOutcomes: readonly string[];
  callDetail: string | null;
  sentToCloud: boolean;
  sources: readonly string[];
  insightsOutcome: string;
}

/** Banner follows the finished call. A completed on-device result is not a failure. */
export function cloudBannerOutcome(input: CloudBannerInput): { ok: boolean; message: string | null } {
  const failed = input.callOutcomes.includes('failed')
    || input.callOutcomes.includes('blocked')
    || input.callOutcomes.includes('declined')
    || input.insightsOutcome === 'failed'
    || input.insightsOutcome === 'blocked'
    || input.insightsOutcome === 'declined';
  const finished = input.callOutcomes.includes('ok')
    || input.insightsOutcome === 'ok'
    || input.sentToCloud
    || input.sources.includes('IN_CLOUD')
    || input.sources.includes('ON_DEVICE');
  if (!failed && finished) {
    return { ok: true, message: null };
  }
  if (failed) {
    return { ok: false, message: input.callDetail || CLOUD_SEND_ERROR_MESSAGE };
  }
  if (!input.modelInvoked) {
    return { ok: false, message: 'Cloud AI did not start.' };
  }
  return { ok: false, message: CLOUD_SEND_ERROR_MESSAGE };
}

export function devCloudFailureRequested(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  return /fail-cloud/.test(`${window.location.search}${window.location.hash}`);
}

export function cloudSendElements(root: ParentNode): CloudSendElements | null {
  const button = root.querySelector('#improve-cloud');
  const label = root.querySelector('#improve-cloud-label');
  const spinner = root.querySelector('#improve-cloud-spinner');
  const banner = root.querySelector('#cloud-send');
  const title = root.querySelector('#cloud-send-title');
  const detail = root.querySelector('#cloud-send-detail');
  const retry = root.querySelector('#cloud-send-retry');
  const dismiss = root.querySelector('#cloud-send-dismiss');
  const technical = root.querySelector('#cloud-send-tech');
  const technicalBody = root.querySelector('#cloud-send-tech-body');
  if (
    !(button instanceof HTMLButtonElement)
    || !(label instanceof HTMLElement)
    || !(spinner instanceof HTMLElement)
    || !(banner instanceof HTMLElement)
    || !(title instanceof HTMLElement)
    || !(detail instanceof HTMLElement)
    || !(retry instanceof HTMLButtonElement)
    || !(dismiss instanceof HTMLButtonElement)
  ) {
    return null;
  }
  return {
    button,
    label,
    spinner,
    banner,
    title,
    detail,
    retry,
    dismiss,
    technical: technical instanceof HTMLDetailsElement ? technical : null,
    technicalBody: technicalBody instanceof HTMLElement ? technicalBody : null,
  };
}

export function applyCloudSendPhase(els: CloudSendElements, phase: CloudSendPhase, detail = ''): void {
  const busy = phase === 'pending';
  els.button.disabled = busy;
  els.button.setAttribute('aria-busy', busy ? 'true' : 'false');
  els.button.setAttribute('aria-disabled', busy ? 'true' : 'false');
  els.label.textContent = busy ? CLOUD_SEND_PENDING_LABEL : CLOUD_SEND_IDLE_LABEL;
  els.spinner.hidden = !busy;
  els.banner.hidden = phase === 'idle';
  els.banner.classList.toggle('is-error', phase === 'error');
  els.banner.classList.toggle('is-success', phase === 'success');
  els.retry.hidden = phase !== 'error';
  els.dismiss.hidden = phase !== 'success';
  const technical = detail && detail !== CLOUD_SEND_ERROR_MESSAGE && detail !== CLOUD_SEND_TIMEOUT_MESSAGE
    ? detail
    : '';
  if (els.technical) {
    els.technical.hidden = phase !== 'error' || technical.length === 0;
    els.technical.open = false;
  }
  if (els.technicalBody) {
    els.technicalBody.textContent = technical;
  }
  const status = els.banner.ownerDocument.getElementById('analysis-status');
  if (status) {
    status.hidden = phase === 'pending';
  }
  if (phase === 'pending') {
    els.title.textContent = CLOUD_SEND_PENDING_LABEL;
    els.detail.textContent = CLOUD_SEND_PENDING_DETAIL;
  } else if (phase === 'success') {
    els.title.textContent = CLOUD_SEND_SUCCESS_TITLE;
    els.detail.textContent = CLOUD_SEND_SUCCESS_DETAIL;
  } else if (phase === 'error') {
    els.title.textContent = CLOUD_SEND_ERROR_TITLE;
    els.detail.textContent = CLOUD_SEND_ERROR_BODY;
  }
}

export function createCloudSendSession(
  els: CloudSendElements,
  options: {
    timeoutMs?: number;
    setTimer?: (callback: () => void, ms: number) => number;
    clearTimer?: (id: number) => void;
    onDismissed?: () => void;
    onTimeout?: () => void;
  } = {},
): CloudSendSession {
  const timeoutMs = options.timeoutMs ?? CLOUD_SEND_TIMEOUT_MS;
  const setTimer = options.setTimer ?? ((callback, ms) => window.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id));
  let phase: CloudSendPhase = 'idle';
  let ticket = 0;
  let timer: number | null = null;
  let hideTimer: number | null = null;

  function clearTimers(): void {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (hideTimer !== null) {
      clearTimer(hideTimer);
      hideTimer = null;
    }
  }

  function show(next: CloudSendPhase, message = ''): void {
    phase = next;
    applyCloudSendPhase(els, next, message);
  }

  return {
    startPending() {
      clearTimers();
      ticket += 1;
      const current = ticket;
      show('pending');
      timer = setTimer(() => {
        if (current !== ticket || phase !== 'pending') {
          return;
        }
        timer = null;
        options.onTimeout?.();
        show('error', CLOUD_SEND_TIMEOUT_MESSAGE);
      }, timeoutMs);
      return current;
    },
    succeed(current) {
      if (current !== ticket || (phase !== 'pending' && phase !== 'error')) {
        return;
      }
      clearTimers();
      show('success');
      hideTimer = setTimer(() => {
        if (ticket === current && phase === 'success') {
          show('idle');
          options.onDismissed?.();
        }
      }, 8000);
    },
    fail(current, message = CLOUD_SEND_ERROR_MESSAGE) {
      if (current !== ticket || (phase !== 'pending' && phase !== 'error')) {
        return;
      }
      clearTimers();
      show('error', message);
    },
    dismiss() {
      if (phase !== 'success') {
        return;
      }
      clearTimers();
      show('idle');
      options.onDismissed?.();
    },
    phase: () => phase,
  };
}
