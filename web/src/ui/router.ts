export type AppView = 'home' | 'results' | 'settings';

const VIEWS: readonly AppView[] = ['home', 'results', 'settings'];

export function viewFromHash(hash: string): AppView {
  const name = hash.replace(/^#/, '').split(/[/?]/)[0];
  if (name === 'results' || name === 'settings') {
    return name;
  }
  return 'home';
}

/** Show Home, then scroll the drop zone to the center and focus it. */
export function focusUploadZone(zone: HTMLElement, root: ParentNode = document): void {
  applyAppView('home', root);
  const reduced = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = (): void => {
    zone.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    zone.focus({ preventScroll: true });
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(reveal);
    return;
  }
  reveal();
}

export function applyAppView(view: AppView, root: ParentNode = document): void {
  for (const name of VIEWS) {
    const panel = root.querySelector(`#view-${name}`);
    if (panel instanceof HTMLElement) {
      panel.hidden = name !== view;
    }
    const tab = root.querySelector(`#nav-${name}`);
    if (tab instanceof HTMLElement) {
      const selected = name === view;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      if (selected && name === 'results') {
        tab.classList.remove('has-new');
      }
    }
  }
}

export function bindAppNav(root: ParentNode = document): void {
  const tabs = [...root.querySelectorAll<HTMLElement>('#app-nav [role="tab"]')];
  let keyboardTab: HTMLElement | null = null;

  const focusTab = (tab: HTMLElement): void => {
    tab.focus({ preventScroll: true });
  };
  const scrollViewToTop = (): void => {
    window.scrollTo(0, 0);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }
      event.preventDefault();
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const next = tabs[(index + (forward ? 1 : -1) + tabs.length) % tabs.length];
      if (!next) {
        return;
      }
      keyboardTab = next;
      if (next instanceof HTMLAnchorElement && next.hash) {
        applyAppView(viewFromHash(next.hash), root);
        if (window.location.hash !== next.hash) {
          window.location.hash = next.hash;
        }
      }
      focusTab(next);
      scrollViewToTop();
    });
  });
  window.addEventListener('hashchange', () => {
    applyAppView(viewFromHash(window.location.hash), root);
    const tab = keyboardTab;
    keyboardTab = null;
    if (!tab) {
      return;
    }
    scrollViewToTop();
    focusTab(tab);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => focusTab(tab));
    }
  });
  if (!window.location.hash) {
    window.location.hash = '#home';
  }
  applyAppView(viewFromHash(window.location.hash), root);
}

export function showResultsView(): void {
  const tab = document.getElementById('nav-results');
  tab?.classList.add('has-new');
  const announce = document.getElementById('results-ready');
  if (announce) {
    announce.textContent = 'Results ready';
  }
  applyAppView('results');
  if (window.location.hash !== '#results') {
    window.location.hash = '#results';
  }
  const heading = document.getElementById('summary-heading');
  if (heading instanceof HTMLElement) {
    heading.tabIndex = -1;
    heading.focus();
  }
}
