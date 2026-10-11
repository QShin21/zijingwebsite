// RFC 4180 test reader: quoted commas/newlines/doubled quotes stay in one cell.
export function readCSV(text: string) {
  const rows: string[][] = [],
    row: string[] = [];
  let cell = "",
    quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\r" || c === "\n") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      rows.push([...row, cell]);
      row.length = 0;
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV cell");
  rows.push([...row, cell]);
  const headers = rows.shift()!;
  if (rows.some((r) => r.length !== headers.length))
    throw new Error("CSV columns do not align");
  return {
    headers,
    rows,
    records: rows.map((r) =>
      Object.fromEntries(headers.map((h, i) => [h, r[i]])),
    ),
  };
}
