#!/data/data/com.termux/files/usr/bin/bash
#
# ChipApp — setup MySQL (MariaDB) + website di Termux.
#
# Jalankan sekali:
#   bash scripts/setup-termux-mysql.sh
#
# Setelah itu untuk menjalankan server:
#   bash scripts/start-termux.sh
#
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!!${NC}  $*"; }

DB_NAME="chipapp"
DB_USER="chipapp"
DB_PASS="chipapp_pass"
DB_PORT="3306"

# --- 1. Pasang paket -------------------------------------------------------
info "Memasang MariaDB, Node, dan alat bantu..."
pkg update -y
pkg install -y mariadb nodejs git which

# --- 2. Inisialisasi data MariaDB (sekali saja) ---------------------------
DATA_DIR="$PREFIX/var/lib/mysql"
if [ ! -d "$DATA_DIR/mysql" ]; then
  info "Inisialisasi database MariaDB..."
  mkdir -p "$DATA_DIR"
  mariadb-install-db --user="$(whoami)" --datadir="$DATA_DIR" >/dev/null 2>&1 || true
fi

# --- 3. Jalankan server ----------------------------------------------------
if ! pgrep -f "mysqld" >/dev/null 2>&1; then
  info "Menjalankan MariaDB..."
  mkdir -p "$PREFIX/var/run/mysqld"
  # Dengarkan di TCP 127.0.0.1 (penting untuk mysql2 Node).
  mysqld_safe --bind-address=127.0.0.1 --port="$DB_PORT" \
    --datadir="$DATA_DIR" --socket="$PREFIX/var/run/mysqld/mysqld.sock" \
    >"$HOME/mariadb.log" 2>&1 &
  # Tunggu sampai siap.
  for i in $(seq 1 30); do
    if mariadb-admin ping --socket="$PREFIX/var/run/mysqld/mysqld.sock" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  info "MariaDB sudah berjalan."
fi

# --- 4. Buat database + user ----------------------------------------------
info "Membuat database '$DB_NAME' dan user '$DB_USER'..."
mariadb --socket="$PREFIX/var/run/mysqld/mysqld.sock" -u "$(whoami)" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL

# --- 5. Konfigurasi backend (.env) -----------------------------------------
ENV_FILE="backend/.env"
info "Menulis $ENV_FILE..."
cat > "$ENV_FILE" <<EOF
PORT=4000
HOST=0.0.0.0
JWT_SECRET=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
ALLOW_DEMO_AUTH=true
DATABASE_URL=mysql://$DB_USER:$DB_PASS@127.0.0.1:$DB_PORT/$DB_NAME
EOF

# --- 6. Pasang dependensi --------------------------------------------------
info "Memasang dependensi Node..."
npm install --no-audit --no-fund
(cd backend && npm install --omit=dev --no-audit --no-fund)

# --- 7. Build website ------------------------------------------------------
info "Membangun website statis..."
npx expo export --platform web --output-dir dist
cp public/manifest.webmanifest public/*.png dist/ 2>/dev/null || true

echo
echo -e "${CYAN}Selesai!${NC} Jalankan server dengan:"
echo
echo -e "  ${GREEN}bash scripts/start-termux.sh${NC}"
echo
echo "Backend + website + MySQL akan menyala di http://localhost:3000"
echo "Agar bisa diakses dari internet: jalankan cloudflared (sudah dikonfigurasi tunnel Anda)."
