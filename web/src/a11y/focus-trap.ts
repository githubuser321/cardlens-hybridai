const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    return element.tabIndex >= 0;
  });
}

/** Keeps Tab and Shift+Tab inside `container` until `release` is called. */
export function trapFocus(container: HTMLElement): { release: () => void } {
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
      return;
    }
    const items = focusableElements(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKey);
  return {
    release() {
      document.removeEventListener('keydown', onKey);
    },
  };
}
