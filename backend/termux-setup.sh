#!/data/data/com.termux/files/usr/bin/bash
#
# ChipApp — penyiapan server di Termux (Android)
#
# Skrip ini idempoten: aman dijalankan berulang kali.
# Jalankan dari dalam folder backend:
#   bash termux-setup.sh
#
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!!${NC}  $*"; }
fail() { echo -e "${RED}xx${NC}  $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo
echo "  ChipApp — Penyiapan Server Termux"
echo "  ================================="
echo

# --- 1. Pastikan berjalan di Termux -----------------------------------------
if [ ! -d "/data/data/com.termux/files/usr" ]; then
  warn "Sepertinya ini bukan Termux. Skrip tetap lanjut, tapi jalur paket mungkin berbeda."
fi

# --- 2. Paket sistem ---------------------------------------------------------
info "Memperbarui daftar paket…"
pkg update -y >/dev/null 2>&1 || warn "pkg update gagal — lanjut memakai indeks lama."

for p in nodejs-lts git; do
  if ! command -v "${p%%-*}" >/dev/null 2>&1; then
    info "Memasang $p…"
    pkg install -y "$p" || fail "Gagal memasang $p"
  fi
done

command -v node >/dev/null 2>&1 || fail "Node.js tidak ditemukan setelah instalasi."
info "Node $(node -v), npm $(npm -v)"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Butuh Node 18+. Versi terpasang: $(node -v). Jalankan: pkg install nodejs-lts"
fi

# --- 3. Dependensi npm -------------------------------------------------------
# Seluruh dependensi backend murni JavaScript, jadi tidak butuh node-gyp,
# python, atau clang. Inilah alasan backend ini ringan di Android.
info "Memasang dependensi npm…"
npm install --omit=dev --no-audit --no-fund

# --- 4. Berkas konfigurasi ---------------------------------------------------
if [ ! -f .env ]; then
  info "Membuat .env dari contoh…"
  cp .env.example .env

  # Buat JWT secret acak agar tidak memakai nilai contoh di perangkat nyata.
  SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')"
  # Tulis ulang baris JWT_SECRET secara aman lintas versi sed.
  node -e '
    const fs = require("fs");
    const secret = process.argv[1];
    const out = fs.readFileSync(".env", "utf8")
      .replace(/^JWT_SECRET=.*$/m, "JWT_SECRET=" + secret);
    fs.writeFileSync(".env", out);
  ' "$SECRET"
  info "JWT_SECRET acak telah dibuat."
  warn "Buka .env lalu isi GOOGLE_CLIENT_ID dan CLOUDFLARE_TUNNEL_TOKEN Anda."
else
  info ".env sudah ada — tidak diubah."
fi

# --- 5. Cegah Android mematikan proses --------------------------------------
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
  info "Wake-lock aktif (server tidak mati saat layar padam)."
else
  warn "termux-wake-lock tidak ada. Pasang Termux:API agar server tidak dimatikan Android:"
  warn "  pkg install termux-api"
fi

# --- 6. Uji cepat ------------------------------------------------------------
info "Menguji server…"
PORT_TEST=45999
PORT="$PORT_TEST" node server.js >/tmp/chipapp-test.log 2>&1 &
TEST_PID=$!
sleep 3

if kill -0 "$TEST_PID" 2>/dev/null && \
   curl -s "http://127.0.0.1:$PORT_TEST/api/health" | grep -q '"status":"ok"'; then
  info "Server berjalan normal."
  kill "$TEST_PID" 2>/dev/null || true
else
  kill "$TEST_PID" 2>/dev/null || true
  echo "--- log ---"; cat /tmp/chipapp-test.log
  fail "Server gagal start. Periksa log di atas."
fi

# --- 7. Ringkasan ------------------------------------------------------------
LAN_IP="$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || true)"
PORT_CFG="$(grep -E '^PORT=' .env | cut -d= -f2 || echo 4000)"

echo
echo "  Selesai."
echo "  ---------------------------------------------------"
echo "  Jalankan server   : npm start"
echo "  Cek kesehatan     : curl localhost:${PORT_CFG}/api/health"
[ -n "$LAN_IP" ] && echo "  Dari HP/PC lain   : http://${LAN_IP}:${PORT_CFG}"
echo
echo "  Agar bisa diakses publik (tanpa port forwarding):"
echo "    pkg install cloudflared"
echo "    npm run tunnel"
echo "  ---------------------------------------------------"
echo
