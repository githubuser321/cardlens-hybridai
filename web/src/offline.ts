export function readOnline(nav: { onLine?: boolean } | undefined): boolean {
  return nav?.onLine !== false;
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return readOnline(navigator);
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out while offline'));
    }, ms);
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}
