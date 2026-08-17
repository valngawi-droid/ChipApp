require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { getDB, getDatabaseUrl } = require('./db');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Persistent DB — File JSON + Postgres (Neon/Supabase) for free plan persistent
const db = getDB();
(async () => {
  try {
    const stats = await Promise.resolve(db.getStats());
    console.log(`[db] Ready type=${stats.type || db.type} — ${stats.users || 0} users, ${stats.totalMessages || 0} msgs — ${stats.dataDir || 'postgres'}`);
    if ((stats.type === 'file-json' || !stats.type) && process.env.NODE_ENV === 'production' && !getDatabaseUrl() && !process.env.DATA_DIR) {
      console.warn('[db] FREE PLAN WARNING: No DATABASE_URL and no DATA_DIR — data will be lost on restart! Set DATABASE_URL (Neon free) for persistence');
    }
  } catch (e) {
    console.log(`[db] Ready (stats pending) — ${e.message}`);
  }
})();

/* ------------------------------------------------------------------ *
 * Domain & CORS — chiperx.cyou only + Vercel + Render
 * ------------------------------------------------------------------ */

const PERSONAL_DOMAINS = ['chiperx.cyou'];
const PERSONAL_DOMAIN_VARIANTS = PERSONAL_DOMAINS.flatMap((d) => [d, `www.${d}`]);

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

const defaultAllowedOrigins = [
  ...PERSONAL_DOMAIN_VARIANTS.flatMap((d) => [`https://${d}`, `http://${d}`]),
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
  'http://192.168.1.1:3000',
  'http://192.168.1.1:4000',
  'exp://',
];

const ALLOWED_ORIGINS = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

const ALLOWED_ORIGIN_PATTERNS = [
  /\.onrender\.com$/,
  /\.vercel\.app$/,
  /\.trycloudflare\.com$/,
  /\.netlify\.app$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^exp:\/\/.*/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (PERSONAL_DOMAIN_VARIANTS.includes(host)) return true;
    if (PERSONAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin) || re.test(host))) return true;
  } catch {
    if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return true;
  }
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      if (process.env.CORS_STRICT === 'true') {
        return callback(new Error(`Not allowed by CORS: ${origin}`));
      }
      return callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
};

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.options('/*splat', cors(corsOptions));

if (process.env.REDIRECT_WWW_TO_APEX === 'true') {
  app.use((req, res, next) => {
    const host = (req.get('host') || '').toLowerCase();
    if (host.startsWith('www.')) {
      const apex = host.replace(/^www\./, '');
      if (PERSONAL_DOMAINS.includes(apex)) {
        const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
        return res.redirect(301, `${proto}://${apex}${req.originalUrl}`);
      }
    }
    next();
  });
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Powered-By', 'ChipApp/4.2.0');
  next();
});

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'chipapp_production_secure_jwt_secret_2026';
const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || '0.0.0.0';

const googleClient = new OAuth2Client(CLIENT_ID);

const issueSession = (profile) =>
  jwt.sign({ googleId: profile.googleId, email: profile.email, name: profile.name }, JWT_SECRET, { expiresIn: '30d' });

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ status: 'error', message: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired session', details: error.message });
  }
};

app.get('/api/health', async (_req, res) => {
  try {
    const stats = await Promise.resolve(db.getStats());
    res.json({
      status: 'ok',
      service: 'chipapp-backend',
      version: '4.2.0',
      uptimeSec: Math.round(process.uptime()),
      sockets: io.engine.clientsCount,
      googleClientId: `${CLIENT_ID.slice(0, 12)}…`,
      primaryDomain: PERSONAL_DOMAINS[0],
      platform: stats.type === 'postgres' ? 'render+neondb' : 'render',
      realtime: 'enabled',
      database: {
        type: stats.type || db.type || 'file-json',
        dataDir: stats.dataDir || db.dataDir || null,
        users: stats.users,
        rooms: stats.rooms,
        totalMessages: stats.totalMessages,
        persistent: stats.persistent ?? (stats.type === 'postgres' || fs.existsSync(stats.dataDir || '')),
        freePlan: stats.freePlanNote || (stats.type === 'postgres' ? 'postgres persistent even on free' : 'file ephemeral without DATABASE_URL'),
      },
    });
  } catch (e) {
    res.json({ status: 'ok', service: 'chipapp-backend', version: '4.2.0', uptimeSec: Math.round(process.uptime()), sockets: io.engine.clientsCount, primaryDomain: PERSONAL_DOMAINS[0], database: { error: e.message } });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ status: 'error', message: 'Missing Google ID token' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const user = { googleId: payload.sub, email: payload.email, name: payload.name, picture: payload.picture, provider: 'google' };
    await Promise.resolve(db.saveUser(user));
    return res.status(200).json({ status: 'success', token: issueSession(user), user });
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Invalid Google Token', details: error.message });
  }
});

app.post('/api/auth/demo', async (req, res) => {
  if (process.env.ALLOW_DEMO_AUTH === 'false') return res.status(403).json({ status: 'error', message: 'Demo auth disabled' });
  const name = (req.body && req.body.name) || 'Arya Wijaya';
  const user = {
    googleId: `demo-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 16)}`,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@chipapp.demo`,
    name,
    picture: null,
    demo: true,
    provider: 'demo',
  };
  await Promise.resolve(db.saveUser(user));
  return res.status(200).json({ status: 'success', token: issueSession(user), user });
});

app.get('/api/me', authenticate, async (req, res) => {
  try {
    const dbUser = (await Promise.resolve(db.getUserById(req.user.googleId))) || (await Promise.resolve(db.getUserByEmail(req.user.email)));
    res.json({ status: 'success', user: req.user, dbUser: dbUser || null, persistent: !!dbUser });
  } catch (e) {
    res.json({ status: 'success', user: req.user, dbUser: null, persistent: false });
  }
});

app.get('/api/config', async (req, res) => {
  res.json({
    status: 'ok',
    host: req.get('host') || 'unknown',
    protocol: req.protocol,
    primaryDomain: PERSONAL_DOMAINS[0],
    personalDomains: PERSONAL_DOMAINS,
    personalVariants: PERSONAL_DOMAIN_VARIANTS,
    allowedOrigins: ALLOWED_ORIGINS.slice(0, 50),
    envAllowed: envAllowedOrigins,
    nodeEnv: process.env.NODE_ENV || 'development',
    version: '4.2.0',
    realtime: 'enabled',
    database: await Promise.resolve(db.getStats()).catch(() => ({ type: 'unknown' })),
  });
});

app.get('/api/domains', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ChipApp custom domain active - chiperx.cyou - Vercel+Render+NeonDB free persistent + realtime',
    domains: PERSONAL_DOMAINS.map((d) => ({ domain: d, https: `https://${d}`, www: `https://www.${d}`, apiHealth: `https://${d}/api/health` })),
    platforms: {
      vercel: 'Frontend Edge fast (chiperx.cyou) + API proxy to Render',
      render: 'Backend Express + Socket.io full realtime + NeonDB persistent',
      neon: 'Postgres free 0.5GB persistent even on free plan',
    },
    currentRequest: { host: req.get('host'), origin: req.get('origin') || null, ip: req.ip },
  });
});

/* Persistent DB API */
app.get('/api/db/stats', authenticate, async (req, res) => {
  res.json({ status: 'ok', stats: await Promise.resolve(db.getStats()) });
});

app.get('/api/users', authenticate, async (req, res) => {
  const all = await Promise.resolve(db.getAllUsers());
  res.json({ status: 'ok', count: all.length, users: all.map((u) => ({ googleId: u.googleId, email: u.email, name: u.name, picture: u.picture || null, provider: u.provider || 'unknown', createdAt: u.createdAt, updatedAt: u.updatedAt })) });
});

app.get('/api/chats/:room/messages', authenticate, async (req, res) => {
  const room = req.params.room;
  const limit = Math.min(Number(req.query.limit || 100), 1000);
  const messages = await Promise.resolve(db.getMessages(room, limit));
  const total = await Promise.resolve(db.getMessageCount(room));
  res.json({ status: 'ok', room, count: messages.length, totalInRoom: total, messages });
});

app.get('/api/chats', authenticate, async (req, res) => {
  const chatsMeta = await Promise.resolve(db.getAllChatsMeta());
  res.json({ status: 'ok', count: Object.keys(chatsMeta).length, chats: chatsMeta });
});

app.post('/api/chats/:room/messages', authenticate, async (req, res) => {
  const room = req.params.room;
  const { id, text, kind } = req.body || {};
  if (!text) return res.status(400).json({ status: 'error', message: 'Missing text' });
  const msg = {
    id: id || `m-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    room,
    text,
    kind: kind || 'text',
    author: req.user.email,
    authorName: req.user.name,
    authorId: req.user.googleId,
    timestamp: new Date().toISOString(),
    status: 'sent',
  };
  await Promise.resolve(db.saveMessage(room, msg));
  io.to(room).emit('receive_message', msg);
  res.json({ status: 'ok', message: msg });
});

app.delete('/api/chats/:room/messages/:id', authenticate, async (req, res) => {
  const { room, id } = req.params;
  const ok = await Promise.resolve(db.deleteMessage(room, id));
  if (ok) {
    io.to(room).emit('message_deleted', { room, id });
    return res.json({ status: 'ok', deleted: id });
  }
  return res.status(404).json({ status: 'error', message: 'Not found' });
});

app.get('/api/history', authenticate, async (req, res) => {
  const all = await Promise.resolve(db.getAllMessages());
  let total = 0, roomsList = [];
  if (Array.isArray(all)) total = all.length;
  else {
    for (const [r, arr] of Object.entries(all)) {
      const c = Array.isArray(arr) ? arr.length : 0;
      total += c;
      roomsList.push({ room: r, count: c });
    }
  }
  res.json({ status: 'ok', totalMessages: total, rooms: Object.keys(all).length, roomsList });
});

app.delete('/api/db/clear', authenticate, async (req, res) => {
  if (process.env.ALLOW_DB_CLEAR !== 'true') return res.status(403).json({ status: 'error', message: 'Clear disabled' });
  await Promise.resolve(db.clearAll());
  res.json({ status: 'ok', message: 'Database cleared' });
});

/* Frontend static + SEO */
const publicPaths = [path.join(__dirname, '..', 'public'), path.join(process.cwd(), 'public')];
for (const pp of publicPaths) {
  try {
    if (fs.existsSync(pp) && fs.statSync(pp).isDirectory()) {
      console.log(`[static] Serving public SEO from ${pp} for chiperx.cyou`);
      app.use(express.static(pp, { maxAge: '1d', etag: true }));
      break;
    }
  } catch {}
}

const possibleStaticPaths = [
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, '..', 'web-build'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'web-build'),
];

let staticRoot = null;
for (const p of possibleStaticPaths) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'index.html'))) {
      staticRoot = p;
      break;
    }
  } catch {}
}

const PRIMARY_DOMAIN = 'chiperx.cyou';
const WEBSITE_TITLE = 'ChipApp — Messenger di chiperx.cyou';
const WEBSITE_DESC = 'ChipApp messenger iOS-fidelity — chat realtime, voice note, status, calls — live di chiperx.cyou — Vercel+Render+NeonDB free persistent';

function injectSeo(html) {
  if (html.includes('property="og:title"')) return html;
  const canonical = `https://${PRIMARY_DOMAIN}`;
  const seoTags = `
    <meta name="description" content="${WEBSITE_DESC}" />
    <meta name="keywords" content="chipapp, messenger, chat, chiperx, chiperx.cyou, expo, socket.io, vercel, neon, realtime" />
    <meta name="author" content="ChipApp" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${WEBSITE_TITLE}" />
    <meta property="og:description" content="${WEBSITE_DESC}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="ChipApp" />
    <meta property="og:locale" content="id_ID" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${WEBSITE_TITLE}" />
    <meta name="twitter:description" content="${WEBSITE_DESC}" />
    <meta name="theme-color" content="#25D366" />
  `;
  if (html.includes('</head>')) return html.replace('</head>', `${seoTags}\n</head>`);
  return html;
}

if (staticRoot) {
  console.log(`[static] Serving frontend from ${staticRoot} for ${PRIMARY_DOMAIN} — realtime enabled`);
  app.use(
    express.static(staticRoot, {
      index: false,
      maxAge: '1d',
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('X-Robots-Tag', 'index, follow');
        }
      },
    })
  );

  app.get(/^\/(?!api|socket\.io).*/, (req, res, next) => {
    const indexPath = path.join(staticRoot, 'index.html');
    if (!fs.existsSync(indexPath)) return next();
    try {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = injectSeo(html);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(html);
    } catch (e) {
      res.sendFile(indexPath);
    }
  });
} else {
  console.log('[static] No frontend build — API only. Run npx expo export --platform web');
  app.get('/', (req, res) => {
    const host = req.get('host') || PRIMARY_DOMAIN;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${WEBSITE_TITLE}</title><meta name="description" content="${WEBSITE_DESC}"/><link rel="canonical" href="https://${PRIMARY_DOMAIN}"/><style>body{font-family:-apple-system,sans-serif;margin:0;background:#EFE7DE;color:#111}.hero{max-width:800px;margin:0 auto;padding:60px 20px;text-align:center}.badge{display:inline-block;background:#25D366;color:#fff;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600}h1{font-size:44px} a{padding:12px 20px;background:#111;color:#fff;border-radius:12px;text-decoration:none;font-weight:600} a.secondary{background:#fff;color:#111;border:1px solid #ddd}</style></head><body><div class="hero"><div class="badge">LIVE • https://${PRIMARY_DOMAIN} • REALTIME</div><h1>ChipApp</h1><p>${WEBSITE_DESC}</p><p>Host: <code>${host}</code></p><div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a href="/api/health">API Health</a><a href="/api/db/stats" class="secondary">DB Stats</a></div><p style="margin-top:40px;font-size:14px;color:#888">Build: <code>npx expo export --platform web</code> -> backend serve dist/ di https://${PRIMARY_DOMAIN} + Socket.io realtime</p></div></body></html>`);
  });
}

io.on('connection', (socket) => {
  const { token } = socket.handshake.auth || {};
  let identity = 'anonymous';
  let userInfo = null;
  if (token) {
    try {
      userInfo = jwt.verify(token, JWT_SECRET);
      identity = userInfo.email || 'anonymous';
    } catch {
      identity = 'unverified';
    }
  }
  console.log(`[socket] connected ${socket.id} (${identity}) — realtime`);
  Promise.resolve(db.getStats()).then((stats) => {
    socket.emit('ready', { id: socket.id, identity, dbStats: stats, realtime: true });
  }).catch(() => {
    socket.emit('ready', { id: socket.id, identity, realtime: true });
  });

  socket.on('join_chat', async (room) => {
    socket.join(room);
    console.log(`[socket] ${socket.id} joined ${room}`);
    socket.emit('joined', { room });
    try {
      const history = await Promise.resolve(db.getMessages(room, 100));
      if (history.length > 0) {
        socket.emit('chat_history', { room, messages: history, count: history.length });
      }
    } catch (e) {
      console.warn(`[socket] history failed for ${room}: ${e.message}`);
    }
  });

  socket.on('leave_chat', (room) => socket.leave(room));

  socket.on('send_message', async (data) => {
    if (!data || !data.room) return;
    const enriched = {
      id: data.id || `m-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      room: data.room,
      text: data.text || '',
      kind: data.kind || 'text',
      timestamp: data.timestamp || new Date().toISOString(),
      author: data.author || identity,
      authorName: data.authorName || userInfo?.name || identity,
      authorId: userInfo?.googleId || 'unknown',
      status: 'delivered',
    };
    try {
      await Promise.resolve(db.saveMessage(data.room, enriched));
    } catch (e) {
      console.error(`[db] save failed: ${e.message}`);
    }
    socket.to(data.room).emit('receive_message', enriched);
    socket.emit('message_ack', { id: enriched.id, status: 'delivered', persistent: true, realtime: true });
  });

  socket.on('typing', ({ room, typing } = {}) => {
    if (room) socket.to(room).emit('peer_typing', { room, typing: Boolean(typing) });
  });

  socket.on('read_receipt', ({ room, messageId } = {}) => {
    if (room) socket.to(room).emit('message_read', { messageId });
  });

  socket.on('request_history', async ({ room, limit } = {}) => {
    if (!room) return;
    try {
      const history = await Promise.resolve(db.getMessages(room, Math.min(limit || 100, 1000)));
      socket.emit('chat_history', { room, messages: history, count: history.length });
    } catch (e) {
      console.warn(`[socket] request_history failed: ${e.message}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
  });
});

if (!process.env.VERCEL) {
  server.listen(PORT, HOST, () => {
    console.log(`ChipApp backend running on http://${HOST}:${PORT}`);
    console.log(`Primary domain: https://${PRIMARY_DOMAIN}`);
    console.log(`Realtime: enabled (Socket.io)`);
    console.log(`CORS strict: ${process.env.CORS_STRICT === 'true' ? 'yes' : 'no'}`);
  });
} else {
  console.log('[vercel] Running on Vercel — server.listen skipped, use api/index.js for API, but Socket.io needs Render for full realtime');
}

module.exports = { app, server, io, PERSONAL_DOMAINS, isOriginAllowed, db };
