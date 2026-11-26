import { describe, expect, it } from 'vitest';
import { CLOUD_FAILED_ALERT } from '../compliance/cloud-outcome';
import {
  badgeForCloudAsk,
  cloudAskFrom,
  composeAnalysisCopy,
  notSentMentions,
} from './analysis-status';

describe('cloud failure copy', () => {
  it('shows one friendly alert and keeps the raw error out of that sentence', () => {
    const ask = cloudAskFrom({
      outcomes: ['failed'],
      sentToCloud: false,
      insightsOutcome: 'failed',
    });
    const copy = composeAnalysisCopy({
      label: 'March statement',
      count: 4,
      sources: ['RULES'],
      cloudAsk: ask,
      insightsSentence: 'Insights were written on this device from local rules.',
    });
    expect(ask).toBe('failed');
    expect(copy.alert).toBe(CLOUD_FAILED_ALERT);
    expect(copy.alert).not.toMatch(/https?:\/\/|App Check token|fetch-error/);
    expect(copy.status).not.toMatch(/https?:\/\/|App Check token/);
    expect(notSentMentions(`${copy.status} ${copy.alert ?? ''}`)).toBe(1);
    expect(badgeForCloudAsk(ask).label).toBe('Cloud unavailable');
  });

  it('uses a different badge for declined, never asked, and sent', () => {
    expect(cloudAskFrom({ outcomes: ['declined'], sentToCloud: false, insightsOutcome: 'declined' })).toBe('declined');
    expect(badgeForCloudAsk('declined').label).toBe('Nothing left your device');

    const quiet = composeAnalysisCopy({
      label: 'March statement',
      count: 2,
      sources: ['RULES'],
      cloudAsk: 'not-asked',
      insightsSentence: 'Insights were written on this device from local rules.',
    });
    expect(quiet.alert).toBeNull();
    expect(quiet.status).toBe('March statement: 2 transactions sorted on this device. Nothing was sent.');
    expect(notSentMentions(quiet.status)).toBe(1);
    expect(badgeForCloudAsk('not-asked').label).toBe('Analyzed on your device');

    const sent = composeAnalysisCopy({
      label: 'March statement',
      count: 2,
      sources: ['IN_CLOUD'],
      cloudAsk: 'sent',
      insightsSentence: 'Cloud insights used the redacted aggregate.',
    });
    expect(sent.alert).toBeNull();
    expect(notSentMentions(sent.status)).toBe(0);
    expect(badgeForCloudAsk('sent').label).toMatch(/cloud/i);
  });
});
