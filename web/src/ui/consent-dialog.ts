import { trapFocus } from '../a11y/focus-trap';
import {
  CLOUD_IMAGE_BODY_EN,
  CLOUD_IMAGE_TITLE_EN,
  CLOUD_IMAGE_CANCEL_EN,
  CLOUD_IMAGE_CHECK_EN,
  CLOUD_IMAGE_SEND_EN,
  CLOUD_TEXT_BODY_EN,
  CLOUD_TEXT_KEEP_EN,
  CLOUD_TEXT_PREVIEW_EN,
  CLOUD_TEXT_PRIVACY_EN,
  CLOUD_TEXT_SEND_EN,
  CLOUD_TEXT_TITLE_EN,
  FIRST_RUN_EN,
  RECAPTCHA_LINE_EN,
  RECAPTCHA_MORE_EN,
} from '../compliance/copy';

export interface TextConsentOptions {
  preview: string;
  privacyHref?: string;
}

export interface ImageConsentOptions {
  previewUrl: string;
  privacyHref?: string;
}

let pending: Promise<unknown> = Promise.resolve();

/** One dialog at a time. Escape and the decline button both refuse the send. */
export function askTextConsent(options: TextConsentOptions): Promise<boolean> {
  const run = pending.then(() => openTextDialog(options));
  pending = run.then(() => undefined, () => undefined);
  return run;
}

export function askImageConsent(options: ImageConsentOptions): Promise<boolean> {
  const run = pending.then(() => openImageDialog(options));
  pending = run.then(() => undefined, () => undefined);
  return run;
}

export const DEMO_TERMS_AGREE_EN = 'Agree & try demo';
export const DEMO_TERMS_DECLINE_EN = 'Not now';
export const DEMO_TERMS_CHECK_EN = 'I agree to the Terms and acknowledge the Privacy Policy.';

/** Terms gate for Try demo. The checkbox starts unchecked. Decline does not record acceptance. */
export function askDemoTerms(): Promise<boolean> {
  const run = pending.then(() => openDemoTermsDialog());
  pending = run.then(() => undefined, () => undefined);
  return run;
}

function openTextDialog(options: TextConsentOptions): Promise<boolean> {
  return openDialog({
    labelledBy: 'consent-title',
    describedBy: 'consent-body',
    build(dialog, finish) {
      const title = document.createElement('h2');
      title.id = 'consent-title';
      title.textContent = CLOUD_TEXT_TITLE_EN;
      const body = document.createElement('p');
      body.id = 'consent-body';
      body.textContent = CLOUD_TEXT_BODY_EN;
      const links = document.createElement('p');
      links.className = 'dialog-links';
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'button-prominent';
      previewButton.textContent = CLOUD_TEXT_PREVIEW_EN;
      previewButton.setAttribute('aria-expanded', 'false');
      previewButton.setAttribute('aria-controls', 'consent-preview');
      const preview = document.createElement('pre');
      preview.id = 'consent-preview';
      preview.hidden = true;
      preview.textContent = options.preview;
      previewButton.addEventListener('click', () => {
        preview.hidden = !preview.hidden;
        previewButton.setAttribute('aria-expanded', preview.hidden ? 'false' : 'true');
      });
      const privacy = document.createElement('a');
      privacy.href = options.privacyHref ?? '/privacy';
      privacy.textContent = CLOUD_TEXT_PRIVACY_EN;
      links.append(previewButton, privacy);
      const decline = choiceButton(CLOUD_TEXT_KEEP_EN, () => finish(false), 'primary');
      const accept = choiceButton(CLOUD_TEXT_SEND_EN, () => finish(true), 'quiet');
      const actions = actionRow(decline, accept);
      dialog.append(title, body, links, preview, actions, recaptchaNote());
      return decline;
    },
    onEscape(finish) {
      finish(false);
    },
  });
}

function openDemoTermsDialog(): Promise<boolean> {
  return openDialog({
    labelledBy: 'demo-terms-title',
    describedBy: 'demo-terms-body',
    build(dialog, finish) {
      dialog.classList.add('dialog-terms');
      const title = document.createElement('h2');
      title.id = 'demo-terms-title';
      title.textContent = 'Before you start';
      const body = document.createElement('p');
      body.id = 'demo-terms-body';
      appendLinkedSentence(body, FIRST_RUN_EN);
      const checkLabel = document.createElement('label');
      checkLabel.className = 'check';
      checkLabel.htmlFor = 'demo-terms-check';
      const checkbox = document.createElement('input');
      checkbox.id = 'demo-terms-check';
      checkbox.type = 'checkbox';
      checkbox.checked = false;
      const checkText = document.createElement('span');
      appendLinkedSentence(checkText, DEMO_TERMS_CHECK_EN);
      checkLabel.append(checkbox, checkText);
      const decline = choiceButton(DEMO_TERMS_DECLINE_EN, () => finish(false), 'quiet');
      const accept = choiceButton(DEMO_TERMS_AGREE_EN, () => {
        if (!checkbox.checked) {
          return;
        }
        finish(true);
      }, 'primary');
      accept.id = 'demo-terms-agree';
      accept.disabled = true;
      checkbox.addEventListener('change', () => {
        accept.disabled = !checkbox.checked;
      });
      dialog.append(title, body, checkLabel, actionRow(decline, accept));
      return checkbox;
    },
    onEscape(finish) {
      finish(false);
    },
  });
}

function openImageDialog(options: ImageConsentOptions): Promise<boolean> {
  return openDialog({
    labelledBy: 'consent-title',
    describedBy: 'consent-body',
    build(dialog, finish) {
      const title = document.createElement('h2');
      title.id = 'consent-title';
      title.textContent = CLOUD_IMAGE_TITLE_EN;
      const body = document.createElement('p');
      body.id = 'consent-body';
      body.textContent = CLOUD_IMAGE_BODY_EN;
      const image = document.createElement('img');
      image.className = 'consent-image';
      image.alt = 'Statement image that would be sent to Google. It cannot be redacted.';
      image.src = options.previewUrl;
      const checkLabel = document.createElement('label');
      checkLabel.className = 'check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;
      const checkText = document.createElement('span');
      checkText.textContent = CLOUD_IMAGE_CHECK_EN;
      checkLabel.append(checkbox, checkText);
      const cancel = choiceButton(CLOUD_IMAGE_CANCEL_EN, () => finish(false));
      const send = choiceButton(CLOUD_IMAGE_SEND_EN, () => finish(true));
      send.disabled = true;
      checkbox.addEventListener('change', () => {
        send.disabled = !checkbox.checked;
      });
      const privacy = document.createElement('p');
      const privacyLink = document.createElement('a');
      privacyLink.href = options.privacyHref ?? '/privacy';
      privacyLink.textContent = CLOUD_TEXT_PRIVACY_EN;
      privacy.append(privacyLink);
      dialog.append(title, body, image, checkLabel, privacy, actionRow(cancel, send), recaptchaNote());
      return cancel;
    },
    onEscape(finish) {
      finish(false);
    },
  });
}

function openDialog(options: {
  labelledBy: string;
  describedBy: string;
  build: (dialog: HTMLElement, finish: (value: boolean) => void) => HTMLElement;
  onEscape: (finish: (value: boolean) => void) => void;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', options.labelledBy);
    dialog.setAttribute('aria-describedby', options.describedBy);
    dialog.lang = 'en';
    dialog.dir = 'ltr';
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      trap.release();
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      previous?.focus();
      resolve(value);
    };
    const initial = options.build(dialog, finish);
    const trap = trapFocus(dialog);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        options.onEscape(finish);
      }
    };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        options.onEscape(finish);
      }
    });
    backdrop.append(dialog);
    document.body.append(backdrop);
    initial.focus();
  });
}

function appendLinkedSentence(container: HTMLElement, sentence: string): void {
  const termsLabel = 'Terms';
  const privacyLabel = 'Privacy Policy';
  const termsAt = sentence.indexOf(termsLabel);
  const privacyAt = sentence.indexOf(privacyLabel);
  if (termsAt < 0 || privacyAt < 0) {
    container.textContent = sentence;
    return;
  }
  const first = Math.min(termsAt, privacyAt);
  const second = Math.max(termsAt, privacyAt);
  const firstLabel = first === termsAt ? termsLabel : privacyLabel;
  const secondLabel = second === termsAt ? termsLabel : privacyLabel;
  const firstHref = firstLabel === termsLabel ? '/terms' : '/privacy';
  const secondHref = secondLabel === termsLabel ? '/terms' : '/privacy';
  container.append(document.createTextNode(sentence.slice(0, first)));
  container.append(textLink(firstHref, firstLabel));
  container.append(document.createTextNode(sentence.slice(first + firstLabel.length, second)));
  container.append(textLink(secondHref, secondLabel));
  container.append(document.createTextNode(sentence.slice(second + secondLabel.length)));
}

function textLink(href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  return link;
}

function choiceButton(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'quiet' | 'choice' = 'choice',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = variant === 'primary'
    ? 'button-primary'
    : variant === 'quiet'
      ? 'button-quiet'
      : 'button-choice';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function actionRow(decline: HTMLButtonElement, accept: HTMLButtonElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'dialog-actions';
  row.append(decline, accept);
  return row;
}

function recaptchaNote(): HTMLParagraphElement {
  const note = document.createElement('p');
  note.className = 'recaptcha-note';
  note.append(document.createTextNode(RECAPTCHA_LINE_EN));
  note.append(document.createTextNode(' '));
  const link = document.createElement('a');
  link.href = '/privacy#security';
  link.textContent = RECAPTCHA_MORE_EN;
  note.append(link);
  return note;
}
