export interface LanguageModelAvailability {
  availability(options?: {
    expectedInputs?: { type: string; languages?: string[] }[];
  }): Promise<string>;
}

/** True only when the on-device model is already downloaded and can run a prompt. */
export async function isOnDeviceModelAvailable(
  languageModel: LanguageModelAvailability | undefined = readLanguageModel(),
): Promise<boolean> {
  if (!languageModel) {
    return false;
  }
  try {
    const status = await languageModel.availability({
      expectedInputs: [
        { type: 'image' },
        { type: 'text', languages: ['en'] },
      ],
    });
    return status === 'available';
  } catch {
    return false;
  }
}

function readLanguageModel(): LanguageModelAvailability | undefined {
  const host = globalThis as { LanguageModel?: LanguageModelAvailability };
  return host.LanguageModel;
}
