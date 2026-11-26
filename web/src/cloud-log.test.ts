import { describe, expect, it } from 'vitest';
import { cloudLogSummary, createCloudLog } from './cloud-log';

const emptyReport = { findings: [], total: 0 };

describe('cloud log', () => {
  it('records every payload with the source and timestamp', () => {
    const now = new Date('2026-04-01T12:00:00.000Z');
    const log = createCloudLog(() => now);
    log.record({
      purpose: 'insights',
      inferenceSource: 'IN_CLOUD',
      sentToCloud: true,
      report: {
        findings: [{ kind: 'name', count: 1, placeholder: '[REDACTED_NAME]' }],
        total: 1,
      },
      payloadText: '{"subscriptions":[{"merchant":"[REDACTED_NAME]"}]}',
      note: 'Insights prompt.',
    });
    log.record({
      purpose: 'categorization',
      inferenceSource: 'RULES',
      sentToCloud: false,
      report: emptyReport,
      payloadText: '{"merchants":["NETFLIX.COM"]}',
      note: 'Stayed on device.',
      at: '2026-04-01T12:01:00.000Z',
    });
    const entries = log.list();
    expect(entries.map((entry) => [entry.purpose, entry.inferenceSource, entry.sentToCloud, entry.at])).toEqual([
      ['insights', 'IN_CLOUD', true, '2026-04-01T12:00:00.000Z'],
      ['categorization', 'RULES', false, '2026-04-01T12:01:00.000Z'],
    ]);
    expect(entries[0]?.payloadText).toContain('[REDACTED_NAME]');
    expect(entries[0]?.report.total).toBe(1);
    expect(cloudLogSummary(entries)).toMatch(/2 redacted payloads/);
    expect(cloudLogSummary(entries)).toMatch(/1 was sent/);
    expect(cloudLogSummary([])).toMatch(/Nothing has been sent/);
  });
});
