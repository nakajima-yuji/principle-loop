// 日本時間（Asia/Tokyo）の日付計算。日本は夏時間がないので +9 時間固定で計算する。
// GitHub Actions の cron は UTC なので、曜日判定は必ずここを通す。

export const TIME_ZONE = 'Asia/Tokyo';
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface JstParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = 日曜
}

export function jstParts(date: Date): JstParts {
  const t = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    weekday: t.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-05" */
export function jstDateString(date: Date): string {
  const p = jstParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isSundayJst(date: Date): boolean {
  return jstParts(date).weekday === 0;
}

/** "2026-10-05" → "20261005" */
export function compactDate(dateString: string): string {
  return dateString.replaceAll('-', '');
}

/** "20261005-03" → "2026-10-05"（不正なら null） */
export function dateFromItemId(id: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})-\d{2}$/.exec(id);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function makeItemId(dateString: string, order: number): string {
  return `${compactDate(dateString)}-${pad(order)}`;
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** "2026-10-05" → "2026年10月5日（月）" */
export function formatJaDate(dateString: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!m) return dateString;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日（${WEEKDAYS_JA[d.getUTCDay()]}）`;
}

/** "2026-10-05" → "2026.10.05" */
export function formatDotDate(dateString: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(dateString) ? dateString.slice(0, 10).replaceAll('-', '.') : dateString;
}

/** ISO 時刻を日本時間の "2026/10/05 07:05" 形式に */
export function formatJaDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = jstParts(d);
  return `${p.year}/${pad(p.month)}/${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
