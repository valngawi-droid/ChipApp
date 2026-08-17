/**
 * ChipApp Persistent Database — Supports both Free Plan and Paid Plan
 * 
 * Free plan di Render/Vercel: filesystem ephemeral (hilang saat restart), jadi butuh external DB gratis.
 * Solusi:
 *  - Default: File JSON (backend/data) — works everywhere, Termux, local, Render/Vercel free (tapi hilang saat sleep)
 *  - Jika DATABASE_URL diset: pakai Postgres eksternal (Neon, Supabase, Render Postgres free) — PERSISTENT bahkan di free plan!
 *  - Jika DATA_DIR diset (mis /data dengan Disk): pakai File JSON di disk persistent (Starter plan+)
 * 
 * Prioritas:
 *  1. DATABASE_URL -> Postgres (recommended untuk free plan persistent, Vercel+Neon, Render+Neon)
 *  2. DATA_DIR file JSON (dengan Disk di Render Starter+)
 *  3. Default file JSON di backend/data (free ephemeral)
 * 
 * Pure JS + pg (no native) — tetap jalan di Termux, Render, Vercel.
 * Support env: DATABASE_URL, POSTGRES_URL, NEON_DATABASE_URL, STORAGE_URL, STORAGE_DATABASE_URL (Vercel Neon integration)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(__dirname, 'data');
const USERS_FILE = 'users.json';
const MESSAGES_FILE = 'messages.json';
const CHATS_FILE = 'chats.json';
const META_FILE = 'meta.json';

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); return true; }
  catch (e) { console.warn(`[db] Failed to ensure dir ${dir}: ${e.message}`); return false; }
}

function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[db] Failed to read ${filePath}: ${e.message}`);
    try {
      const bak = `${filePath}.bak`;
      if (fs.existsSync(bak)) return JSON.parse(fs.readFileSync(bak, 'utf8'));
    } catch {}
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    const tmp = `${filePath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    try { if (fs.existsSync(filePath)) fs.copyFileSync(filePath, `${filePath}.bak`); } catch {}
    fs.renameSync(tmp, filePath);
    return true;
  } catch (e) {
    console.error(`[db] Failed to write ${filePath}: ${e.message}`);
    return false;
  }
}

/* ===================== File JSON DB (default) ===================== */
class FileDB {
  constructor(dataDir = DEFAULT_DIR) {
    this.type = 'file-json';
    this.dataDir = dataDir;
    this.users = {};
    this.messages = {};
    this.chats = {};
    this.meta = { version: '4.2.0', createdAt: new Date().toISOString(), lastCompaction: null, totalMessages: 0, totalUsers: 0 };
    this._dirty = { users: false, messages: false, chats: false, meta: false };
    ensureDir(this.dataDir);
    this.load();
    setInterval(() => this.flushIfDirty(), 5000).unref();
  }

  load() {
    console.log(`[db] FileDB loading from ${this.dataDir}`);
    this.users = safeReadJson(path.join(this.dataDir, USERS_FILE), {});
    this.messages = safeReadJson(path.join(this.dataDir, MESSAGES_FILE), {});
    this.chats = safeReadJson(path.join(this.dataDir, CHATS_FILE), {});
    this.meta = { ...this.meta, ...safeReadJson(path.join(this.dataDir, META_FILE), this.meta) };
    if (Array.isArray(this.messages)) {
      const migrated = {};
      for (const m of this.messages) {
        const room = m.room || m.chatId || 'general';
        if (!migrated[room]) migrated[room] = [];
        migrated[room].push(m);
      }
      this.messages = migrated;
      this._dirty.messages = true;
    }
    const userCount = Object.keys(this.users).length;
    const roomCount = Object.keys(this.messages).length;
    let msgCount = 0;
    for (const arr of Object.values(this.messages)) msgCount += arr.length;
    console.log(`[db] FileDB loaded ${userCount} users, ${roomCount} rooms, ${msgCount} msgs`);
    this.meta.totalUsers = userCount;
    this.meta.totalMessages = msgCount;
  }

  flushIfDirty() {
    if (!Object.values(this._dirty).some(Boolean)) return;
    this.saveAll();
  }

  saveAll() {
    if (this._dirty.users) { safeWriteJson(path.join(this.dataDir, USERS_FILE), this.users); this._dirty.users = false; }
    if (this._dirty.messages) { safeWriteJson(path.join(this.dataDir, MESSAGES_FILE), this.messages); this._dirty.messages = false; }
    if (this._dirty.chats) { safeWriteJson(path.join(this.dataDir, CHATS_FILE), this.chats); this._dirty.chats = false; }
    if (this._dirty.meta) { this.meta.lastCompaction = new Date().toISOString(); safeWriteJson(path.join(this.dataDir, META_FILE), this.meta); this._dirty.meta = false; }
  }

  getUserById(googleId) { return this.users[googleId] || null; }
  getUserByEmail(email) {
    const lower = (email || '').toLowerCase();
    return Object.values(this.users).find((u) => (u.email || '').toLowerCase() === lower) || null;
  }
  saveUser(user) {
    if (!user?.googleId) return null;
    const existing = this.users[user.googleId] || {};
    const merged = { ...existing, ...user, googleId: user.googleId, updatedAt: new Date().toISOString(), createdAt: existing.createdAt || new Date().toISOString() };
    this.users[user.googleId] = merged;
    this._dirty.users = true;
    this.meta.totalUsers = Object.keys(this.users).length;
    this._dirty.meta = true;
    safeWriteJson(path.join(this.dataDir, USERS_FILE), this.users);
    this._dirty.users = false;
    console.log(`[db] saved user ${user.email} (${user.googleId})`);
    return merged;
  }
  getAllUsers() { return Object.values(this.users); }

  getMessages(roomId, limit = 100) {
    const all = this.messages[roomId] || [];
    return limit > 0 ? all.slice(-limit) : all;
  }
  getAllMessages() { return this.messages; }
  getMessageCount(roomId) { return (this.messages[roomId] || []).length; }

  saveMessage(roomId, message) {
    if (!roomId || !message?.id) return false;
    if (!this.messages[roomId]) this.messages[roomId] = [];
    const idx = this.messages[roomId].findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      this.messages[roomId][idx] = { ...this.messages[roomId][idx], ...message, updatedAt: new Date().toISOString() };
    } else {
      this.messages[roomId].push({ ...message, room: roomId, savedAt: new Date().toISOString() });
      const MAX = Number(process.env.MAX_MESSAGES_PER_ROOM || 1000);
      if (this.messages[roomId].length > MAX) this.messages[roomId] = this.messages[roomId].slice(-MAX);
    }
    if (!this.chats[roomId]) this.chats[roomId] = {};
    this.chats[roomId].lastMessage = message.text || this.chats[roomId].lastMessage || '';
    this.chats[roomId].lastTimestamp = message.timestamp || new Date().toISOString();
    this.chats[roomId].messageCount = this.messages[roomId].length;
    this.chats[roomId].updatedAt = new Date().toISOString();
    this._dirty.messages = true;
    this._dirty.chats = true;
    this.meta.totalMessages = Object.values(this.messages).reduce((s, a) => s + a.length, 0);
    this._dirty.meta = true;
    setImmediate(() => {
      safeWriteJson(path.join(this.dataDir, MESSAGES_FILE), this.messages);
      safeWriteJson(path.join(this.dataDir, CHATS_FILE), this.chats);
      safeWriteJson(path.join(this.dataDir, META_FILE), this.meta);
      this._dirty.messages = false;
      this._dirty.chats = false;
      this._dirty.meta = false;
    });
    return true;
  }

  deleteMessage(roomId, messageId) {
    if (!this.messages[roomId]) return false;
    const before = this.messages[roomId].length;
    this.messages[roomId] = this.messages[roomId].filter((m) => m.id !== messageId);
    if (this.messages[roomId].length !== before) {
      this._dirty.messages = true;
      safeWriteJson(path.join(this.dataDir, MESSAGES_FILE), this.messages);
      this._dirty.messages = false;
      return true;
    }
    return false;
  }

  getChatMeta(roomId) { return this.chats[roomId] || null; }
  getAllChatsMeta() { return this.chats; }

  getStats() {
    return {
      type: this.type,
      dataDir: this.dataDir,
      users: Object.keys(this.users).length,
      rooms: Object.keys(this.messages).length,
      totalMessages: this.meta.totalMessages,
      chatsMeta: Object.keys(this.chats).length,
      meta: this.meta,
      persistent: true,
      freePlanNote: 'File JSON ephemeral on Render/Vercel free without DATABASE_URL - use NeonDB for true persistent',
    };
  }

  clearAll() {
    this.users = {}; this.messages = {}; this.chats = {};
    this.meta.totalUsers = 0; this.meta.totalMessages = 0;
    this._dirty.users = this._dirty.messages = this._dirty.chats = this._dirty.meta = true;
    this.saveAll();
    console.log('[db] cleared');
  }
}

/* ===================== Postgres DB (Vercel+Neon, Render+Neon) ===================== */
class PostgresDB {
  constructor(connectionString) {
    this.type = 'postgres';
    this.connectionString = connectionString;
    this.ready = false;
    try {
      const { Pool } = require('pg');
      this.pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
      });
      this.pool.on('error', (e) => console.error('[db] pg pool error', e.message));
      this.init().then(() => { this.ready = true; console.log('[db] PostgresDB ready'); }).catch((e) => console.error('[db] Postgres init failed', e.message));
    } catch (e) {
      console.error('[db] pg not available', e.message);
      this.pool = null;
      throw e;
    }
  }

  async init() {
    if (!this.pool) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS chipapp_users (google_id TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, provider TEXT, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS chipapp_messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, text TEXT, kind TEXT, author TEXT, author_name TEXT, author_id TEXT, timestamp TIMESTAMPTZ, data JSONB, saved_at TIMESTAMPTZ DEFAULT NOW());`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_room ON chipapp_messages(room, timestamp);`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS chipapp_chats (room TEXT PRIMARY KEY, last_message TEXT, last_timestamp TIMESTAMPTZ, message_count INT DEFAULT 0, data JSONB, updated_at TIMESTAMPTZ DEFAULT NOW());`);
    console.log('[db] Postgres tables ensured');
  }

  async getUserById(googleId) {
    if (!this.pool) return null;
    const res = await this.pool.query('SELECT * FROM chipapp_users WHERE google_id=$1', [googleId]);
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return { googleId: row.google_id, email: row.email, name: row.name, picture: row.picture, provider: row.provider, ...row.data, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async getUserByEmail(email) {
    if (!this.pool) return null;
    const res = await this.pool.query('SELECT * FROM chipapp_users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return { googleId: row.google_id, email: row.email, name: row.name, picture: row.picture, provider: row.provider, ...row.data, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async saveUser(user) {
    if (!user?.googleId || !this.pool) return null;
    await this.pool.query(
      `INSERT INTO chipapp_users (google_id, email, name, picture, provider, data, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture, provider=EXCLUDED.provider, data=EXCLUDED.data, updated_at=NOW()`,
      [user.googleId, user.email, user.name, user.picture || null, user.provider || 'unknown', JSON.stringify(user)]
    );
    console.log(`[db] Postgres saved user ${user.email}`);
    return user;
  }

  async getAllUsers() {
    if (!this.pool) return [];
    const res = await this.pool.query('SELECT * FROM chipapp_users ORDER BY created_at DESC LIMIT 1000');
    return res.rows.map((row) => ({ googleId: row.google_id, email: row.email, name: row.name, picture: row.picture, provider: row.provider, ...row.data, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async getMessages(roomId, limit = 100) {
    if (!this.pool) return [];
    if (limit > 0) {
      const res = await this.pool.query('SELECT * FROM (SELECT * FROM chipapp_messages WHERE room=$1 ORDER BY timestamp DESC LIMIT $2) sub ORDER BY timestamp ASC', [roomId, limit]);
      return res.rows.map((row) => ({ id: row.id, room: row.room, text: row.text, kind: row.kind, author: row.author, authorName: row.author_name, authorId: row.author_id, timestamp: row.timestamp, ...row.data }));
    }
    const res = await this.pool.query('SELECT * FROM chipapp_messages WHERE room=$1 ORDER BY timestamp ASC', [roomId]);
    return res.rows.map((row) => ({ id: row.id, room: row.room, text: row.text, kind: row.kind, author: row.author, authorName: row.author_name, authorId: row.author_id, timestamp: row.timestamp, ...row.data }));
  }

  async getAllMessages() {
    if (!this.pool) return {};
    const res = await this.pool.query('SELECT room FROM chipapp_messages GROUP BY room');
    const result = {};
    for (const r of res.rows) result[r.room] = await this.getMessages(r.room, 0);
    return result;
  }

  async getMessageCount(roomId) {
    if (!this.pool) return 0;
    const res = await this.pool.query('SELECT COUNT(*) FROM chipapp_messages WHERE room=$1', [roomId]);
    return parseInt(res.rows[0].count, 10);
  }

  async saveMessage(roomId, message) {
    if (!roomId || !message?.id || !this.pool) return false;
    await this.pool.query(
      `INSERT INTO chipapp_messages (id, room, text, kind, author, author_name, author_id, timestamp, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, data=EXCLUDED.data`,
      [message.id, roomId, message.text || '', message.kind || 'text', message.author || '', message.authorName || '', message.authorId || '', message.timestamp ? new Date(message.timestamp) : new Date(), JSON.stringify(message)]
    );
    const MAX = Number(process.env.MAX_MESSAGES_PER_ROOM || 1000);
    const count = await this.getMessageCount(roomId);
    if (count > MAX) {
      await this.pool.query(`DELETE FROM chipapp_messages WHERE room=$1 AND id NOT IN (SELECT id FROM chipapp_messages WHERE room=$1 ORDER BY timestamp DESC LIMIT $2)`, [roomId, MAX]);
    }
    await this.pool.query(
      `INSERT INTO chipapp_chats (room, last_message, last_timestamp, message_count, updated_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (room) DO UPDATE SET last_message=EXCLUDED.last_message, last_timestamp=EXCLUDED.last_timestamp, message_count=(SELECT COUNT(*) FROM chipapp_messages WHERE room=$1), updated_at=NOW()`,
      [roomId, message.text || '', message.timestamp ? new Date(message.timestamp) : new Date(), count]
    );
    return true;
  }

  async deleteMessage(roomId, messageId) {
    if (!this.pool) return false;
    const res = await this.pool.query('DELETE FROM chipapp_messages WHERE room=$1 AND id=$2', [roomId, messageId]);
    return res.rowCount > 0;
  }

  async getChatMeta(roomId) {
    if (!this.pool) return null;
    const res = await this.pool.query('SELECT * FROM chipapp_chats WHERE room=$1', [roomId]);
    return res.rows[0] || null;
  }

  async getAllChatsMeta() {
    if (!this.pool) return {};
    const res = await this.pool.query('SELECT * FROM chipapp_chats');
    const obj = {};
    for (const row of res.rows) obj[row.room] = row;
    return obj;
  }

  async getStats() {
    if (!this.pool) return { type: this.type, error: 'no pool' };
    const users = await this.pool.query('SELECT COUNT(*) FROM chipapp_users');
    const rooms = await this.pool.query('SELECT COUNT(DISTINCT room) FROM chipapp_messages');
    const msgs = await this.pool.query('SELECT COUNT(*) FROM chipapp_messages');
    const chats = await this.pool.query('SELECT COUNT(*) FROM chipapp_chats');
    return {
      type: this.type,
      users: parseInt(users.rows[0].count, 10),
      rooms: parseInt(rooms.rows[0].count, 10),
      totalMessages: parseInt(msgs.rows[0].count, 10),
      chatsMeta: parseInt(chats.rows[0].count, 10),
      persistent: true,
      freePlan: true,
      note: 'Postgres persistent even on Vercel/Render free plan!',
    };
  }

  async clearAll() {
    if (!this.pool) return;
    await this.pool.query('TRUNCATE chipapp_messages, chipapp_chats, chipapp_users');
    console.log('[db] Postgres cleared');
  }
}

/* ===================== Singleton ===================== */
let instance = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.STORAGE_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.STORAGE_NEON_DATABASE_URL ||
    process.env.NEON_POSTGRES_URL ||
    Object.entries(process.env).find(([k, v]) => /(_DATABASE_URL|_POSTGRES_URL)$/.test(k) && typeof v === 'string' && v.startsWith('postgres'))?.[1] ||
    null
  );
}

function getDB() {
  if (instance) return instance;
  const dbUrl = getDatabaseUrl();
  if (dbUrl) {
    const envName = Object.keys(process.env).find((k) => process.env[k] === dbUrl) || 'DATABASE_URL';
    console.log(`[db] ${envName} detected, trying PostgresDB`);
    try {
      instance = new PostgresDB(dbUrl);
      console.log('[db] Using PostgresDB — persistent even on Vercel/Render free!');
      return instance;
    } catch (e) {
      console.warn('[db] Postgres failed, falling back to FileDB', e.message);
    }
  }
  instance = new FileDB();
  if (process.env.NODE_ENV === 'production' && !dbUrl) {
    console.warn('[db] WARNING: File JSON ephemeral on free without DATABASE_URL — set DATABASE_URL (Neon free) for persistence');
  }
  return instance;
}

module.exports = { FileDB, PostgresDB, getDB, getDatabaseUrl, DEFAULT_DIR };
