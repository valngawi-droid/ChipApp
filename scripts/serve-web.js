#!/usr/bin/env node
/**
 * Production web server for ChipApp.
 *
 * Serves the static export in dist/ and proxies /api and /socket.io to the
 * Express/Socket.io backend so the website and API share a single origin.
 * This is what makes EXPO_PUBLIC_API_URL empty (relative) work in production.
 *
 * Usage:
 *   node scripts/serve-web.js
 *
 * Env:
 *   PORT          web port (default 3000)
 *   BACKEND_PORT  backend port (default 4000)
 *   BACKEND_HOST  backend host (default 127.0.0.1)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 4000);
const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
};

const PROXY_PREFIXES = ['/api', '/socket.io'];

const proxy = (req, res) => {
  const proxyReq = http.request(
    { host: BACKEND_HOST, port: BACKEND_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` } },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Backend unreachable' }));
  });
  req.pipe(proxyReq);
};

const serveStatic = (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // Prevent path traversal.
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST, safe);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback.
      filePath = path.join(DIST, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
};

const server = http.createServer((req, res) => {
  if (PROXY_PREFIXES.some((p) => req.url && req.url.startsWith(p))) return proxy(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`ChipApp web on http://0.0.0.0:${PORT}  (proxies /api -> :${BACKEND_PORT})`);
});
