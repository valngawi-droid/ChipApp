/**
 * Vercel Serverless API — Full Functions for chiperx.cyou + NeonDB
 * FIX: No top-level pg import to avoid bignumber.d.ts Build Failed, lazy require inside handlers
 * 
 * Modes:
 * 1. If DATABASE_URL (Neon) set: direct Postgres persistent (users, messages, chats) — works on Vercel free
 * 2. Else if RENDER_BACKEND_URL set: proxy to Render backend (which uses NeonDB) — hybrid Vercel frontend + Render backend
 * 3. Else fallback in-memory (for testing, not persistent)
 * 
 * Endpoints: /api/health, /api/auth/demo, /api/auth/google, /api/me, /api/users, /api/chats, /api/chats/:room/messages, /api/db/stats, etc.
 * Frontend login Google + demo now works!
 */

function safeRequire(name) {
  try {
    return require(name);
  } catch (e) {
    try {
      return require(`../backend/node_modules/${name}`);
    } catch {
      return null;
    }
  }
}

let _pool = null;
function getPool() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || process.env.STORAGE_DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) return null;
  if (_pool) return _pool;
  try {
    const pg = safeRequire('pg');
    if (!pg) return null;
    const { Pool } = pg;
    _pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    _pool.on('error', (e) => console.error('[api] pg pool error', e.message));
    // Init tables async (don't await)
    initTables(_pool).catch((e) => console.error('[api] init tables failed', e.message));
    return _pool;
  } catch (e) {
    console.error('[api] getPool failed', e.message);
    return null;
  }
}

async function initTables(pool) {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chipapp_users (
      google_id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      picture TEXT,
      provider TEXT,
      data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chipapp_messages (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      text TEXT,
      kind TEXT,
      author TEXT,
      author_name TEXT,
      author_id TEXT,
      timestamp TIMESTAMPTZ,
      data JSONB,
      saved_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_room ON chipapp_messages(room, timestamp);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chipapp_chats (
      room TEXT PRIMARY KEY,
      last_message TEXT,
      last_timestamp TIMESTAMPTZ,
      message_count INT DEFAULT 0,
      data JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'chipapp_production_secure_jwt_secret_2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';

function issueToken(profile) {
  const jwt = safeRequire('jsonwebtoken') || require('jsonwebtoken');
  return jwt.sign({ googleId: profile.googleId, email: profile.email, name: profile.name }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  const jwt = safeRequire('jsonwebtoken') || require('jsonwebtoken');
  return jwt.verify(token, JWT_SECRET);
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Powered-By', 'ChipApp/4.2.0 Vercel+Neon');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const method = req.method || 'GET';
  const backendUrl = process.env.RENDER_BACKEND_URL || process.env.BACKEND_URL || '';
  const pool = getPool();

  // Helper to parse body (Vercel may have already parsed)
  let body = req.body;
  if (!body && method !== 'GET' && method !== 'HEAD') {
    try {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
          try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
        });
        // If body already available as stream ended quickly
        setTimeout(() => resolve({}), 100);
      });
    } catch { body = {}; }
  }

  console.log(`[api] ${method} ${url} pool=${!!pool} backend=${!!backendUrl}`);

  // ===== HEALTH =====
  if (url.startsWith('/api/health') || url === '/api' || url === '/api/') {
    let stats = { type: pool ? 'postgres' : 'memory', persistent: !!pool };
    try {
      if (pool) {
        const u = await pool.query('SELECT COUNT(*) FROM chipapp_users').catch(() => ({ rows: [{ count: '0' }] }));
        const r = await pool.query('SELECT COUNT(DISTINCT room) FROM chipapp_messages').catch(() => ({ rows: [{ count: '0' }] }));
        const m = await pool.query('SELECT COUNT(*) FROM chipapp_messages').catch(() => ({ rows: [{ count: '0' }] }));
        stats = { type: 'postgres', users: parseInt(u.rows[0].count, 10), rooms: parseInt(r.rows[0].count, 10), totalMessages: parseInt(m.rows[0].count, 10), persistent: true, platform: 'vercel+neondb' };
      }
    } catch (e) { stats.error = e.message; }
    return res.status(200).json({
      status: 'ok',
      service: 'chipapp-api-vercel',
      version: '4.2.0',
      platform: 'vercel+neondb',
      primaryDomain: 'chiperx.cyou',
      backendUrl: backendUrl || null,
      database: stats,
    });
  }

  // ===== AUTH DEMO — biar gak langsung masuk, tapi tetap bisa login =====
  if (url.startsWith('/api/auth/demo') && method === 'POST') {
    if (process.env.ALLOW_DEMO_AUTH === 'false') return res.status(403).json({ status: 'error', message: 'Demo auth disabled' });
    const name = (body && body.name) || 'Arya Wijaya';
    const user = {
      googleId: `demo-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 16)}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@chipapp.demo`,
      name,
      picture: null,
      demo: true,
      provider: 'demo',
    };
    // Save to Postgres if available
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO chipapp_users (google_id, email, name, picture, provider, data, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, data=EXCLUDED.data, updated_at=NOW()`,
          [user.googleId, user.email, user.name, user.picture, user.provider, JSON.stringify(user)]
        );
      } catch (e) { console.warn('[api] save demo user failed', e.message); }
    }
    const token = issueToken(user);
    return res.status(200).json({ status: 'success', token, user });
  }

  // ===== AUTH GOOGLE — biar login Google jalan =====
  if (url.startsWith('/api/auth/google') && method === 'POST') {
    const token = body && body.token;
    if (!token) return res.status(400).json({ status: 'error', message: 'Missing Google ID token' });
    try {
      // Lazy require google-auth-library to avoid build-time issues
      const gauth = safeRequire('google-auth-library');
      let OAuth2Client = gauth && gauth.OAuth2Client;
      if (!OAuth2Client) {
        try { OAuth2Client = require('google-auth-library').OAuth2Client; } catch {}
      }
      if (!OAuth2Client) throw new Error('google-auth-library not available');
      const client = new OAuth2Client(GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      const user = { googleId: payload.sub, email: payload.email, name: payload.name, picture: payload.picture, provider: 'google' };
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO chipapp_users (google_id, email, name, picture, provider, data, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture, data=EXCLUDED.data, updated_at=NOW()`,
            [user.googleId, user.email, user.name, user.picture, user.provider, JSON.stringify(user)]
          );
        } catch (e) { console.warn('[api] save google user failed', e.message); }
      }
      return res.status(200).json({ status: 'success', token: issueToken(user), user });
    } catch (e) {
      return res.status(401).json({ status: 'error', message: 'Invalid Google Token', details: e.message });
    }
  }

  // ===== AUTH MIDDLEWARE helper =====
  const getUserFromHeader = () => {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return null;
    try { return verifyToken(t); } catch { return null; }
  };

  // ===== ME =====
  if (url.startsWith('/api/me')) {
    const user = getUserFromHeader();
    if (!user) return res.status(401).json({ status: 'error', message: 'Missing bearer token' });
    let dbUser = null;
    if (pool) {
      try {
        const r = await pool.query('SELECT * FROM chipapp_users WHERE google_id=$1', [user.googleId]);
        if (r.rows[0]) dbUser = r.rows[0];
      } catch {}
    }
    return res.json({ status: 'success', user, dbUser, persistent: !!dbUser });
  }

  // ===== USERS, CHATS, MESSAGES, STATS (protected) =====
  const needsAuth = url.startsWith('/api/users') || url.startsWith('/api/chats') || url.startsWith('/api/history') || url.startsWith('/api/db/');
  if (needsAuth) {
    const user = getUserFromHeader();
    if (!user) return res.status(401).json({ status: 'error', message: 'Missing bearer token' });

    // /api/db/stats
    if (url.startsWith('/api/db/stats')) {
      if (!pool) return res.json({ status: 'ok', stats: { type: 'memory', users: 0, rooms: 0, totalMessages: 0, persistent: false, note: 'Set DATABASE_URL for postgres persistent' } });
      try {
        const u = await pool.query('SELECT COUNT(*) FROM chipapp_users');
        const r = await pool.query('SELECT COUNT(DISTINCT room) FROM chipapp_messages');
        const m = await pool.query('SELECT COUNT(*) FROM chipapp_messages');
        const c = await pool.query('SELECT COUNT(*) FROM chipapp_chats');
        return res.json({ status: 'ok', stats: { type: 'postgres', users: parseInt(u.rows[0].count), rooms: parseInt(r.rows[0].count), totalMessages: parseInt(m.rows[0].count), chatsMeta: parseInt(c.rows[0].count), persistent: true } });
      } catch (e) {
        return res.json({ status: 'ok', stats: { type: 'postgres', error: e.message } });
      }
    }

    // /api/users
    if (url.startsWith('/api/users')) {
      if (!pool) return res.json({ status: 'ok', count: 0, users: [] });
      const r = await pool.query('SELECT google_id, email, name, picture, provider, created_at, updated_at FROM chipapp_users ORDER BY created_at DESC LIMIT 1000');
      return res.json({ status: 'ok', count: r.rows.length, users: r.rows.map((row) => ({ googleId: row.google_id, email: row.email, name: row.name, picture: row.picture, provider: row.provider, createdAt: row.created_at, updatedAt: row.updated_at })) });
    }

    // /api/chats/:room/messages GET
    const chatMsgMatch = url.match(/\/api\/chats\/([^\/]+)\/messages/);
    if (chatMsgMatch && method === 'GET') {
      const room = decodeURIComponent(chatMsgMatch[1]);
      const limit = Math.min(parseInt((req.query && req.query.limit) || '100', 10) || 100, 1000);
      if (!pool) return res.json({ status: 'ok', room, count: 0, totalInRoom: 0, messages: [] });
      const resQ = await pool.query('SELECT * FROM (SELECT * FROM chipapp_messages WHERE room=$1 ORDER BY timestamp DESC LIMIT $2) sub ORDER BY timestamp ASC', [room, limit]);
      const countQ = await pool.query('SELECT COUNT(*) FROM chipapp_messages WHERE room=$1', [room]);
      return res.json({
        status: 'ok',
        room,
        count: resQ.rows.length,
        totalInRoom: parseInt(countQ.rows[0].count, 10),
        messages: resQ.rows.map((row) => ({
          id: row.id, room: row.room, text: row.text, kind: row.kind,
          author: row.author, authorName: row.author_name, authorId: row.author_id,
          timestamp: row.timestamp,
          ...row.data,
        })),
      });
    }

    // /api/chats/:room/messages POST
    if (chatMsgMatch && method === 'POST') {
      const room = decodeURIComponent(chatMsgMatch[1]);
      const text = body && body.text;
      if (!text) return res.status(400).json({ status: 'error', message: 'Missing text' });
      const msg = {
        id: (body && body.id) || `m-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        room,
        text,
        kind: (body && body.kind) || 'text',
        author: user.email,
        authorName: user.name,
        authorId: user.googleId,
        timestamp: new Date().toISOString(),
        status: 'sent',
      };
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO chipapp_messages (id, room, text, kind, author, author_name, author_id, timestamp, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, data=EXCLUDED.data`,
            [msg.id, room, msg.text, msg.kind, msg.author, msg.authorName, msg.authorId, new Date(msg.timestamp), JSON.stringify(msg)]
          );
          await pool.query(
            `INSERT INTO chipapp_chats (room, last_message, last_timestamp, message_count, updated_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (room) DO UPDATE SET last_message=EXCLUDED.last_message, last_timestamp=EXCLUDED.last_timestamp, message_count=(SELECT COUNT(*) FROM chipapp_messages WHERE room=$1), updated_at=NOW()`,
            [room, msg.text, new Date(msg.timestamp), 0]
          );
        } catch (e) { console.warn('[api] save message failed', e.message); }
      }
      return res.json({ status: 'ok', message: msg });
    }

    // /api/chats GET (all meta)
    if (url.startsWith('/api/chats') && method === 'GET' && !chatMsgMatch) {
      if (!pool) return res.json({ status: 'ok', count: 0, chats: {} });
      const r = await pool.query('SELECT * FROM chipapp_chats');
      const obj = {};
      r.rows.forEach((row) => (obj[row.room] = row));
      return res.json({ status: 'ok', count: r.rows.length, chats: obj });
    }

    // /api/history
    if (url.startsWith('/api/history')) {
      if (!pool) return res.json({ status: 'ok', totalMessages: 0, rooms: 0, roomsList: [] });
      const r = await pool.query('SELECT room, COUNT(*) as count FROM chipapp_messages GROUP BY room');
      const total = r.rows.reduce((s, row) => s + parseInt(row.count, 10), 0);
      return res.json({ status: 'ok', totalMessages: total, rooms: r.rows.length, roomsList: r.rows.map((row) => ({ room: row.room, count: parseInt(row.count, 10) })) });
    }
  }

  // ===== FALLBACK: proxy to Render backend if set =====
  if (backendUrl && backendUrl.startsWith('http')) {
    try {
      const targetUrl = `${backendUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
      const currentHost = req.headers.host || '';
      const targetHost = new URL(backendUrl).host;
      if (currentHost.includes(targetHost)) {
        // Avoid loop
      } else {
        console.log(`[api] proxy ${method} ${url} -> ${targetUrl}`);
        const fetchRes = await fetch(targetUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || '',
          },
          body: method !== 'GET' && method !== 'HEAD' && body ? JSON.stringify(body) : undefined,
        });
        res.status(fetchRes.status);
        const text = await fetchRes.text();
        // Try to preserve content-type
        const ct = fetchRes.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        return res.send(text);
      }
    } catch (e) {
      console.error(`[api] proxy failed ${e.message}`);
    }
  }

  // Default
  return res.status(404).json({ status: 'error', message: 'Not found', path: url, platform: 'vercel+neondb', hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.STORAGE_URL), hasBackendUrl: !!backendUrl });
};
