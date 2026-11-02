import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DB_FILE = path.join(os.tmpdir(), 'zynci-sync-db.json');
const DEMO_EVENT_ID = '11111111-2222-3333-4444-555555555555';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SLOTS = new Set(['morning', 'afternoon', 'evening']);

// In-memory store paired with /tmp persistence for warm Vercel serverless instances
let memoryDb = null;

function getTodayIsoDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isValidString(val, maxLen = 256) {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

function sanitizeDb(db) {
  const todayStr = getTodayIsoDate();
  const events = [];
  if (Array.isArray(db?.events)) {
    for (const e of db.events) {
      if (
        e &&
        isValidString(e.id, 100) &&
        e.id !== DEMO_EVENT_ID &&
        isValidString(e.title, 120) &&
        DATE_REGEX.test(String(e.start_date)) &&
        DATE_REGEX.test(String(e.end_date)) &&
        String(e.start_date) <= String(e.end_date) &&
        String(e.end_date) >= todayStr &&
        isValidString(e.password_hash, 256)
      ) {
        events.push({
          id: String(e.id).trim(),
          title: String(e.title).trim().slice(0, 120),
          start_date: String(e.start_date),
          end_date: String(e.end_date),
          password_hash: String(e.password_hash),
          created_at: typeof e.created_at === 'string' ? e.created_at : new Date().toISOString(),
        });
      }
    }
  }

  const eventsById = new Map(events.map((e) => [e.id, e]));

  const participants = [];
  if (Array.isArray(db?.participants)) {
    for (const p of db.participants) {
      if (
        p &&
        isValidString(p.id, 100) &&
        isValidString(p.event_id, 100) &&
        p.event_id !== DEMO_EVENT_ID &&
        eventsById.has(p.event_id) &&
        isValidString(p.name, 60)
      ) {
        participants.push({
          id: String(p.id).trim(),
          event_id: String(p.event_id).trim(),
          user_id: isValidString(p.user_id, 100) ? String(p.user_id).trim() : undefined,
          name: String(p.name).trim().slice(0, 60),
          created_at: typeof p.created_at === 'string' ? p.created_at : new Date().toISOString(),
        });
      }
    }
  }

  const validParticipantIds = new Set(participants.map((p) => p.id));

  const availabilities = [];
  if (Array.isArray(db?.availabilities)) {
    for (const a of db.availabilities) {
      const ev = a?.event_id ? eventsById.get(String(a.event_id).trim()) : undefined;
      if (
        a &&
        ev &&
        isValidString(a.participant_id, 100) &&
        validParticipantIds.has(String(a.participant_id).trim()) &&
        DATE_REGEX.test(String(a.date)) &&
        String(a.date) >= ev.start_date &&
        String(a.date) <= ev.end_date &&
        VALID_SLOTS.has(a.time_slot)
      ) {
        availabilities.push({
          id: isValidString(a.id, 100)
            ? String(a.id)
            : `${a.participant_id}_${a.date}_${a.time_slot}`,
          participant_id: String(a.participant_id).trim(),
          event_id: String(a.event_id).trim(),
          date: String(a.date),
          time_slot: a.time_slot,
          is_available: Boolean(a.is_available),
        });
      }
    }
  }

  return { events, participants, availabilities };
}

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      memoryDb = sanitizeDb(parsed);
      return memoryDb;
    }
  } catch {
    // ignore read error
  }
  if (memoryDb) {
    memoryDb = sanitizeDb(memoryDb);
    return memoryDb;
  }
  return { events: [], participants: [], availabilities: [] };
}

function writeDb(db) {
  const clean = sanitizeDb(db);
  memoryDb = clean;
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(clean), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch {
    // ignore /tmp write failure if read-only
  }
  return clean;
}

function mergeDb(current, incoming) {
  const cleanIncoming = sanitizeDb(incoming);
  const deletedEventIds = new Set(
    Array.isArray(incoming?.deletedEventIds) ? incoming.deletedEventIds.map(String) : []
  );
  const deletedParticipantIds = new Set(
    Array.isArray(incoming?.deletedParticipantIds)
      ? incoming.deletedParticipantIds.map(String)
      : []
  );

  const eventsMap = new Map();
  for (const e of current.events) {
    if (!deletedEventIds.has(e.id)) {
      eventsMap.set(e.id, e);
    }
  }
  for (const e of cleanIncoming.events) {
    if (!deletedEventIds.has(e.id)) {
      eventsMap.set(e.id, e);
    }
  }

  const participantsMap = new Map();
  for (const p of current.participants) {
    if (!deletedEventIds.has(p.event_id) && !deletedParticipantIds.has(p.id)) {
      participantsMap.set(p.id, p);
    }
  }
  for (const p of cleanIncoming.participants) {
    if (!deletedEventIds.has(p.event_id) && !deletedParticipantIds.has(p.id)) {
      participantsMap.set(p.id, p);
    }
  }

  const availabilitiesMap = new Map();
  for (const a of current.availabilities) {
    if (!deletedEventIds.has(a.event_id) && !deletedParticipantIds.has(a.participant_id)) {
      availabilitiesMap.set(`${a.participant_id}_${a.date}_${a.time_slot}`, a);
    }
  }
  for (const a of cleanIncoming.availabilities) {
    if (!deletedEventIds.has(a.event_id) && !deletedParticipantIds.has(a.participant_id)) {
      availabilitiesMap.set(`${a.participant_id}_${a.date}_${a.time_slot}`, a);
    }
  }

  return {
    events: Array.from(eventsMap.values()),
    participants: Array.from(participantsMap.values()),
    availabilities: Array.from(availabilitiesMap.values()),
  };
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const db = readDb();
    res.status(200).json(db);
    return;
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const current = readDb();
      const merged = writeDb(mergeDb(current, payload));
      res.status(200).json(merged);
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

