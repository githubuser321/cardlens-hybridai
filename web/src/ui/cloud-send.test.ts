// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUD_SEND_ERROR_BODY,
  CLOUD_SEND_ERROR_MESSAGE,
  CLOUD_SEND_ERROR_TITLE,
  CLOUD_SEND_IDLE_LABEL,
  CLOUD_SEND_PENDING_DETAIL,
  CLOUD_SEND_PENDING_LABEL,
  CLOUD_SEND_SUCCESS_TITLE,
  applyCloudSendPhase,
  cloudBannerOutcome,
  cloudSendElements,
  createCloudSendSession,
  devCloudFailureRequested,
} from './cloud-send';

function mountApp(): void {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';
}

function elements() {
  const els = cloudSendElements(document);
  if (!els) {
    throw new Error('cloud send markup missing');
  }
  return els;
}

describe('cloud send state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows a busy pending state and keeps the local-results note', () => {
    mountApp();
    const els = elements();
    applyCloudSendPhase(els, 'pending');
    expect(els.button.disabled).toBe(true);
    expect(els.button.getAttribute('aria-busy')).toBe('true');
    expect(els.button.getAttribute('aria-disabled')).toBe('true');
    expect(els.label.textContent).toBe(CLOUD_SEND_PENDING_LABEL);
    expect(els.spinner.hidden).toBe(false);
    expect(els.banner.hidden).toBe(false);
    expect(els.banner.getAttribute('role')).toBe('status');
    expect(els.banner.getAttribute('aria-live')).toBe('polite');
    expect(els.title.textContent).toBe(CLOUD_SEND_PENDING_LABEL);
    expect(els.detail.textContent).toBe(CLOUD_SEND_PENDING_DETAIL);
    expect(els.retry.hidden).toBe(true);
  });

  it('confirms success and restores the button', () => {
    mountApp();
    const els = elements();
    const session = createCloudSendSession(els, {
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    const ticket = session.startPending();
    session.succeed(ticket);
    expect(session.phase()).toBe('success');
    expect(els.title.textContent).toBe(CLOUD_SEND_SUCCESS_TITLE);
    expect(els.button.disabled).toBe(false);
    expect(els.label.textContent).toBe(CLOUD_SEND_IDLE_LABEL);
    expect(els.spinner.hidden).toBe(true);
    expect(els.dismiss.hidden).toBe(false);
    session.dismiss();
    expect(session.phase()).toBe('idle');
    expect(els.banner.hidden).toBe(true);
  });

  it('shows an error with Retry and restores the button', () => {
    mountApp();
    const els = elements();
    const session = createCloudSendSession(els, {
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    const ticket = session.startPending();
    session.fail(ticket, CLOUD_SEND_ERROR_MESSAGE);
    expect(session.phase()).toBe('error');
    expect(els.title.textContent).toBe(CLOUD_SEND_ERROR_TITLE);
    expect(els.detail.textContent).toBe(CLOUD_SEND_ERROR_BODY);
    expect(els.technical?.hidden).toBe(true);
    expect(els.retry.hidden).toBe(false);
    expect(els.retry.textContent).toBe('Retry');
    expect(els.button.disabled).toBe(false);
    expect(els.button.getAttribute('aria-busy')).toBe('false');
    expect(els.label.textContent).toBe(CLOUD_SEND_IDLE_LABEL);
  });

  it('shows a timeout without dropping a cloud result that arrives later', () => {
    vi.useFakeTimers();
    mountApp();
    const els = elements();
    const session = createCloudSendSession(els);
    const ticket = session.startPending();
    vi.advanceTimersByTime(30_000);
    expect(session.phase()).toBe('error');
    expect(els.title.textContent).toBe(CLOUD_SEND_ERROR_TITLE);
    expect(els.detail.textContent).toBe(CLOUD_SEND_ERROR_BODY);
    expect(els.technical?.hidden).toBe(true);
    expect(els.retry.hidden).toBe(false);
    session.succeed(ticket);
    expect(session.phase()).toBe('success');
    expect(els.title.textContent).toBe(CLOUD_SEND_SUCCESS_TITLE);
  });

  it('treats a finished on-device call as success and a real failure as an error', () => {
    expect(cloudBannerOutcome({
      modelInvoked: true,
      callOutcomes: ['ok'],
      callDetail: null,
      sentToCloud: false,
      sources: ['ON_DEVICE'],
      insightsOutcome: 'ok',
    })).toEqual({ ok: true, message: null });
    const appCheck = 'App Check did not return a usable token, so the cloud model was not called. (app-check/recaptcha-error)';
    expect(cloudBannerOutcome({
      modelInvoked: true,
      callOutcomes: ['failed'],
      callDetail: appCheck,
      sentToCloud: false,
      sources: ['RULES'],
      insightsOutcome: 'failed',
    })).toEqual({ ok: false, message: appCheck });
    expect(cloudBannerOutcome({
      modelInvoked: false,
      callOutcomes: [],
      callDetail: null,
      sentToCloud: false,
      sources: ['RULES'],
      insightsOutcome: 'skipped',
    })).toEqual({ ok: false, message: 'Cloud AI did not start.' });
    mountApp();
    const els = elements();
    const status = document.getElementById('analysis-status');
    if (status) {
      status.textContent = 'Parsing demo-statement.pdf…';
      status.hidden = false;
    }
    applyCloudSendPhase(els, 'pending');
    expect(status?.hidden).toBe(true);
    applyCloudSendPhase(els, 'error', appCheck);
    expect(els.title.textContent).toBe(CLOUD_SEND_ERROR_TITLE);
    expect(els.detail.textContent).toBe(CLOUD_SEND_ERROR_BODY);
    expect(els.detail.textContent).not.toContain('App Check');
    expect(els.technical?.hidden).toBe(false);
    expect(els.technical?.open).toBe(false);
    expect(els.technicalBody?.textContent).toContain('app-check/recaptcha-error');
    expect(status?.hidden).toBe(false);
  });

  it('honors the dev failure flag only while this build is a dev build', () => {
    window.history.pushState(null, '', '/#results');
    expect(devCloudFailureRequested()).toBe(false);
    window.history.pushState(null, '', '/?fail-cloud=1#results');
    expect(devCloudFailureRequested()).toBe(import.meta.env.DEV === true);
  });
});
