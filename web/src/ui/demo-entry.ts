export interface DemoEntryActions {
  termsAccepted(): boolean;
  startDemo(): void;
  /** Opens the terms dialog. True only after an explicit checked agreement. */
  askTerms(): Promise<boolean>;
  /** Records the same first-run acknowledgement as Continue. Does not grant cloud. */
  acceptTerms(): void;
}

export interface DemoEntry {
  request(): void;
}

/**
 * Shared path for Try demo statement.
 * Missing terms open a dialog. The demo starts only after that explicit
 * agreement, and this path never grants cloud consent.
 */
export function createDemoEntry(actions: DemoEntryActions): DemoEntry {
  let asking = false;
  return {
    request() {
      if (actions.termsAccepted()) {
        actions.startDemo();
        return;
      }
      if (asking) {
        return;
      }
      asking = true;
      void actions.askTerms().then((agreed) => {
        asking = false;
        if (!agreed) {
          return;
        }
        actions.acceptTerms();
        if (!actions.termsAccepted()) {
          return;
        }
        actions.startDemo();
      }, () => {
        asking = false;
      });
    },
  };
}

/** Opens the existing cloud consent dialog, then re-runs only if the person agrees. */
export async function openCloudImprovement(input: {
  lines: readonly string[] | null;
  ask: (preview: string) => Promise<boolean>;
  run: () => Promise<void>;
}): Promise<void> {
  if (!input.lines || input.lines.length === 0) {
    return;
  }
  const granted = await input.ask(input.lines.join('\n').slice(0, 2000));
  if (!granted) {
    return;
  }
  await input.run();
}

export function wireDemoEntry(root: ParentNode, entry: DemoEntry): void {
  for (const id of ['load-demo', 'empty-demo']) {
    root.querySelector(`#${id}`)?.addEventListener('click', () => {
      entry.request();
    });
  }
}
