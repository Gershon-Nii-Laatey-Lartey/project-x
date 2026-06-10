export type TableData = {
  title?: string;
  headers: string[];
  rows: string[][];
};

/** Normalize AI table JSON (```table, ```json, nested `table`, `columns` vs `headers`, array of objects, or dictionaries). */
export function normalizeTableData(raw: unknown): TableData | null {
  if (!raw) return null;

  // Case 1: Array of objects (e.g. [{"Q#": "1", "Ans": "A"}])
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const first = raw[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const headers = Object.keys(first);
      const rows = raw.map((item) => {
        if (item && typeof item === 'object') {
          return headers.map((h) => String((item as Record<string, unknown>)[h] ?? ''));
        }
        return [];
      });
      return {
        headers,
        rows,
      };
    }
  }

  // Case 2: Object with headers/rows or columns/data
  if (typeof raw === 'object') {
    let obj = raw as Record<string, unknown>;
    if (obj.table && typeof obj.table === 'object') {
      obj = obj.table as Record<string, unknown>;
    }

    const headers = obj.headers ?? obj.columns;
    const rows = obj.rows ?? obj.data;

    if (Array.isArray(headers) && Array.isArray(rows)) {
      const stringifiedHeaders = headers.map((h) => String(h ?? ''));
      const stringifiedRows = rows.map((r) => {
        if (!Array.isArray(r)) return [];
        return r.map((c) => String(c ?? ''));
      });

      return {
        title: typeof obj.title === 'string' ? obj.title : undefined,
        headers: stringifiedHeaders,
        rows: stringifiedRows,
      };
    }

    // Case 3: Simple flat dictionary (e.g. {"1": "A", "2": "B"})
    const keys = Object.keys(obj);
    const isFlat = keys.every((k) => {
      const val = obj[k];
      return val === null || typeof val !== 'object';
    });

    if (isFlat && keys.length > 0) {
      return {
        headers: ['Key', 'Value'],
        rows: keys.map((k) => [k, String(obj[k] ?? '')]),
      };
    }
  }

  return null;
}

const MARKDOWN_TABLE_RE =
  /(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g;

const cleanCell = (cell: string) =>
  cell.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();

const parseRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => cleanCell(c));

/** Parse a GFM pipe table into CasioTable props. */
export function parseMarkdownTable(block: string): TableData | null {
  const lines = block.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;

  const headers = parseRow(lines[0]);
  const separator = lines[1];
  if (!/^\|[\s:|-]+\|$/.test(separator.trim())) return null;

  const rows = lines.slice(2).map(parseRow).filter((r) => r.length > 0);
  if (headers.length === 0 || rows.length === 0) return null;

  return { headers, rows };
}

/** Split plain text into alternating markdown-table blocks and prose. */
export function splitMarkdownTables(text: string): { type: 'text' | 'table'; value: string }[] {
  const parts: { type: 'text' | 'table'; value: string }[] = [];
  let lastIndex = 0;
  MARKDOWN_TABLE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_TABLE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'table', value: match[1] });
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}
