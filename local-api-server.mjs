import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '.local-sync-db.json');
const DEMO_EVENT_ID = '11111111-2222-3333-4444-555555555555';
const PORT = 4201;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB limit to prevent memory exhaustion DoS

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SLOTS = new Set(['morning', 'afternoon', 'evening']);

function isValidString(val, maxLen = 256) {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

function sanitizeDb(db) {
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

  const validEventIds = new Set(events.map((e) => e.id));

  const participants = [];
  if (Array.isArray(db?.participants)) {
    for (const p of db.participants) {
      if (
        p &&
        isValidString(p.id, 100) &&
        isValidString(p.event_id, 100) &&
        p.event_id !== DEMO_EVENT_ID &&
        validEventIds.has(p.event_id) &&
        isValidString(p.name, 60)
      ) {
        participants.push({
          id: String(p.id).trim(),
          event_id: String(p.event_id).trim(),
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
      if (
        a &&
        isValidString(a.participant_id, 100) &&
        isValidString(a.event_id, 100) &&
        validEventIds.has(a.event_id) &&
        validParticipantIds.has(a.participant_id) &&
        DATE_REGEX.test(String(a.date)) &&
        VALID_SLOTS.has(a.time_slot)
      ) {
        availabilities.push({
          id: isValidString(a.id, 100) ? String(a.id) : `${a.participant_id}_${a.date}_${a.time_slot}`,
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
      return sanitizeDb(parsed);
    }
  } catch {
    // ignore read errors
  }
  return { events: [], participants: [], availabilities: [] };
}

function writeDb(db) {
  const clean = sanitizeDb(db);
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(clean, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
  return clean;
}

function mergeDb(current, incoming) {
  const cleanIncoming = sanitizeDb(incoming);
  const eventsMap = new Map();
  for (const e of current.events) eventsMap.set(e.id, e);
  for (const e of cleanIncoming.events) {
    if (!eventsMap.has(e.id)) {
      eventsMap.set(e.id, e);
    }
  }

  const participantsMap = new Map();
  for (const p of current.participants) participantsMap.set(p.id, p);
  for (const p of cleanIncoming.participants) {
    if (!participantsMap.has(p.id)) {
      participantsMap.set(p.id, p);
    }
  }

  const availabilitiesMap = new Map();
  for (const a of current.availabilities) {
    availabilitiesMap.set(`${a.participant_id}_${a.date}_${a.time_slot}`, a);
  }
  for (const a of cleanIncoming.availabilities) {
    const key = `${a.participant_id}_${a.date}_${a.time_slot}`;
    if (!availabilitiesMap.has(key)) {
      availabilitiesMap.set(key, a);
    }
  }

  return {
    events: Array.from(eventsMap.values()),
    participants: Array.from(participantsMap.values()),
    availabilities: Array.from(availabilitiesMap.values()),
  };
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  // Allow localhost / 127.0.0.1 / private LAN dev origins only
  if (
    !origin ||
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost:4200');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/db' && req.method === 'GET') {
    const db = readDb();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db));
    return;
  }

  if ((req.url === '/api/db' || req.url === '/api/db/merge') && req.method === 'POST') {
    let body = '';
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        const payload = JSON.parse(body || '{}');
        let result;
        if (req.url === '/api/db/merge') {
          const current = readDb();
          result = writeDb(mergeDb(current, payload));
        } else {
          result = writeDb(payload);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    process.exit(0);
  }
  console.error('Local sync server error:', err);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Zynci local shared DB server listening on http://127.0.0.1:${PORT}/api/db`);
});
