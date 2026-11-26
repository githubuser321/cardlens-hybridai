import {
  ACCESSIBILITY_EMAIL,
  CONTROLLER_NAME,
  DRAFT_NOTE_EN,
  LEGAL_UPDATED_EN,
  PRIVACY_EMAIL,
  REPO_URL,
} from './placeholders';
import type { LegalDocument } from './render';

const mailto = `mailto:${PRIVACY_EMAIL}`;
const accessMail = `mailto:${ACCESSIBILITY_EMAIL}`;

export function legalDocument(page: 'privacy' | 'terms' | 'accessibility'): LegalDocument {
  if (page === 'privacy') {
    return privacyEn();
  }
  if (page === 'terms') {
    return termsEn();
  }
  return accessEn();
}

function privacyEn(): LegalDocument {
  return {
    title: 'CardLens Privacy Policy',
    updatedLabel: `Last updated: ${LEGAL_UPDATED_EN}. Effective: ${LEGAL_UPDATED_EN}.`,
    disclaimer: DRAFT_NOTE_EN,
    sections: [
      {
        heading: 'Short version',
        paragraphs: [
          'CardLens has **no user accounts** and **we do not run our own server that stores your statements or results.**',
          'By default, analysis runs **on your device** using Google\'s Gemini Nano model built into Chrome, or with local keyword rules. In that case the statement content is not sent to us or to Google by CardLens.',
          'If on-device analysis is not available or cannot finish, CardLens can use a **cloud AI fallback** (Google\'s Gemini API via Firebase AI Logic, on Google\'s **free tier**). This happens **only if you agree**, and we first remove identifying details (your name and address when they appear under statement labels, card numbers including spaced formats, partial card numbers, Israeli ID numbers, bank account and IBAN numbers, phone numbers, and email addresses). What is sent for categorization is the **redacted merchant names**, not the PDF and not the raw transaction lines. Insights, if you agree, send one **redacted aggregate** (totals, redacted subscription names, and anomaly counts).',
          'A **scanned image** is sent **only if you separately agree** in a checkbox that starts unchecked. Images are not redacted. They may contain your name, address, card digits, and transactions.',
          'You can open **See exactly what will be sent** before you agree. Cloud analysis is **not offered** when this browser\'s language or timezone looks like the EEA, the UK, or Switzerland, or when Remote Config `cloud_fallback_enabled` is off. See the app README for the limits of that check (it is enforced in the browser).',
          'We use Google services to host the app and protect cloud calls (Firebase Hosting, Firebase App Check with reCAPTCHA Enterprise, Firebase Remote Config). Those process technical data such as your IP address and a Firebase installation ID. We do **not** load analytics, Crashlytics, Performance Monitoring, or Google Analytics.',
        ],
      },
      {
        id: 'controller',
        heading: '1. Who we are (controller)',
        paragraphs: [
          `The controller responsible for your personal information is **${CONTROLLER_NAME}**. No postal address is published. Contact us by email at [${PRIVACY_EMAIL}](${mailto}).`,
          'No Privacy Protection Officer or Data Protection Officer is appointed for this hackathon build. No EU representative is appointed.',
        ],
      },
      {
        heading: '2. What information is involved and how it is used',
        paragraphs: [
          '**Statements you choose to analyze.** The statement can contain financial activity, which Israeli law treats as information of special sensitivity, plus your name, address, and card number. Providing a statement is voluntary.',
          '**On-device processing (default).** The statement is processed in your browser with Gemini Nano when that model is available, and with keyword rules otherwise. CardLens does not send the statement to us or to Google in this mode. Chrome may download the Gemini Nano model from Google the first time you ask it to. That download does not include your statement.',
          '**Cloud text (only with your consent).** The model is `gemini-3.5-flash-lite` through Firebase AI Logic. The call is not automatic. If you agree, the request body is the redacted merchant prompt or the redacted insights aggregate described above, plus our instructions. Redaction is automated and can miss things. Review the preview. If you refuse, only on-device analysis and keyword rules are used, and those may be unavailable.',
          '**Scanned images (separate consent, checkbox unchecked).** The image is sent as-is. Do not send it if you are not comfortable with that. Saying yes to text does not say yes to an image. Each image asks again.',
          '**Purpose.** To categorize spending, show recurring charges, and describe unusual amounts. We do not use statements for advertising, profiling, credit decisions, or selling data.',
          '**Legal basis (EU/UK GDPR).** On-device processing stays on your device. Cloud processing is based on your **consent** (Art. 6(1)(a)), which you can refuse or withdraw in Settings (Never use cloud) or by choosing Keep it on my device. Security processing (hosting, App Check, Remote Config) is based on legitimate interests (Art. 6(1)(f)).',
        ],
      },
      {
        heading: '2.2 Results and local storage',
        paragraphs: [
          'Results, the statement, and images are **not saved** by CardLens. They stay in the page\'s memory until you leave or refresh. Preferences, the consent record (time, text version, and your Always ask / Never use cloud choice), the language choice, and the first-run acknowledgement are stored only in this browser. We cannot read them from a server because we do not have that copy.',
          'There is no history of raw statements and no automatic expiry of statement text, because statement text is not stored. Clear my data deletes the preference keys, Cache Storage, Firebase IndexedDB databases, and asks Firebase to delete the installation ID.',
        ],
      },
      {
        id: 'services',
        heading: '2.3 Technical data processed to deliver and protect the app',
        table: {
          headers: ['Service (provider)', 'Data', 'Purpose', 'Legal basis (GDPR)'],
          rows: [
            ['Firebase Hosting (Google)', 'IP address, URL, time, user-agent', 'Deliver the site and detect abuse. Google retains Hosting IP data for a few months.', 'Legitimate interests'],
            ['Firebase App Check with reCAPTCHA Enterprise (Google)', 'Device and browser signals, interactions, IP address, the _GRECAPTCHA cookie', 'Check that cloud AI requests come from this app. Tokens last up to 7 days. Loaded only after you choose a cloud call.', 'Legitimate interests — security'],
            ['Firebase Remote Config (Google)', 'Firebase installation ID, app version', 'Deliver cloud_fallback_enabled and display flags. No statement text is placed in parameters.', 'Legitimate interests'],
            ['Firebase AI Logic / Gemini API free tier (Google)', 'Redacted merchant text or aggregate, or an image you agreed to send; our prompts; the AI response; technical metadata (IP, identifiers, token counts)', 'Cloud analysis when you consent', 'Consent for content; legitimate interests for security metadata'],
          ],
        },
        paragraphs: [
          'We do not use analytics, advertising, or tracking cookies. If that changes, this policy will change and a consent banner will be added before any such SDK loads.',
        ],
      },
      {
        id: 'gemini',
        heading: '3. Google\'s role and how Google uses data',
        paragraphs: [
          '**Firebase (Hosting, App Check, Remote Config, AI Logic).** Google generally acts as our processor under the [Firebase Data Processing and Security Terms](https://firebase.google.com/terms/data-processing-terms). Google also uses limited service metadata under the [Google Privacy Policy](https://policies.google.com/privacy). More: [Privacy and Security in Firebase](https://firebase.google.com/support/privacy).',
          '**reCAPTCHA Enterprise.** We are the controller of reCAPTCHA data and Google processes it for us under the Google Cloud Terms and Cloud Data Processing Addendum. The script is loaded from www.recaptcha.net when you first choose a cloud call. The badge is hidden. The sentence "This site is protected by reCAPTCHA." is in the footer and in the cloud dialog, and it links here rather than to Google\'s privacy policy or terms.',
          '**Gemini API — free tier (Spark).** Our Gemini API usage is on Google\'s **free tier**. Under the [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms), when you choose cloud analysis **Google uses the content sent (including redacted text and any image you send) and the AI responses to provide, improve and develop Google products, services and machine-learning technologies**, and **human reviewers at Google may read, annotate and process** this content (Google says it first disconnects it from our account and API key). Google acts under its own [Privacy Policy](https://policies.google.com/privacy) for this use. **Do not send an image, or any information you would not want a reviewer to see.** Cloud analysis is not offered when the browser language or timezone looks like the EEA, Switzerland, or the UK, and Remote Config can turn it off by country. That check runs in the browser. It can miss a person who is physically in those regions, and it can block a person who is not. See the README.',
          '**On-device AI.** Gemini Nano runs inside Chrome. When CardLens uses it, your statement is not sent to Google by CardLens. Chrome is governed by Google\'s terms and privacy policy.',
        ],
      },
      {
        heading: '4. Who else receives your information',
        paragraphs: [
          'Nobody else. We do not sell or rent personal information, do not share it for cross-context behavioral advertising, and do not disclose it to data brokers. We may disclose information if the law requires it, but we do not store statements on our servers, so we usually have nothing to hand over.',
        ],
      },
      {
        heading: '5. International transfers',
        paragraphs: [
          'Google may process data in the United States and other countries. For people in the EEA, UK, and Switzerland, transfers to Google LLC rely on Google\'s certification under the EU-U.S. Data Privacy Framework (and the UK Extension / Swiss-U.S. DPF) and/or the Standard Contractual Clauses in Google\'s data processing terms. For people in Israel, transfers rely on the Privacy Protection (Transfer of Data to Databases Abroad) Regulations, 2001 — the exact basis should be confirmed by a lawyer — and on our processors\' contracts.',
        ],
      },
      {
        heading: '6. How long we keep information',
        table: {
          headers: ['Data', 'Retention'],
          rows: [
            ['Statement content analyzed on-device', 'Not received by us. Not written to browser storage by CardLens.'],
            ['Redacted text or images sent to cloud AI', 'Not stored by us. Firebase AI Logic does not store it. On the free tier, Google keeps and uses it under the Gemini API terms, including possible human review.'],
            ['Firebase Hosting IP logs', 'A few months (Google\'s retention).'],
            ['App Check tokens', 'Up to 7 days.'],
            ['Firebase installation ID', 'Until you use Clear my data or clear site data. If we delete an ID through the API, Google\'s docs say removal follows within 180 days.'],
            ['Email you send us', 'Up to 24 months.'],
          ],
        },
      },
      {
        id: 'security',
        heading: '7. Security',
        paragraphs: [
          'We minimize data (on-device first, redaction, consent, no cloud without a yes, no second try with the original text), use HTTPS, and use App Check so cloud AI calls come from this app. reCAPTCHA is part of that check. There is no server database of statements. Nothing is completely secure. Keep your device updated and do not use CardLens on a shared device for a real statement.',
          'App Check enforcement in the Firebase console, the reCAPTCHA Enterprise site key, and API-key restrictions are console steps for the project owner. The site key is not in the repository.',
        ],
      },
      {
        heading: '8. Your rights',
        paragraphs: [
          `Contact [${PRIVACY_EMAIL}](${mailto}). Because we do not keep statements or accounts, we usually hold no personal information that identifies you. Data on your device is under your control: use **Clear my data** in Settings, or clear this site's data in the browser. Clear my data calls Firebase \`deleteInstallations()\` when Firebase is configured. It cannot delete content already sent to Google.`,
          '**Israel (Privacy Protection Law, 5741-1981).** You may ask to inspect personal information about you held in a database and to correct or delete it. You can complain to the Privacy Protection Authority ([gov.il](https://www.gov.il/en/departments/the_privacy_protection_authority)).',
          '**EEA/UK (GDPR).** Access, rectification, erasure, restriction, objection, portability, and withdrawal of consent. Withdrawal does not make an earlier cloud send unhappen. You can complain to your supervisory authority.',
          '**US / California.** We do not sell or share personal information. Where a state law gives you a right to know, delete, or correct, contact us. We will not discriminate against you for asking.',
        ],
      },
      {
        heading: '9. Children',
        paragraphs: [
          'CardLens is for adults **18 or older**. It is not directed to children, and we do not knowingly collect information from anyone under 18. If you believe a minor used a cloud send, contact us.',
        ],
      },
      {
        heading: '10. Automated processing and AI',
        paragraphs: [
          'Results are informational. CardLens does not decide credit, insurance, or anything else with a legal or similar effect. Output can be wrong. Every result is labelled "AI-generated – may contain mistakes. Not financial advice." and shows whether it was analyzed on your device or in the cloud (redacted). See the [Terms of Use](/terms).',
        ],
      },
      {
        id: 'cookies',
        heading: '11. Cookies and similar storage',
        paragraphs: [
          'These are the keys this build uses. They are for the service you asked for, not for advertising or analytics. Deleting them can stop parts of the app.',
        ],
        table: 'storage',
      },
      {
        heading: '12. Changes',
        paragraphs: [
          'We will post changes on this page and update the date. If we send more statement content to the cloud than this policy describes, the app will ask again.',
        ],
      },
      {
        heading: '13. Contact',
        paragraphs: [
          `${CONTROLLER_NAME}. Contact us by email at [${PRIVACY_EMAIL}](${mailto}).`,
        ],
      },
    ],
  };
}

function termsEn(): LegalDocument {
  return {
    title: 'CardLens Terms of Use',
    updatedLabel: `Last updated: ${LEGAL_UPDATED_EN}.`,
    disclaimer: DRAFT_NOTE_EN,
    sections: [
      {
        heading: 'Agreement',
        paragraphs: [
          `These Terms govern your use of CardLens (the "Service"), provided by **${CONTROLLER_NAME}** ("we", "us"). By using CardLens you agree to these Terms and acknowledge our [Privacy Policy](/privacy). If you do not agree, do not use the Service.`,
          'Liability limits and the governing-law clause need a lawyer. Israeli Standard Contracts Law and consumer law in the EU, UK, and US can override one-sided terms.',
        ],
      },
      {
        heading: '1. What CardLens does',
        paragraphs: [
          'CardLens uses artificial intelligence and local rules to help you read your own credit-card statements (categories, recurring charges, unusual amounts). Analysis runs on your device when it can. With your consent, a redacted text or an image may be processed by Google\'s Gemini API on the free tier, as described in the Privacy Policy. Cloud analysis is off when the in-app region check or Remote Config says so.',
        ],
      },
      {
        heading: '2. Not financial, legal, or tax advice',
        paragraphs: [
          'CardLens provides **general information only**. It is **not financial, investment, credit, legal, accounting, or tax advice**, and it does not recommend a financial product. We are not licensed advisers. Check results against the original statement. Before disputing a charge, cancelling a service, or changing a budget, talk to your card issuer or a qualified professional.',
        ],
      },
      {
        heading: '3. AI output may be wrong',
        paragraphs: [
          'AI can misread a statement, miss or invent a transaction, mis-categorize a charge, or miscalculate a total. Redaction is automated and may be incomplete. You are responsible for reviewing the output. Results are labelled as AI-generated.',
        ],
      },
      {
        heading: '4. Eligibility',
        paragraphs: ['You must be **18 or older** to use CardLens.'],
      },
      {
        heading: '5. Your responsibilities and uploads',
        bullets: [
          'Only analyze statements that belong to you or that you are allowed to process.',
          'You decide whether to use the cloud option and whether to send an image. Read the preview first.',
          'Anything CardLens stores locally is on your device. Statements themselves are not saved.',
        ],
      },
      {
        heading: '6. Acceptable use',
        paragraphs: [
          'You must not: (a) use CardLens for anything illegal, fraudulent, or harmful; (b) bypass App Check, reCAPTCHA, rate limits, or safety filters, or try to extract our cloud access; (c) reverse engineer access to third-party APIs in order to build a competing model; (d) upload malware or content you have no right to share; (e) use CardLens to make automated decisions about other people (credit, employment, or housing); (f) violate Google\'s [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy), which applies to the models CardLens uses, including Chrome\'s on-device model.',
        ],
      },
      {
        heading: '7. Third-party services',
        paragraphs: [
          'CardLens relies on Google services (Chrome built-in AI / Gemini Nano, Firebase, the Gemini API, reCAPTCHA). Their availability is outside our control. Your use of Chrome is governed by Google\'s terms.',
        ],
      },
      {
        heading: '8. Open source',
        paragraphs: [
          `CardLens source code is available under the Apache License 2.0 at [${REPO_URL}](${REPO_URL}). That license governs the code. These Terms govern use of the hosted Service.`,
        ],
      },
      {
        heading: '9. No warranty',
        paragraphs: [
          'The Service is provided **"as is" and "as available"**, free of charge, without warranties of any kind, express or implied, including accuracy, fitness for a particular purpose, availability, and non-infringement, to the maximum extent permitted by law.',
        ],
      },
      {
        heading: '10. Limitation of liability',
        paragraphs: [
          'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of money, data, or opportunity, arising from your use of or reliance on CardLens. Our total liability for any claim relating to the Service is limited to **ILS 200**. Nothing in these Terms limits liability that cannot be limited by law (for example intent or gross negligence, or mandatory consumer rights). A lawyer should confirm this cap.',
        ],
      },
      {
        heading: '11. Changes and termination',
        paragraphs: [
          'We may change, suspend, or stop the Service or these Terms. Material changes will show a new "Last updated" date. Continuing to use the Service after a change means you accept the new Terms, except where the law requires something else.',
        ],
      },
      {
        heading: '12. Governing law',
        paragraphs: [
          'These Terms are governed by the laws of the **State of Israel**, and the courts of **Tel Aviv-Jaffa** have exclusive jurisdiction, except where mandatory consumer law in your country lets you sue at home or applies its own rules. A lawyer should confirm this clause.',
        ],
      },
      {
        heading: '13. Contact',
        paragraphs: [`${CONTROLLER_NAME}. Contact us by email at [${PRIVACY_EMAIL}](${mailto}).`],
      },
    ],
  };
}

function accessEn(): LegalDocument {
  return {
    title: 'Accessibility Statement – CardLens',
    updatedLabel: `Last updated: ${LEGAL_UPDATED_EN}. Last accessibility review: ${LEGAL_UPDATED_EN}.`,
    disclaimer: DRAFT_NOTE_EN,
    sections: [
      {
        heading: 'Aim',
        paragraphs: [
          'We want CardLens to be usable by everyone, including people with disabilities. CardLens aims to conform to **Israeli Standard IS 5568 (Part 1, September 2023) at level AA**, which is based on the **W3C Web Content Accessibility Guidelines (WCAG) 2.x, level AA**. The notes below list only what this build actually checked. They are not a certificate of conformance.',
        ],
      },
      {
        heading: 'What we have done',
        bullets: [
          'Automated checks with **axe-core 4.14.0** on the main screen, including the dashboard and onboarding states. The test fails if axe reports a violation.',
          'Automated keyboard checks for the cloud consent dialogs: initial focus on "Keep it on my device" or "Cancel", Tab stays inside the dialog, Escape refuses the send, `aria-modal` is set, and the image checkbox starts unchecked with "Send image" disabled until it is checked.',
          'The page is English: `lang` is `en` and `dir` is `ltr`.',
          'The `prefers-reduced-motion` setting reduces animation.',
          'Skip link, headings, labelled controls, and a visible focus style.',
          'Automated contrast checks for the text colors, including footer text and the result disclaimer.',
          'Bar charts include an HTML table with the same labels and values.',
          'The cloud dialog includes the redacted preview and a link to this statement\'s sibling, the privacy policy.',
        ],
      },
      {
        heading: 'Known limitations',
        bullets: [
          'A person has not completed a full manual pass with NVDA, TalkBack, or 200% zoom. That checklist is in docs/compliance/accessibility-checklist.md in the source repository.',
          'A scanned image\'s alternative text says that the picture would be sent and cannot be redacted. It is not a description of every line on the page. The transcribed lines are text.',
          'On-device AI needs a supported Chrome build. Other browsers get a text explanation and keyword rules.',
          'The site is English, including consent, the footer, these legal pages, the first-run notice, Settings, and result labels.',
          'The reCAPTCHA badge is visually hidden. The words "This site is protected by reCAPTCHA." are in the footer and in the cloud dialog.',
          'No accessibility coordinator is appointed. This hackathon project does not have 25 employees. That is not a legal determination that an exemption applies.',
        ],
      },
      {
        heading: 'Contact us about accessibility',
        paragraphs: [
          `${CONTROLLER_NAME}. Email [${ACCESSIBILITY_EMAIL}](${accessMail}) for accessibility, privacy, and general contact. There is no phone number for this build.`,
          'Describe the page, the problem, and the assistive technology you use. We aim to respond within 5 business days. The footer contact link writes to this same address.',
        ],
      },
    ],
  };
}
