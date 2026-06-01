export type TableData = {
  title?: string;
  headers: string[];
  rows: string[][];
};

/** Normalize AI table JSON (```table, ```json, nested `table`, `columns` vs `headers`). */
export function normalizeTableData(raw: unknown): TableData | null {
  if (!raw || typeof raw !== 'object') return null;

  let obj = raw as Record<string, unknown>;
  if (obj.table && typeof obj.table === 'object') {
    obj = obj.table as Record<string, unknown>;
  }

  const headers = obj.headers ?? obj.columns;
  const rows = obj.rows;

  if (!Array.isArray(headers) || !Array.isArray(rows)) return null;
  if (!headers.every((h) => typeof h === 'string')) return null;
  if (!rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))) return null;

  return {
    title: typeof obj.title === 'string' ? obj.title : undefined,
    headers: headers as string[],
    rows: rows as string[][],
  };
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
