#!/data/data/com.termux/files/usr/bin/bash
#
# ChipApp — jalankan MySQL + backend + website di Termux.
#
# Usage: bash scripts/start-termux.sh
#
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!!${NC}  $*"; }

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_PORT="3306"
SOCKET="$PREFIX/var/run/mysqld/mysqld.sock"
DATA_DIR="$PREFIX/var/lib/mysql"
WEB_PORT="${WEB_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-4000}"

# 1. Pastikan MariaDB hidup
if ! mariadb-admin ping --socket="$SOCKET" >/dev/null 2>&1; then
  info "Menjalankan MariaDB..."
  mkdir -p "$PREFIX/var/run/mysqld"
  if [ ! -d "$DATA_DIR/mysql" ]; then
    warn "Database belum diinisialisasi. Jalankan: bash scripts/setup-termux-mysql.sh"
    exit 1
  fi
  mysqld_safe --bind-address=127.0.0.1 --port="$DB_PORT" \
    --datadir="$DATA_DIR" --socket="$SOCKET" \
    >"$HOME/mariadb.log" 2>&1 &
  for i in $(seq 1 30); do
    mariadb-admin ping --socket="$SOCKET" >/dev/null 2>&1 && break
    sleep 1
  done
fi
info "MariaDB aktif."

# 2. Build website kalau belum ada
if [ ! -f dist/index.html ]; then
  info "Membangun website..."
  npx expo export --platform web --output-dir dist
  cp public/manifest.webmanifest public/*.png dist/ 2>/dev/null || true
fi

# 3. Bersihkan proses lama
pkill -f "backend/server.js" 2>/dev/null || true
pkill -f "scripts/serve-web.js" 2>/dev/null || true
sleep 1

# 4. Jalankan backend
info "Menjalankan backend di :$BACKEND_PORT..."
( cd backend && node server.js ) >"$HOME/chipapp-backend.log" 2>&1 &
BACK_PID=$!

# 5. Jalankan web server (proxy ke backend)
info "Menjalankan website di :$WEB_PORT..."
WEB_PORT="$WEB_PORT" BACKEND_PORT="$BACKEND_PORT" node scripts/serve-web.js >"$HOME/chipapp-web.log" 2>&1 &
WEB_PID=$!

echo
echo -e "${GREEN}ChipApp berjalan:${NC}"
echo "  Website : http://localhost:$WEB_PORT"
echo "  API     : http://localhost:$BACKEND_PORT/api/health"
echo "  Logs    : ~/chipapp-backend.log , ~/chipapp-web.log , ~/mariadb.log"
echo
echo "Tekan Ctrl+C untuk menghentikan."
echo

cleanup() {
  echo
  warn "Menghentikan..."
  kill "$BACK_PID" "$WEB_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Pantau salah satu proses; keluar kalau ada yang mati.
while kill -0 "$BACK_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 2
done
warn "Salah satu proses berhenti. Cek log."
cleanup
