export type AppPage = 'app' | 'privacy' | 'terms' | 'accessibility';

export function pageFromPath(pathname: string): AppPage {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/privacy') {
    return 'privacy';
  }
  if (path === '/terms') {
    return 'terms';
  }
  if (path === '/accessibility') {
    return 'accessibility';
  }
  return 'app';
}
