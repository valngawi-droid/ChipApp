// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

/**
 * Backend proxy.
 *
 * The browser that renders the web preview is NOT inside the sandbox, so it can
 * never reach the Node backend on localhost:4000 directly. Instead the app calls
 * relative URLs ("/api/...", "/socket.io/...") and Metro forwards them to the
 * backend process. This keeps one single public origin for the whole stack and
 * mirrors how the production Cloudflare Tunnel fronts the API.
 */
const BACKEND_HOST = process.env.CHIPAPP_BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.CHIPAPP_BACKEND_PORT || 4000);
const PROXY_PREFIXES = ['/api', '/socket.io'];

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => (req, res, next) => {
    const shouldProxy = PROXY_PREFIXES.some((p) => req.url && req.url.startsWith(p));
    if (!shouldProxy) return metroMiddleware(req, res, next);

    const proxyReq = http.request(
      {
        host: BACKEND_HOST,
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'error',
          message: 'ChipApp backend unreachable',
          details: err.message,
        })
      );
    });

    req.pipe(proxyReq, { end: true });
  },
};

module.exports = config;
