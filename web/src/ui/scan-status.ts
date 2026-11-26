/** Show the reading spinner and let the browser paint it before a dialog opens. */
export function markReadingScan(element: HTMLElement, label: string): void {
  element.replaceChildren();
  element.classList.remove('is-error');
  element.classList.add('is-reading');
  element.setAttribute('role', 'status');
  const lead = document.createElement('span');
  lead.textContent = `Reading scan ${label}…`;
  element.append(lead);
  const section = element.closest('section');
  if (section) {
    section.setAttribute('aria-busy', 'true');
  }
}

export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}
