require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  // Long-polling stays enabled so the handshake survives proxies (Metro dev
  // server, Cloudflare Tunnel) that do not upgrade websockets immediately.
  transports: ['polling', 'websocket'],
  maxHttpBufferSize: 1e6,
});

app.use(express.json({ limit: '1mb' }));
app.use(cors());

const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'chipapp_production_secure_jwt_secret_2026';
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT || 200);

const googleClient = new OAuth2Client(CLIENT_ID);

/* ------------------------------------------------------------------ *
 * In-memory data model
 *
 * Persistence is intentionally in-memory: a Termux-hosted personal
 * server favours a zero-dependency footprint. A restart clears state.
 * ------------------------------------------------------------------ */

/** @type {Map<string, {id:string,name:string,email:string,picture?:string,lastSeen:number}>} */
const users = new Map();
/** roomId -> { id, isDirect, members: Set<userId>, createdAt } */
const rooms = new Map();
/** roomId -> Message[] (newest last, capped) */
const history = new Map();
/** userId -> Set<socket.id> */
const userSockets = new Map();

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

const ensureHistory = (roomId) => {
  if (!history.has(roomId)) history.set(roomId, []);
  return history.get(roomId);
};

const directRoomId = (a, b) => [a, b].sort().join('::');

/** Sends a room event to every connected socket of the given user. */
const emitToUser = (userId, event, payload) => {
  const socks = userSockets.get(userId);
  if (!socks) return;
  for (const sid of socks) io.to(sid).emit(event, payload);
};

const broadcastPresence = () => {
  io.emit('presence', { users: [...users.values()].map(publicUser) });
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
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Missing bearer token' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired session', details: error.message });
  }
};

/* ------------------------------------------------------------------ *
 * REST
 * ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chipapp-backend',
    version: '4.3.0',
    uptimeSec: Math.round(process.uptime()),
    sockets: io.engine.clientsCount,
    users: users.size,
    googleClientId: `${CLIENT_ID.slice(0, 12)}…`,
  });
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Missing Google ID token' });
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const id = `g-${payload.sub}`;
    const user = {
      id,
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      lastSeen: Date.now(),
    };
    users.set(id, user);
    return res.status(200).json({ status: 'success', token: issueSession(user), user: publicUser(user) });
  } catch (error) {
    return res
      .status(401)
      .json({ status: 'error', message: 'Invalid Google Token', details: error.message });
  }
});

app.post('/api/auth/demo', (req, res) => {
  if (process.env.ALLOW_DEMO_AUTH === 'false') {
    return res.status(403).json({ status: 'error', message: 'Demo auth disabled' });
  }
  const raw = ((req.body && req.body.name) || '').toString().trim().slice(0, 40);
  const name = raw || 'Arya Wijaya';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tamu';
  const id = `demo-${slug}`;
  const existing = users.get(id);
  const user = {
    id,
    googleId: id,
    email: `${slug}@chipapp.demo`,
    name,
    picture: null,
    lastSeen: existing?.lastSeen ?? Date.now(),
  };
  users.set(id, user);
  return res.status(200).json({ status: 'success', token: issueSession(user), user: publicUser(user) });
});

app.get('/api/me', authenticate, (req, res) => {
  const user = users.get(req.user.id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  res.json({ status: 'success', user: publicUser(user) });
});

/** Everyone the signed-in user can talk to / has talked to. */
app.get('/api/users', authenticate, (_req, res) => {
  res.json({ status: 'success', users: [...users.values()].map(publicUser) });
});

/**
 * Create (or fetch) a 1:1 chat with another user. Returns room metadata,
 * participant profiles, and recent history so the client can hydrate the
 * conversation immediately.
 */
app.post('/api/chats/direct', authenticate, (req, res) => {
  const { peerId } = req.body || {};
  if (!peerId || !users.has(peerId)) {
    return res.status(400).json({ status: 'error', message: 'Unknown peer' });
  }
  if (peerId === req.user.id) {
    return res.status(400).json({ status: 'error', message: 'Cannot chat with yourself' });
  }

  const roomId = directRoomId(req.user.id, peerId);
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      isDirect: true,
      members: new Set([req.user.id, peerId]),
      createdAt: Date.now(),
    });
  }
  const peer = users.get(peerId);
  res.json({
    status: 'success',
    chat: {
      id: roomId,
      peer: publicUser(peer),
      history: ensureHistory(roomId).slice(-HISTORY_LIMIT),
    },
  });
});

/* ------------------------------------------------------------------ *
 * Socket.io
 * ------------------------------------------------------------------ */

io.on('connection', (socket) => {
  const { token } = socket.handshake.auth || {};
  let user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (users.has(decoded.id)) {
        user = users.get(decoded.id);
        user.lastSeen = Date.now();
        if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
        userSockets.get(user.id).add(socket.id);
        socket.data.userId = user.id;
      } else {
        socket.data.userId = decoded.id; // token valid but user record absent
      }
    } catch {
      // Anonymous/unverified socket is allowed to connect but cannot message.
    }
  }

  const identity = user ? user.email : 'anonymous';
  console.log(`[socket] connected ${socket.id} (${identity})`);

  socket.emit('ready', { id: socket.id, identity, userId: user?.id ?? null });

  if (user) {
    // Auto-rejoin every direct room this user belongs to (survives reconnect).
    for (const room of rooms.values()) {
      if (room.isDirect && room.members.has(user.id)) socket.join(room.id);
    }
    broadcastPresence();
  }

  socket.on('join_chat', (roomId) => {
    if (typeof roomId !== 'string') return;
    const room = rooms.get(roomId);
    // Permissive for direct rooms we know about; seeded 1:1 rooms that the
    // client creates lazily are accepted so the first message can still flow.
    if (room && user && !room.members.has(user.id)) return;
    socket.join(roomId);
    if (room && user) {
      // Ensure membership recorded for any pre-existing direct room.
      if (room.isDirect) room.members.add(user.id);
    }
    socket.emit('joined', { room: roomId, history: ensureHistory(roomId).slice(-HISTORY_LIMIT) });
  });

  socket.on('leave_chat', (roomId) => {
    if (typeof roomId === 'string') socket.leave(roomId);
  });

  socket.on('send_message', (data) => {
    if (!user || !data || !data.room || typeof data.text !== 'string') return;
    const text = data.text.slice(0, 4000);
    if (!text.trim() && data.kind !== 'sticker') return;

    const roomId = data.room;
    // Lazily create a direct room when both participants can be derived from
    // the room id (sorted "a::b" convention used by /api/chats/direct).
    if (!rooms.has(roomId) && roomId.includes('::')) {
      const [a, b] = roomId.split('::');
      if (users.has(a) && users.has(b) && (a === user.id || b === user.id)) {
        rooms.set(roomId, { id: roomId, isDirect: true, members: new Set([a, b]), createdAt: Date.now() });
        io.to(roomId).emit('joined', { room: roomId, history: ensureHistory(roomId).slice(-HISTORY_LIMIT) });
      } else {
        return;
      }
    }

    const room = rooms.get(roomId);
    if (!room || !room.members.has(user.id)) return;

    const message = {
      id: data.id || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      room: roomId,
      text,
      kind: data.kind && ['text', 'sticker', 'image', 'voice', 'system'].includes(data.kind) ? data.kind : 'text',
      timestamp: new Date().toISOString(),
      author: user.id,
      authorName: user.name,
      authorPicture: user.picture ?? null,
    };

    const list = ensureHistory(roomId);
    list.push(message);
    if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);

    // Deliver to everyone else in the room; the sender keeps its optimistic
    // copy and only applies the authoritative timestamp via the ack.
    socket.to(roomId).emit('receive_message', message);
    socket.emit('message_ack', {
      id: data.id,
      serverId: message.id,
      room: roomId,
      timestamp: message.timestamp,
      status: 'delivered',
    });
  });

  socket.on('typing', ({ room, typing } = {}) => {
    if (!user || !room) return;
    socket.to(room).emit('peer_typing', { room, userId: user.id, typing: Boolean(typing) });
  });

  socket.on('read_receipt', ({ room, messageId } = {}) => {
    if (!user || !room) return;
    // Mark messages in this room authored by others up to messageId as read.
    const list = ensureHistory(room);
    for (const m of list) {
      if (m.author !== user.id) m.readBy = m.readBy || new Set();
    }
    socket.to(room).emit('message_read', { room, messageId, userId: user.id });
  });

  socket.on('react', ({ room, messageId, emoji } = {}) => {
    if (!user || !room || !messageId) return;
    const list = ensureHistory(room);
    const target = list.find((m) => m.id === messageId);
    if (!target) return;
    target.reactions = target.reactions || {};
    const key = emoji || '';
    if (!key) return;
    const set = target.reactions[key] || (target.reactions[key] = new Set());
    if (set.has(user.id)) set.delete(user.id);
    else set.add(user.id);
    io.to(room).emit('reaction', {
      room,
      messageId,
      emoji,
      userId: user.id,
      userName: user.name,
      reactions: Object.fromEntries(
        Object.entries(target.reactions).map(([k, v]) => [k, [...v]])
      ),
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
    const userId = socket.data.userId;
    if (!userId) return;
    const socks = userSockets.get(userId);
    if (socks) {
      socks.delete(socket.id);
      if (socks.size === 0) {
        userSockets.delete(userId);
        const u = users.get(userId);
        if (u) u.lastSeen = Date.now();
      }
    }
    if (user) broadcastPresence();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ChipApp secure backend running on http://${HOST}:${PORT}`);
  console.log(`Google client: ${CLIENT_ID}`);
});

module.exports = { app, server, io };
