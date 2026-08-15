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
});

app.use(express.json());
app.use(cors());

const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'chipapp_production_secure_jwt_secret_2026';
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';

const googleClient = new OAuth2Client(CLIENT_ID);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const issueSession = (profile) =>
  jwt.sign(
    { googleId: profile.googleId, email: profile.email, name: profile.name },
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
 * Health
 * ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chipapp-backend',
    version: '4.2.0',
    uptimeSec: Math.round(process.uptime()),
    sockets: io.engine.clientsCount,
    googleClientId: `${CLIENT_ID.slice(0, 12)}…`,
  });
});

/* ------------------------------------------------------------------ *
 * Authentication
 * ------------------------------------------------------------------ */

/** Production path: verify a real Google ID token, return a ChipApp JWT. */
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Missing Google ID token' });
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const user = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    return res.status(200).json({ status: 'success', token: issueSession(user), user });
  } catch (error) {
    return res
      .status(401)
      .json({ status: 'error', message: 'Invalid Google Token', details: error.message });
  }
});

/**
 * Demo path.
 *
 * The sandboxed preview origin is not on the Google OAuth client's authorised
 * list, so the real consent screen cannot complete there. This endpoint issues
 * a genuine signed JWT for a sample profile so the app is fully explorable.
 * It is intentionally separate from the Google route and can be disabled by
 * setting ALLOW_DEMO_AUTH=false.
 */
app.post('/api/auth/demo', (req, res) => {
  if (process.env.ALLOW_DEMO_AUTH === 'false') {
    return res.status(403).json({ status: 'error', message: 'Demo auth disabled' });
  }
  const name = (req.body && req.body.name) || 'Arya Wijaya';
  const user = {
    googleId: `demo-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 16)}`,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@chipapp.demo`,
    name,
    picture: null,
    demo: true,
  };
  return res.status(200).json({ status: 'success', token: issueSession(user), user });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ status: 'success', user: req.user });
});

/* ------------------------------------------------------------------ *
 * Real-time messaging
 * ------------------------------------------------------------------ */

io.on('connection', (socket) => {
  const { token } = socket.handshake.auth || {};
  let identity = 'anonymous';
  if (token) {
    try {
      identity = jwt.verify(token, JWT_SECRET).email || 'anonymous';
    } catch {
      identity = 'unverified';
    }
  }
  console.log(`[socket] connected ${socket.id} (${identity})`);

  socket.emit('ready', { id: socket.id, identity });

  socket.on('join_chat', (room) => {
    socket.join(room);
    socket.emit('joined', { room });
  });

  socket.on('leave_chat', (room) => socket.leave(room));

  socket.on('send_message', (data) => {
    if (!data || !data.room) return;
    // Broadcast to everyone else in the room; the sender already rendered it
    // optimistically, then acknowledge delivery back to the sender.
    socket.to(data.room).emit('receive_message', data);
    socket.emit('message_ack', { id: data.id, status: 'delivered' });
  });

  socket.on('typing', ({ room, typing } = {}) => {
    if (room) socket.to(room).emit('peer_typing', { room, typing: Boolean(typing) });
  });

  socket.on('read_receipt', ({ room, messageId } = {}) => {
    if (room) socket.to(room).emit('message_read', { messageId });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ChipApp secure backend running on http://${HOST}:${PORT}`);
  console.log(`Google client: ${CLIENT_ID}`);
});

module.exports = { app, server, io };
