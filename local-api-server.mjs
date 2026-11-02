import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '.local-sync-db.json');
const DEMO_EVENT_ID = '11111111-2222-3333-4444-555555555555';
const PORT = 4201;

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

function sanitizeDb(db) {
  const events = Array.isArray(db?.events)
    ? db.events.filter((e) => e && e.id !== DEMO_EVENT_ID)
    : [];
  const participants = Array.isArray(db?.participants)
    ? db.participants.filter((p) => p && p.event_id !== DEMO_EVENT_ID)
    : [];
  const availabilities = Array.isArray(db?.availabilities)
    ? db.availabilities.filter((a) => a && a.event_id !== DEMO_EVENT_ID)
    : [];
  return { events, participants, availabilities };
}

function writeDb(db) {
  const clean = sanitizeDb(db);
  fs.writeFileSync(DB_FILE, JSON.stringify(clean, null, 2), 'utf8');
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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
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
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Port 4201 already running another instance of local-api-server
    process.exit(0);
  }
  console.error('Local sync server error:', err);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SyncUp local shared DB server listening on http://127.0.0.1:${PORT}/api/db`);
});

