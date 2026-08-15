/**
 * Storage backend for ChipApp.
 *
 * Uses MySQL when DATABASE_URL or individual MYSQL_* variables are set, and
 * falls back to an in-memory store otherwise. All methods are async so the
 * call sites don't care which engine is active.
 *
 * Schema (auto-created):
 *   users(id PK, googleId, email, name, picture, lastSeen)
 *   rooms(id PK, isDirect, createdAt)
 *   room_members(roomId, userId, PK(roomId,userId))
 *   messages(id PK, roomId, authorId, kind, text, reactionsJson, deleted, createdAt, editedAt)
 */
const crypto = require('crypto');

const hasMysql = !!(process.env.DATABASE_URL || process.env.MYSQL_HOST);

/* ----------------------------- MySQL driver ----------------------------- */

let pool = null;
let ready = false;
let usingMysql = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  googleId VARCHAR(128),
  email VARCHAR(190) UNIQUE,
  name VARCHAR(120),
  picture TEXT,
  lastSeen BIGINT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(128) PRIMARY KEY,
  isDirect TINYINT(1) DEFAULT 1,
  createdAt BIGINT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_members (
  roomId VARCHAR(128),
  userId VARCHAR(64),
  PRIMARY KEY (roomId, userId),
  INDEX idx_user (userId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  roomId VARCHAR(128),
  authorId VARCHAR(64),
  kind VARCHAR(16) DEFAULT 'text',
  text TEXT,
  reactionsJson TEXT,
  deleted TINYINT(1) DEFAULT 0,
  createdAt BIGINT,
  editedAt BIGINT,
  INDEX idx_room (roomId, createdAt)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

function parseConn() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return {
        host: u.hostname,
        port: u.port ? Number(u.port) : 3306,
        user: u.username || 'root',
        password: u.password || '',
        database: (u.pathname || '/').slice(1) || 'chipapp',
      };
    } catch {
      /* fall through */
    }
  }
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'chipapp',
  };
}

async function initMysql() {
  const mysql = require('mysql2/promise');
  const cfg = parseConn();
  // Connect without a database first so we can create it.
  const bootstrap = await mysql.createConnection({ ...cfg, database: undefined });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();
  pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 10 });
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await pool.query(stmt);
  }
  usingMysql = true;
  ready = true;
  console.log(`[storage] MySQL connected (${cfg.host}/${cfg.database})`);
}

/* ----------------------------- In-memory ----------------------------- */

const mem = {
  users: new Map(),
  rooms: new Map(),
  members: new Map(), // roomId -> Set<userId>
  messages: new Map(), // roomId -> array
};

const memReady = Promise.resolve();

/* ----------------------------- Public API ----------------------------- */

async function init() {
  if (!hasMysql) {
    ready = true;
    usingMysql = false;
    console.log('[storage] using in-memory store (no DATABASE_URL / MYSQL_HOST set)');
    return;
  }
  try {
    await initMysql();
  } catch (e) {
    console.warn('[storage] MySQL unavailable, falling back to in-memory:', e.message);
    pool = null;
    usingMysql = false;
    ready = true;
  }
}

function q(sql, params = []) {
  if (!pool) throw new Error('MySQL not connected');
  return pool.execute(sql, params);
}

const store = {
  get engine() {
    return usingMysql ? 'mysql' : 'memory';
  },
  ready: () => (pool ? ready : true),

  async upsertUser(u) {
    if (usingMysql) {
      await q(
        `INSERT INTO users (id, googleId, email, name, picture, lastSeen)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE googleId=VALUES(googleId), name=VALUES(name),
           picture=VALUES(picture), lastSeen=VALUES(lastSeen)`,
        [u.id, u.googleId ?? null, u.email, u.name ?? null, u.picture ?? null, u.lastSeen ?? Date.now()]
      );
      return this.getUser(u.id);
    }
    mem.users.set(u.id, { ...mem.users.get(u.id), ...u });
    return { ...mem.users.get(u.id) };
  },

  async getUser(id) {
    if (usingMysql) {
      const [rows] = await q('SELECT * FROM users WHERE id=?', [id]);
      if (!rows.length) return null;
      const r = rows[0];
      return { id: r.id, googleId: r.googleId, email: r.email, name: r.name, picture: r.picture, lastSeen: r.lastSeen };
    }
    return mem.users.get(id) ? { ...mem.users.get(id) } : null;
  },

  async listUsers() {
    if (usingMysql) {
      const [rows] = await q('SELECT * FROM users ORDER BY lastSeen DESC LIMIT 500');
      return rows.map((r) => ({
        id: r.id, googleId: r.googleId, email: r.email, name: r.name, picture: r.picture, lastSeen: r.lastSeen,
      }));
    }
    return [...mem.users.values()].map((u) => ({ ...u }));
  },

  async touchUser(id) {
    const now = Date.now();
    if (usingMysql) {
      await q('UPDATE users SET lastSeen=? WHERE id=?', [now, id]);
    } else if (mem.users.has(id)) {
      mem.users.get(id).lastSeen = now;
    }
  },

  async ensureRoom(id, isDirect = true, memberIds = []) {
    if (usingMysql) {
      await q(
        `INSERT IGNORE INTO rooms (id, isDirect, createdAt) VALUES (?,?,?)`,
        [id, isDirect ? 1 : 0, Date.now()]
      );
      for (const uid of memberIds) {
        await q(`INSERT IGNORE INTO room_members (roomId, userId) VALUES (?,?)`, [id, uid]);
      }
      return;
    }
    if (!mem.rooms.has(id)) {
      mem.rooms.set(id, { id, isDirect, createdAt: Date.now() });
      mem.messages.set(id, []);
    }
    if (!mem.members.has(id)) mem.members.set(id, new Set());
    memberIds.forEach((uid) => mem.members.get(id).add(uid));
  },

  async addMember(roomId, userId) {
    if (usingMysql) {
      await q(`INSERT IGNORE INTO room_members (roomId, userId) VALUES (?,?)`, [roomId, userId]);
      return;
    }
    if (!mem.members.has(roomId)) mem.members.set(roomId, new Set());
    mem.members.get(roomId).add(userId);
  },

  async isMember(roomId, userId) {
    if (usingMysql) {
      const [rows] = await q('SELECT 1 FROM room_members WHERE roomId=? AND userId=? LIMIT 1', [roomId, userId]);
      return rows.length > 0;
    }
    return mem.members.get(roomId)?.has(userId) ?? false;
  },

  async getMembers(roomId) {
    if (usingMysql) {
      const [rows] = await q('SELECT userId FROM room_members WHERE roomId=?', [roomId]);
      return rows.map((r) => r.userId);
    }
    return [...(mem.members.get(roomId) ?? [])];
  },

  async saveMessage(m) {
    if (usingMysql) {
      await q(
        `INSERT INTO messages (id, roomId, authorId, kind, text, reactionsJson, deleted, createdAt, editedAt)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE text=VALUES(text), reactionsJson=VALUES(reactionsJson),
           deleted=VALUES(deleted), editedAt=VALUES(editedAt)`,
        [
          m.id, m.room, m.author, m.kind || 'text', m.text || '',
          JSON.stringify(m.reactions ? Object.fromEntries(Object.entries(m.reactions).map(([k, v]) => [k, [...v]])) : {}),
          m.deleted ? 1 : 0,
          new Date(m.timestamp).getTime(),
          m.editedAt ? new Date(m.editedAt).getTime() : null,
        ]
      );
      return;
    }
    if (!mem.messages.has(m.room)) mem.messages.set(m.room, []);
    const list = mem.messages.get(m.room);
    const idx = list.findIndex((x) => x.id === m.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...m };
    else list.push({ ...m });
    const cap = Number(process.env.HISTORY_LIMIT || 500);
    if (list.length > cap) list.splice(0, list.length - cap);
  },

  async loadHistory(roomId, limit = 200) {
    if (usingMysql) {
      const [rows] = await q(
        'SELECT * FROM messages WHERE roomId=? ORDER BY createdAt DESC LIMIT ?',
        [roomId, limit]
      );
      return rows
        .map((r) => ({
          id: r.id,
          room: r.roomId,
          author: r.authorId,
          kind: r.kind,
          text: r.deleted ? '' : r.text,
          deleted: !!r.deleted,
          timestamp: new Date(r.createdAt).toISOString(),
          editedAt: r.editedAt ? new Date(r.editedAt).toISOString() : undefined,
          reactions: safeParseReactions(r.reactionsJson),
        }))
        .reverse();
    }
    const list = mem.messages.get(roomId) ?? [];
    return list.slice(-limit).map((m) => ({ ...m }));
  },

  async findMessage(roomId, messageId) {
    if (usingMysql) {
      const [rows] = await q('SELECT * FROM messages WHERE roomId=? AND id=? LIMIT 1', [roomId, messageId]);
      if (!rows.length) return null;
      const r = rows[0];
      return {
        id: r.id, room: r.roomId, author: r.authorId, kind: r.kind, text: r.text,
        deleted: !!r.deleted, timestamp: new Date(r.createdAt).toISOString(),
        editedAt: r.editedAt ? new Date(r.editedAt).toISOString() : undefined,
        reactions: safeParseReactions(r.reactionsJson),
      };
    }
    return (mem.messages.get(roomId) ?? []).find((m) => m.id === messageId) ?? null;
  },

  async deleteMessageForMe(roomId, messageId) {
    if (usingMysql) {
      await q('DELETE FROM messages WHERE roomId=? AND id=?', [roomId, messageId]);
      return;
    }
    const list = mem.messages.get(roomId);
    if (!list) return;
    const i = list.findIndex((m) => m.id === messageId);
    if (i >= 0) list.splice(i, 1);
  },

  newId(prefix = 'm') {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  },
};

function safeParseReactions(json) {
  try {
    const obj = json ? JSON.parse(json) : {};
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Array.isArray(v) ? v : []]));
  } catch {
    return {};
  }
}

module.exports = { store, init, memReady };
