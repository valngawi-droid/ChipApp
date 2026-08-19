require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const { store, init: initStore } = require('./store');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Domains pribadi yang boleh mengakses API/socket. Dapat di-override dengan
// ALLOWED_ORIGINS (dipisah koma). Native app (origin kosong) selalu diizinkan.
const DEFAULT_ORIGINS = [
  'https://chiperx.cyou',
  'https://www.chiperx.cyou',
  'https://chiperx.my.id',
  'https://www.chiperx.my.id',
  'https://pallrzki.my.id',
  'https://www.pallrzki.my.id',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .concat(DEFAULT_ORIGINS);

const isAllowedOrigin = (origin) =>
  !origin ||
  allowedOrigins.includes(origin) ||
  // Izinkan subdomain dari domain utama (mis. app.chiperx.cyou).
  allowedOrigins.some((o) => {
    try {
      const allowed = new URL(o);
      return origin.endsWith(`.${allowed.hostname}`);
    } catch {
      return false;
    }
  });

const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST'],
    credentials: false,
  },
  transports: ['polling', 'websocket'],
  maxHttpBufferSize: 1e6,
});

app.use(express.json({ limit: '1mb' }));
app.use(cors(corsOptions));

const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'chipapp_production_secure_jwt_secret_2026';
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT || 500);

const googleClient = new OAuth2Client(CLIENT_ID);

/* ------------------------------------------------------------------ *
 * Presence (in-memory only; persistence is for messages/users)
 * ------------------------------------------------------------------ */
const userSockets = new Map(); // userId -> Set<socket.id>
const AVATAR_COLORS = [
  '#007AFF', '#34C759', '#5856D6', '#FF9500', '#FF2D55',
  '#AF52DE', '#5AC8FA', '#FF3B30', '#A2845E', '#00C7BE',
];
const avatarColorFor = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  picture: u.picture ?? null,
  avatarColor: avatarColorFor(u.id),
  online: (userSockets.get(u.id)?.size ?? 0) > 0,
  lastSeen: u.lastSeen,
});

const directRoomId = (a, b) => [a, b].sort().join('::');
const emitToUser = (userId, event, payload) => {
  const socks = userSockets.get(userId);
  if (!socks) return;
  for (const sid of socks) io.to(sid).emit(event, payload);
};
const broadcastPresence = async () => {
  io.emit('presence', { users: (await store.listUsers()).map(publicUser) });
};

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */
const issueSession = (profile) =>
  jwt.sign(
    { id: profile.id, googleId: profile.googleId, email: profile.email, name: profile.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ status: 'error', message: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: 'Invalid or expired session', details: error.message });
  }
};

/* ------------------------------------------------------------------ *
 * REST
 * ------------------------------------------------------------------ */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chipapp-backend',
    version: '5.1.0',
    domains: ['chiperx.cyou', 'chiperx.my.id', 'pallrzki.my.id'],
    storage: store.engine,
    uptimeSec: Math.round(process.uptime()),
    sockets: io.engine.clientsCount,
    googleClientId: `${CLIENT_ID.slice(0, 12)}…`,
  });
});

app.post('/api/auth/google/exchange', async (req, res) => {
  const { googleId, email, name, picture } = req.body || {};
  if (!googleId || !email) return res.status(400).json({ status: 'error', message: 'Missing Google profile' });
  const user = await store.upsertUser({
    id: `g-${googleId}`, googleId, email, name: name || email, picture: picture ?? null, lastSeen: Date.now(),
  });
  res.json({ status: 'success', token: issueSession(user), user: publicUser(user) });
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ status: 'error', message: 'Missing Google ID token' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const p = ticket.getPayload();
    const user = await store.upsertUser({
      id: `g-${p.sub}`, googleId: p.sub, email: p.email, name: p.name, picture: p.picture, lastSeen: Date.now(),
    });
    res.json({ status: 'success', token: issueSession(user), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ status: 'error', message: 'Invalid Google Token', details: e.message });
  }
});

app.post('/api/auth/demo', async (req, res) => {
  if (process.env.ALLOW_DEMO_AUTH === 'false') return res.status(403).json({ status: 'error', message: 'Demo auth disabled' });
  const raw = String(req.body?.name || '').trim().slice(0, 40);
  const name = raw || 'Arya Wijaya';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tamu';
  const id = `demo-${slug}`;
  const existing = await store.getUser(id);
  const user = await store.upsertUser({
    id, googleId: id, email: `${slug}@chipapp.demo`, name,
    picture: existing?.picture ?? null, lastSeen: existing?.lastSeen ?? Date.now(),
  });
  res.json({ status: 'success', token: issueSession(user), user: publicUser(user) });
});

app.get('/api/me', authenticate, async (req, res) => {
  const user = await store.getUser(req.user.id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  res.json({ status: 'success', user: publicUser(user) });
});

app.get('/api/users', authenticate, async (_req, res) => {
  res.json({ status: 'success', users: (await store.listUsers()).map(publicUser) });
});

app.post('/api/chats/direct', authenticate, async (req, res) => {
  const { peerId } = req.body || {};
  if (!peerId) return res.status(400).json({ status: 'error', message: 'Missing peerId' });
  const peer = await store.getUser(peerId);
  if (!peer) return res.status(400).json({ status: 'error', message: 'Unknown peer' });
  if (peerId === req.user.id) return res.status(400).json({ status: 'error', message: 'Cannot chat with yourself' });

  const roomId = directRoomId(req.user.id, peerId);
  await store.ensureRoom(roomId, true, [req.user.id, peerId]);
  res.json({
    status: 'success',
    chat: { id: roomId, peer: publicUser(peer), history: await store.loadHistory(roomId, HISTORY_LIMIT) },
  });
});

/* ------------------------------------------------------------------ *
 * Socket.io
 * ------------------------------------------------------------------ */
io.on('connection', (socket) => {
  let user = null;
  const { token } = socket.handshake.auth || {};
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      user = { id: decoded.id, email: decoded.email, name: decoded.name };
      if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
      userSockets.get(user.id).add(socket.id);
      socket.data.userId = user.id;
      store.touchUser(user.id);
    } catch {
      // anonymous
    }
  }

  console.log(`[socket] connected ${socket.id} (${user?.email ?? 'anonymous'})`);
  socket.emit('ready', { id: socket.id, identity: user?.email ?? 'anonymous', userId: user?.id ?? null });
  if (user) broadcastPresence();

  socket.on('join_chat', async (roomId) => {
    if (typeof roomId !== 'string') return;
    const isMember = await store.isMember(roomId, user?.id);
    // Lazy direct room if the user is one of the two participants.
    if (!isMember && roomId.includes('::')) {
      const [a, b] = roomId.split('::');
      if (user && (a === user.id || b === user.id)) {
        const other = a === user.id ? b : a;
        if (await store.getUser(other)) {
          await store.ensureRoom(roomId, true, [a, b]);
        }
      }
    }
    socket.join(roomId);
    socket.emit('joined', { room: roomId, history: await store.loadHistory(roomId, HISTORY_LIMIT) });
  });

  socket.on('leave_chat', (roomId) => {
    if (typeof roomId === 'string') socket.leave(roomId);
  });

  socket.on('send_message', async (data) => {
    if (!user || !data?.room || typeof data.text !== 'string') return;
    const text = data.text.slice(0, 4000);
    if (!text.trim() && data.kind !== 'sticker') return;
    if (!(await store.isMember(data.room, user.id))) return;

    const message = {
      id: data.id || store.newId(),
      room: data.room,
      text,
      kind: ['text', 'sticker', 'image', 'voice', 'system'].includes(data.kind) ? data.kind : 'text',
      timestamp: new Date().toISOString(),
      author: user.id,
      authorName: user.name,
      authorPicture: null,
      reactions: {},
    };
    await store.saveMessage(message);

    socket.to(data.room).emit('receive_message', message);
    socket.emit('message_ack', {
      id: data.id, serverId: message.id, room: data.room,
      timestamp: message.timestamp, status: 'delivered',
    });
  });

  socket.on('typing', ({ room, typing } = {}) => {
    if (!user || !room) return;
    socket.to(room).emit('peer_typing', { room, userId: user.id, typing: Boolean(typing) });
  });

  socket.on('read_receipt', ({ room, messageId } = {}) => {
    if (!user || !room) return;
    socket.to(room).emit('message_read', { room, messageId, userId: user.id });
  });

  socket.on('react', async ({ room, messageId, emoji } = {}) => {
    if (!user || !room || !messageId || !emoji) return;
    const target = await store.findMessage(room, messageId);
    if (!target) return;
    target.reactions = target.reactions || {};
    const set = new Set(target.reactions[emoji] || []);
    if (set.has(user.id)) set.delete(user.id); else set.add(user.id);
    target.reactions[emoji] = [...set];
    await store.saveMessage({ ...target, room, author: target.author });
    io.to(room).emit('reaction', {
      room, messageId, emoji, userId: user.id, userName: user.name, reactions: target.reactions,
    });
  });

  socket.on('edit_message', async ({ room, messageId, text } = {}) => {
    if (!user || !room || !messageId || typeof text !== 'string') return;
    const target = await store.findMessage(room, messageId);
    if (!target || target.author !== user.id) return;
    target.text = text.slice(0, 4000);
    target.editedAt = new Date().toISOString();
    await store.saveMessage({ ...target, room, author: target.author });
    io.to(room).emit('message_edited', { room, messageId, text: target.text, editedAt: target.editedAt });
  });

  socket.on('delete_message', async ({ room, messageId, forEveryone } = {}) => {
    if (!user || !room || !messageId) return;
    const target = await store.findMessage(room, messageId);
    if (!target) return;
    if (forEveryone) {
      if (target.author !== user.id) return;
      target.deleted = true;
      target.text = '';
      await store.saveMessage({ ...target, room, author: target.author });
      io.to(room).emit('message_deleted', { room, messageId, forEveryone: true });
    } else {
      await store.deleteMessageForMe(room, messageId);
      socket.emit('message_deleted', { room, messageId, forEveryone: false });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected ${socket.id}`);
    if (!user) return;
    const socks = userSockets.get(user.id);
    if (socks) {
      socks.delete(socket.id);
      if (socks.size === 0) {
        userSockets.delete(user.id);
        store.touchUser(user.id);
      }
    }
    broadcastPresence();
  });
});

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
initStore()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`ChipApp backend v5.0.0 on http://${HOST}:${PORT} (storage: ${store.engine})`);
    });
  })
  .catch((e) => {
    console.error('Fatal storage init failure:', e);
    process.exit(1);
  });

module.exports = { app, server, io, store };
