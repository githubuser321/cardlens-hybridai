/** Text alternative for a bar chart. The visible bars already print the same numbers. */
export function chartTextTable(
  caption: string,
  labelHeader: string,
  valueHeader: string,
  rows: readonly { label: string; value: string }[],
): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'sr-only';
  const captionElement = document.createElement('caption');
  captionElement.textContent = caption;
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const header of [labelHeader, valueHeader]) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = header;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = row.label;
    const value = document.createElement('td');
    value.textContent = row.value;
    tr.append(label, value);
    body.append(tr);
  }
  table.append(captionElement, head, body);
  return table;
}
