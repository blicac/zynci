import { DayRowInfo, SchedulerEvent } from '../models/scheduler.models';

/**
 * Hashes a shared password using Web Crypto SHA-256 so raw passwords aren't stored in plain text.
 */
export async function hashPassword(password: string): Promise<string> {
  const normalized = password.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple deterministic hash if subtle crypto is unavailable
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

/**
 * Generates an inclusive list of DayRowInfo objects between startDateStr and endDateStr (YYYY-MM-DD).
 */
export function generateDateRange(startDateStr: string, endDateStr: string): DayRowInfo[] {
  const result: DayRowInfo[] = [];
  const startParts = startDateStr.split('-').map(Number);
  const endParts = endDateStr.split('-').map(Number);

  if (startParts.length !== 3 || endParts.length !== 3) {
    return result;
  }

  const current = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  const fullFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

  let guard = 0;
  while (current <= end && guard <= 95) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = current.getDay();

    result.push({
      dateStr,
      displayLabel: fullFormatter.format(current), // e.g., "Mon, Nov 2"
      weekdayShort: weekdayFormatter.format(current), // e.g., "Mon"
      dayNum: String(current.getDate()), // e.g., "2"
      monthShort: monthFormatter.format(current), // e.g., "Nov"
      dayMonthSlash: `${current.getDate()}/${current.getMonth() + 1}`, // e.g., "22/11"
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });

    current.setDate(current.getDate() + 1);
    guard++;
  }

  return result;
}

/**
 * Formats a YYYY-MM-DD string into a short month/day label like "Nov 12".
 */
export function formatShortMonthDay(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

/**
 * Calculates the inclusive number of days between two YYYY-MM-DD dates.
 */
export function calculateDaysInclusive(startDateStr: string, endDateStr: string): number {
  const s = startDateStr.split('-').map(Number);
  const e = endDateStr.split('-').map(Number);
  if (s.length !== 3 || e.length !== 3) return 0;
  const start = Date.UTC(s[0], s[1] - 1, s[2]);
  const end = Date.UTC(e[0], e[1] - 1, e[2]);
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Encodes event metadata into a URL-safe base64 token so shared links work across
 * different browsers/devices even before a Supabase backend key is configured.
 */
export function encodeShareToken(event: SchedulerEvent): string {
  try {
    const payload = JSON.stringify({
      i: event.id,
      t: event.title,
      s: event.start_date,
      e: event.end_date,
      p: event.password_hash,
    });
    return btoa(encodeURIComponent(payload));
  } catch {
    return '';
  }
}

/**
 * Decodes a URL-safe base64 share token back into a SchedulerEvent.
 */
export function decodeShareToken(token: string | null | undefined): SchedulerEvent | null {
  if (!token) return null;
  try {
    const json = decodeURIComponent(atob(token));
    const parsed = JSON.parse(json);
    if (parsed && parsed.i && parsed.t && parsed.s && parsed.e && parsed.p) {
      return {
        id: String(parsed.i),
        title: String(parsed.t),
        start_date: String(parsed.s),
        end_date: String(parsed.e),
        password_hash: String(parsed.p),
      };
    }
  } catch {
    // ignore malformed token
  }
  return null;
}

/**
 * Copies a string to the clipboard with a reliable fallback for HTTP/mobile contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
