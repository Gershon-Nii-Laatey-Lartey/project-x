export type ChartDataPoint = { x: number; y: number; label?: string };

export type ChartData = {
  type: 'line' | 'bar' | 'area' | 'scatter';
  title: string;
  xLabel: string;
  yLabel: string;
  data: ChartDataPoint[];
  scales?: { x?: number[]; y?: number[] };
};

const CHART_TYPES = new Set(['line', 'bar', 'area', 'scatter']);

function coercePoint(raw: unknown): ChartDataPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const x = typeof p.x === 'number' ? p.x : Number(p.x);
  const y = typeof p.y === 'number' ? p.y : Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x,
    y,
    label: typeof p.label === 'string' ? p.label : undefined,
  };
}

function coercePoints(raw: unknown): ChartDataPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const points = raw.map(coercePoint).filter((p): p is ChartDataPoint => p !== null);
  return points.length > 0 ? points : null;
}

/** Chart.js style: { labels: [...], datasets: [{ data: [...] }] } */
function parseChartJsPoints(dataObj: Record<string, unknown>): ChartDataPoint[] | null {
  if (!Array.isArray(dataObj.labels) || !Array.isArray(dataObj.datasets)) return null;
  const datasets = dataObj.datasets as unknown[];
  if (datasets.length === 0 || typeof datasets[0] !== 'object' || !datasets[0]) return null;

  const ds = datasets[0] as Record<string, unknown>;
  if (!Array.isArray(ds.data)) return null;

  const labels = dataObj.labels as unknown[];
  const values = ds.data as unknown[];
  const points: ChartDataPoint[] = [];

  for (let i = 0; i < Math.min(labels.length, values.length); i++) {
    const x = Number(labels[i]);
    const y = Number(values[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }

  return points.length > 0 ? points : null;
}

function readAxisTitle(scale: unknown): string | undefined {
  if (!scale || typeof scale !== 'object') return undefined;
  const s = scale as Record<string, unknown>;
  if (typeof s.title === 'string') return s.title;
  if (s.title && typeof s.title === 'object') {
    const t = s.title as Record<string, unknown>;
    if (typeof t.text === 'string') return t.text;
  }
  return undefined;
}

function readOptionsMeta(obj: Record<string, unknown>): {
  title?: string;
  xLabel?: string;
  yLabel?: string;
} {
  const options =
    obj.options && typeof obj.options === 'object'
      ? (obj.options as Record<string, unknown>)
      : undefined;
  if (!options) return {};

  let title: string | undefined;
  if (typeof options.title === 'string') title = options.title;
  else if (options.title && typeof options.title === 'object') {
    const t = options.title as Record<string, unknown>;
    if (typeof t.text === 'string') title = t.text;
  }

  const scales =
    options.scales && typeof options.scales === 'object'
      ? (options.scales as Record<string, unknown>)
      : undefined;

  return {
    title,
    xLabel: scales ? readAxisTitle(scales.x) : undefined,
    yLabel: scales ? readAxisTitle(scales.y) : undefined,
  };
}

function buildScales(points: ChartDataPoint[]): ChartData['scales'] {
  const xs = [...new Set(points.map((p) => p.x))].sort((a, b) => a - b);
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midY = (minY + maxY) / 2;
  return { x: xs, y: minY === maxY ? [minY] : [minY, midY, maxY] };
}

/** Normalize AI chart JSON (Casio schema, Chart.js, nested `chart`, aliases). */
export function normalizeChartData(raw: unknown): ChartData | null {
  if (!raw || typeof raw !== 'object') return null;

  let obj = raw as Record<string, unknown>;
  if (obj.chart && typeof obj.chart === 'object') {
    obj = obj.chart as Record<string, unknown>;
  }

  const meta = readOptionsMeta(obj);

  let chartJsBlock: Record<string, unknown> | null = null;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const inner = obj.data as Record<string, unknown>;
    if (Array.isArray(inner.labels) && Array.isArray(inner.datasets)) {
      chartJsBlock = inner;
    } else if (inner.data || inner.points) {
      obj = { ...obj, ...inner };
    }
  }

  const points =
    (chartJsBlock ? parseChartJsPoints(chartJsBlock) : null) ??
    coercePoints(obj.data) ??
    coercePoints(obj.points) ??
    coercePoints(obj.values) ??
    coercePoints(obj.series);

  if (!points) return null;

  const typeRaw = typeof obj.type === 'string' ? obj.type.toLowerCase() : 'line';
  const type = CHART_TYPES.has(typeRaw) ? (typeRaw as ChartData['type']) : 'line';

  const datasetLabel =
    chartJsBlock &&
    Array.isArray(chartJsBlock.datasets) &&
    chartJsBlock.datasets[0] &&
    typeof chartJsBlock.datasets[0] === 'object'
      ? (chartJsBlock.datasets[0] as Record<string, unknown>).label
      : undefined;

  return {
    type,
    title:
      meta.title ??
      (typeof obj.title === 'string' ? obj.title : undefined) ??
      (typeof datasetLabel === 'string' ? datasetLabel : 'Chart'),
    xLabel:
      meta.xLabel ??
      (typeof obj.xLabel === 'string' ? obj.xLabel : undefined) ??
      (typeof obj.x_label === 'string' ? obj.x_label : 'x'),
    yLabel:
      meta.yLabel ??
      (typeof obj.yLabel === 'string' ? obj.yLabel : undefined) ??
      (typeof obj.y_label === 'string' ? obj.y_label : 'y'),
    data: points,
    scales: buildScales(points),
  };
}

/** True when JSON looks like a chart, not a data table. */
export function isChartLikePayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  const root = obj.chart && typeof obj.chart === 'object' ? (obj.chart as Record<string, unknown>) : obj;

  if (normalizeChartData(raw)) return true;

  const data = root.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.labels) && Array.isArray(d.datasets)) return true;
  }

  return (
    Array.isArray(root.points) ||
    (Array.isArray(root.data) && root.data.length > 0 && typeof root.data[0] === 'object' && 'x' in (root.data[0] as object))
  );
}
