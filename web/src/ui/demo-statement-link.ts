/** Fictional English statement served from `web/public/demo`. */
export const DEMO_STATEMENT_PDF = '/demo/demo-statement.pdf';
export const DEMO_STATEMENT_NAME = 'demo-statement.pdf';

export function isDemoStatementFile(name: string): boolean {
  return name === DEMO_STATEMENT_NAME;
}

/** Shows or hides the control that opens the demo PDF in a new tab. */
export function setDemoStatementLink(root: ParentNode, visible: boolean): void {
  const holder = root.querySelector<HTMLElement>('#demo-statement-view');
  const link = root.querySelector<HTMLAnchorElement>('#view-demo-statement');
  if (link) {
    link.href = DEMO_STATEMENT_PDF;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  if (holder) {
    holder.hidden = !visible;
  }
}
