import { DayRowInfo, SchedulerEvent } from '../models/scheduler.models';

const PASSWORD_DOMAIN_SALT = 'zynci_schedule_salt_v1:';
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHORT_UUID_PREFIX = '5a796e63-0000-4000-8000-';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bigIntToBase62(num: bigint, minLength = 1): string {
  if (num === 0n) return '0'.repeat(minLength);
  let n = num;
  let out = '';
  while (n > 0n) {
    const rem = Number(n % 62n);
    out = BASE62_ALPHABET[rem] + out;
    n = n / 62n;
  }
  return out.padStart(minLength, '0');
}

function base62ToBigInt(str: string): bigint | null {
  let result = 0n;
  for (let i = 0; i < str.length; i++) {
    const idx = BASE62_ALPHABET.indexOf(str[i]);
    if (idx === -1) return null;
    result = result * 62n + BigInt(idx);
  }
  return result;
}

/**
 * Generates a deterministic UUID backed by a random 7-character Base62 TinyURL code
 * so Supabase stores a valid UUID while share links are just 7 characters (`/p/k9Xm2pQ`).
 */
export function generateShortPollUuid(): string {
  const bytes = new Uint8Array(7);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 7; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = '';
  for (let i = 0; i < 7; i++) {
    // Avoid leading '0' so 7-char codes always stay 7 chars
    const idx = i === 0 ? 1 + (bytes[i] % 61) : bytes[i] % 62;
    code += BASE62_ALPHABET[idx];
  }
  const num = base62ToBigInt(code) ?? 1n;
  const hexSuffix = num.toString(16).padStart(12, '0');
  return `${SHORT_UUID_PREFIX}${hexSuffix}`;
}

/**
 * Converts an event UUID into a short TinyURL-style slug (7 chars for new polls, ~22 chars for legacy UUIDs).
 */
export function encodeEventIdToShortSlug(eventId: string): string {
  const clean = eventId.trim().toLowerCase();
  if (clean.startsWith(SHORT_UUID_PREFIX) && clean.length === 36) {
    const hexSuffix = clean.slice(SHORT_UUID_PREFIX.length);
    const num = BigInt(`0x${hexSuffix}`);
    return bigIntToBase62(num, 7);
  }
  if (UUID_REGEX.test(clean)) {
    const hex = clean.replace(/-/g, '');
    const num = BigInt(`0x${hex}`);
    return bigIntToBase62(num, 22);
  }
  return eventId;
}

/**
 * Resolves a short URL slug (`/p/k9Xm2pQ`) or full UUID back into the underlying database event ID.
 */
export function decodeShortSlugToEventId(slugOrId: string): string {
  const clean = slugOrId.trim();
  if (UUID_REGEX.test(clean) || clean.includes('-')) {
    return clean.toLowerCase();
  }
  if (clean.length === 7) {
    const num = base62ToBigInt(clean);
    if (num !== null) {
      const hexSuffix = num.toString(16).padStart(12, '0');
      if (hexSuffix.length <= 12) {
        return `${SHORT_UUID_PREFIX}${hexSuffix}`;
      }
    }
  }
  if (clean.length >= 20 && clean.length <= 24) {
    const num = base62ToBigInt(clean);
    if (num !== null) {
      const hex = num.toString(16).padStart(32, '0');
      if (hex.length === 32) {
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      }
    }
  }
  return clean;
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

/**
 * Hashes a shared password using domain-salted Web Crypto SHA-256 so raw passwords
 * aren't stored in plain text or vulnerable to generic unsalted rainbow tables.
 */
export async function hashPassword(password: string): Promise<string> {
  const normalized = password.trim();
  const digest = await sha256Hex(`${PASSWORD_DOMAIN_SALT}${normalized}`);
  return `v1_${digest}`;
}

/**
 * Verifies a password attempt against a stored hash (supports both v1 salted hashes
 * and legacy unsalted hashes so existing polls remain accessible).
 */
export async function verifyPassword(
  passwordAttempt: string,
  expectedHash: string
): Promise<boolean> {
  if (!expectedHash) return false;
  const normalized = passwordAttempt.trim();
  if (expectedHash.startsWith('v1_')) {
    const salted = await hashPassword(normalized);
    return salted === expectedHash;
  }
  const legacyDigest = await sha256Hex(normalized);
  return legacyDigest === expectedHash;
}

/**
 * Validates that a string is a well-formed YYYY-MM-DD date.
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Returns today's local date in YYYY-MM-DD format.
 */
export function getTodayIsoDate(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns today's local date and 13 days ahead in YYYY-MM-DD format.
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 13);
  const fmt = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  return { startDate: fmt(today), endDate: fmt(end) };
}

/**
 * Generates an inclusive list of DayRowInfo objects between startDateStr and endDateStr (YYYY-MM-DD).
 */
export function generateDateRange(startDateStr: string, endDateStr: string): DayRowInfo[] {
  const result: DayRowInfo[] = [];
  if (!isValidIsoDate(startDateStr) || !isValidIsoDate(endDateStr)) {
    return result;
  }

  const startParts = startDateStr.split('-').map(Number);
  const endParts = endDateStr.split('-').map(Number);

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
      displayLabel: fullFormatter.format(current),
      weekdayShort: weekdayFormatter.format(current),
      dayNum: String(current.getDate()),
      monthShort: monthFormatter.format(current),
      dayMonthSlash: `${current.getDate()}/${current.getMonth() + 1}`,
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
  if (!isValidIsoDate(startDateStr) || !isValidIsoDate(endDateStr)) return 0;
  const s = startDateStr.split('-').map(Number);
  const e = endDateStr.split('-').map(Number);
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
 * Decodes and strictly validates a URL-safe base64 share token back into a SchedulerEvent.
 */
export function decodeShareToken(token: string | null | undefined): SchedulerEvent | null {
  if (!token || token.length > 2048) return null;
  try {
    const json = decodeURIComponent(atob(token));
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.i === 'string' &&
      parsed.i.trim().length > 0 &&
      parsed.i.length <= 100 &&
      typeof parsed.t === 'string' &&
      parsed.t.trim().length > 0 &&
      typeof parsed.s === 'string' &&
      typeof parsed.e === 'string' &&
      isValidIsoDate(parsed.s) &&
      isValidIsoDate(parsed.e) &&
      parsed.e >= getTodayIsoDate() &&
      calculateDaysInclusive(parsed.s, parsed.e) > 0 &&
      calculateDaysInclusive(parsed.s, parsed.e) <= 90 &&
      typeof parsed.p === 'string' &&
      parsed.p.trim().length > 0 &&
      parsed.p.length <= 256
    ) {
      return {
        id: parsed.i.trim(),
        title: parsed.t.trim().slice(0, 120),
        start_date: parsed.s,
        end_date: parsed.e,
        password_hash: parsed.p.trim(),
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
