#!/usr/bin/env bash
#
# ChipApp — setup VPS sekali jalan (Ubuntu / Debian).
#
# Yang dipasang: Node 20, MariaDB, Nginx, PM2, Certbot.
# Yang dibuat:
#   - database MySQL 'chipapp'
#   - backend jalan via PM2 di port 4000
#   - website statis di /var/www/chipapp
#   - Nginx reverse proxy untuk 3 domain
#
# Jalankan di VPS (sebagai root atau user sudo):
#   bash scripts/setup-vps.sh
#
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}!!${NC}  $*"; }
fail()  { echo -e "${RED}xx${NC}  $*" >&2; exit 1; }

APP_DIR="/opt/chipapp"
DB_NAME="chipapp"
DB_USER="chipapp"
DB_PASS="chipapp_$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
DOMAINS=("xerophis.pallrzki.my.id")
PRIMARY_DOMAIN="${DOMAINS[0]}"

[ "$(id -u)" -eq 0 ] || fail "Jalankan sebagai root (sudo -i)."

# --- 1. Paket sistem -------------------------------------------------------
info "Memperbarui sistem & memasang paket..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git nginx mariadb-server mariadb-client certbot python3-certbot-nginx ufw

# --- 2. Node 20 -----------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v20"; then
  info "Memasang Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

# --- 3. Firewall ----------------------------------------------------------
info "Mengatur firewall..."
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true

# --- 4. Database ----------------------------------------------------------
info "Mengamankan MariaDB & membuat database..."
systemctl enable mariadb
systemctl start mariadb

# Setel password root untuk localhost (opsional, tidak mengganggu socket auth).
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# --- 5. Kode aplikasi -----------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  info "Memperbarui kode di $APP_DIR..."
  cd "$APP_DIR"
  git fetch --all
  git checkout arena/01a00409-chipapp
  git pull
else
  info "Meng-clone repo ke $APP_DIR..."
  git clone --branch arena/01a00409-chipapp https://github.com/valngawi-droid/ChipApp.git "$APP_DIR"
  cd "$APP_DIR"
fi

# --- 6. Konfigurasi backend ------------------------------------------------
JWT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
cat > "$APP_DIR/backend/.env" <<EOF
PORT=4000
HOST=127.0.0.1
JWT_SECRET=$JWT_SECRET
ALLOW_DEMO_AUTH=true
GOOGLE_CLIENT_ID=
DATABASE_URL=mysql://$DB_USER:$DB_PASS@127.0.0.1:3306/$DB_NAME
HISTORY_LIMIT=1000
EOF

info "Memasang dependensi..."
cd "$APP_DIR"
npm install --no-audit --no-fund
cd backend && npm install --omit=dev --no-audit --no-fund && cd "$APP_DIR"

# --- 7. Build website ------------------------------------------------------
info "Membangun website statis..."
EXPO_PUBLIC_API_URL="https://$PRIMARY_DOMAIN" npx expo export --platform web --output-dir dist
cp public/manifest.webmanifest public/*.png dist/ 2>/dev/null || true
mkdir -p /var/www/chipapp
rm -rf /var/www/chipapp/*
cp -r dist/* /var/www/chipapp/

# --- 8. Nginx -------------------------------------------------------------
info "Menulis konfigurasi Nginx..."
SERVER_NAMES="xerophis.pallrzki.my.id"
cat > /etc/nginx/sites-available/chipapp <<EOF
server {
    listen 80;
    server_name $SERVER_NAMES;

    root /var/www/chipapp;
    index index.html;

    # Static website
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Hashed assets: long cache
    location /_expo/static/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API & socket ke backend Node
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/chipapp /etc/nginx/sites-enabled/chipapp
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# --- 9. PM2 ----------------------------------------------------------------
info "Menjalankan backend dengan PM2..."
cd "$APP_DIR/backend"
pm2 delete chipapp-backend 2>/dev/null || true
pm2 start server.js --name chipapp-backend --update-env
pm2 save
pm2 startup systemd -u root --hp /root | bash || true

sleep 2
echo
echo -e "${CYAN}==========  SELESAI  ==========${NC}"
echo
echo "Website & API aktif:"
for d in "${DOMAINS[@]}"; do
  echo "  http://$d"
done
echo
echo "Backend : http://127.0.0.1:4000/api/health"
echo "Web root: /var/www/chipapp"
echo "App dir : $APP_DIR"
echo
echo "Credensial MariaDB tersimpan di $APP_DIR/backend/.env"
echo
warn "Langkah berikutnya: arahkan DNS xerophis.pallrzki.my.id ke IP VPS, lalu jalankan:"
echo
echo "  certbot --nginx -d xerophis.pallrzki.my.id \\"
echo "    --redirect --non-interactive --agree-tos -m admin@pallrzki.my.id"
echo
echo "Setelah SSL, APK build dengan EXPO_PUBLIC_API_URL=https://$PRIMARY_DOMAIN"
