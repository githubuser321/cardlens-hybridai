import { STORAGE_INVENTORY } from '../compliance/storage-inventory';

export interface LegalSection {
  id?: string;
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  /** Rows are plain text. Use `storage` to insert the live inventory. */
  table?: { headers: readonly string[]; rows: readonly (readonly string[])[] } | 'storage';
}

export interface LegalDocument {
  title: string;
  updatedLabel: string;
  disclaimer: string;
  sections: readonly LegalSection[];
}

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function renderLegalDocument(doc: LegalDocument): HTMLElement {
  const article = document.createElement('article');
  article.className = 'legal';
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = doc.disclaimer;
  const title = document.createElement('h1');
  title.textContent = doc.title;
  const updated = document.createElement('p');
  updated.textContent = doc.updatedLabel;
  article.append(note, title, updated);
  for (const section of doc.sections) {
    const block = document.createElement('section');
    if (section.id) {
      block.id = section.id;
    }
    const heading = document.createElement('h2');
    heading.textContent = section.heading;
    block.append(heading);
    for (const paragraph of section.paragraphs ?? []) {
      const p = document.createElement('p');
      appendRichText(p, paragraph);
      block.append(p);
    }
    if (section.bullets && section.bullets.length > 0) {
      const list = document.createElement('ul');
      for (const item of section.bullets) {
        const li = document.createElement('li');
        appendRichText(li, item);
        list.append(li);
      }
      block.append(list);
    }
    if (section.table) {
      block.append(renderTable(section.table));
    }
    article.append(block);
  }
  return article;
}

export function appendRichText(parent: HTMLElement, text: string): void {
  for (const part of text.split(TOKEN)) {
    if (!part) {
      continue;
    }
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold?.[1]) {
      const strong = document.createElement('strong');
      strong.textContent = bold[1];
      parent.append(strong);
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link?.[1] && link[2]) {
      const anchor = document.createElement('a');
      anchor.textContent = link[1];
      anchor.href = link[2];
      if (/^https?:/i.test(link[2])) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      parent.append(anchor);
      continue;
    }
    parent.append(document.createTextNode(part));
  }
}

function renderTable(
  table: { headers: readonly string[]; rows: readonly (readonly string[])[] } | 'storage',
): HTMLTableElement {
  const element = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headers = table === 'storage'
    ? ['Name / type', 'Set by', 'Purpose', 'Duration']
    : table.headers;
  for (const header of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = header;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  const rows = table === 'storage'
    ? STORAGE_INVENTORY.map((row) => [row.name, row.setBy, row.purpose, row.duration])
    : table.rows;
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const value of row) {
      const cell = document.createElement('td');
      cell.textContent = value;
      tr.append(cell);
    }
    body.append(tr);
  }
  element.append(head, body);
  return element;
}
