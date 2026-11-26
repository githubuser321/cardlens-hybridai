import type { InferenceSourceTag } from './inference-source';
import type { RedactionReport } from './redact/redact';

export type CloudPurpose = 'categorization' | 'insights' | 'scan';

export interface CloudLogEntry {
  id: string;
  at: string;
  purpose: CloudPurpose;
  inferenceSource: InferenceSourceTag;
  sentToCloud: boolean;
  report: RedactionReport;
  payloadText: string;
  note: string;
  imagePreviewUrl: string | null;
}

export interface CloudLogInput {
  purpose: CloudPurpose;
  inferenceSource: InferenceSourceTag;
  sentToCloud: boolean;
  report: RedactionReport;
  payloadText: string;
  note: string;
  imagePreviewUrl?: string | null;
  at?: string;
}

export interface CloudLog {
  list(): readonly CloudLogEntry[];
  record(input: CloudLogInput): CloudLogEntry;
  clear(): void;
}

export function createCloudLog(now: () => Date = () => new Date()): CloudLog {
  const entries: CloudLogEntry[] = [];
  let nextId = 1;
  return {
    list: () => entries,
    clear() {
      entries.length = 0;
    },
    record(input: CloudLogInput): CloudLogEntry {
      const entry: CloudLogEntry = {
        id: String(nextId),
        at: input.at ?? now().toISOString(),
        purpose: input.purpose,
        inferenceSource: input.inferenceSource,
        sentToCloud: input.sentToCloud,
        report: input.report,
        payloadText: input.payloadText,
        note: input.note,
        imagePreviewUrl: input.imagePreviewUrl ?? null,
      };
      nextId += 1;
      entries.push(entry);
      return entry;
    },
  };
}

export function cloudLogSummary(entries: readonly CloudLogEntry[]): string {
  if (entries.length === 0) {
    return 'Nothing has been sent. Load a statement to record the redacted payload.';
  }
  const sent = entries.filter((entry) => entry.sentToCloud).length;
  const noun = entries.length === 1 ? 'payload' : 'payloads';
  if (sent === 0) {
    return `${entries.length} redacted ${noun} recorded. None were sent to the cloud.`;
  }
  const sentNoun = sent === 1 ? 'was' : 'were';
  return `${entries.length} redacted ${noun} recorded. ${sent} ${sentNoun} sent to the cloud.`;
}
