/**
 * dev/csv.mjs — reads a CSV file as jsPsych writes it (quoted fields, doubled
 * quotes, line breaks inside quotes). Returns an array of row objects.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((h, k) => [h, r[k] ?? ""])));
}

/** True if every line of the CSV has as many cells as its header (DataPipe rejects a ragged file). */
export function isRectangular(text) {
  const widths = new Set();
  let cells = 1, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ",") cells++;
    else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      widths.add(cells); cells = 1;
    }
  }
  if (!text.endsWith("\n") && !text.endsWith("\r")) widths.add(cells);
  return widths.size === 1;
}
