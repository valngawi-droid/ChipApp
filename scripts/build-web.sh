#!/usr/bin/env bash
#
# Build ChipApp as a static website into dist/.
#
# The site calls the backend at the same origin via /api and /socket.io.
# In production put both the static files and the Node backend behind one
# domain (e.g. Nginx or Cloudflare Tunnel) and proxy those paths to the
# Termux server.
#
# Usage:
#   EXPO_PUBLIC_API_URL=https://xerophis.pallrzki.my.id bash scripts/build-web.sh
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-}"
echo "==> Building static web export..."
npx expo export --platform web --output-dir dist

echo "==> Copying PWA assets..."
cp public/manifest.webmanifest dist/manifest.webmanifest 2>/dev/null || true
cp public/*.png dist/ 2>/dev/null || true

cat > dist/_redirects <<'EOF'
/*    /index.html   200
EOF

echo "==> Done. Static site in dist/"
