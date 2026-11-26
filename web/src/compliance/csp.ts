/**
 * Production Content-Security-Policy.
 * The entry script for reCAPTCHA is www.recaptcha.net. The widget still loads
 * supporting files from gstatic and may contact google.com; those hosts stay
 * allowed so App Check can complete. Dev (`npm run dev`) does not send this
 * policy, because Vite's hot reload needs a looser page.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'self' https://www.recaptcha.net https://www.gstatic.com https://www.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://www.recaptcha.net https://www.google.com https://*.googleapis.com",
  "frame-src https://www.recaptcha.net https://www.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');
