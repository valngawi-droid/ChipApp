# Deploy ke VPS

Target: VPS Ubuntu/Debian dengan IP publik `69.33.213.153`, domain:

- `chiperx.cyou`
- `chiperx.my.id`
- `pallrzki.my.id`

## 1. Arahkan DNS

Di tempat Anda membeli domain, buat record A untuk ketiga domain (dan `www`-nya):

| Nama | Tipe | Nilai |
|------|------|-------|
| `@` | A | `69.33.213.153` |
| `www` | A | `69.33.213.153` |

Lakukan untuk ketiga domain. Tunggu propagasi (5 menit – 1 jam).

## 2. Login ke VPS

```bash
ssh root@69.33.213.153
```

(atau user sudo lain).

## 3. Ambil kode & jalankan setup

```bash
apt update && apt install -y git
git clone --branch arena/01a00409-chipapp https://github.com/valngawi-droid/ChipApp.git /opt/chipapp
cd /opt/chipapp
bash scripts/setup-vps.sh
```

Skrip otomatis memasang:

- Node.js 20
- MariaDB/MySQL (database `chipapp` dibuat otomatis)
- Nginx (website + reverse proxy API & socket.io)
- PM2 (menjaga backend tetap hidup, auto-start saat reboot)
- Firewall

## 4. Aktifkan HTTPS (SSL gratis)

```bash
certbot --nginx \
  -d chiperx.cyou -d www.chiperx.cyou \
  -d chiperx.my.id -d www.chiperx.my.id \
  -d pallrzki.my.id -d www.pallrzki.my.id \
  --redirect --non-interactive --agree-tos -m admin@chiperx.cyou
```

Setelah ini semua domain bisa diakses `https://...`.

## 5. Cek

```bash
curl https://chiperx.cyou/api/health
# {"status":"ok","storage":"mysql","version":"5.1.0","domains":[...]}
```

## 6. Build APK yang mengarah ke VPS

`eas.json` sudah di-set ke `https://chiperx.cyou`. Di mesin build:

```bash
EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile apk
```

Atau pakai GitHub Actions / build lokal.

## Update ke versi baru

```bash
cd /opt/chipapp
git pull
npm install
cd backend && npm install --omit=dev && cd ..
EXPO_PUBLIC_API_URL=https://chiperx.cyou npx expo export --platform web --output-dir dist
cp -r dist/* /var/www/chipapp/
pm2 restart chipapp-backend
```

## Manajemen service

```bash
pm2 status                 # cek backend
pm2 logs chipapp-backend   # log
pm2 restart chipapp-backend
systemctl status nginx
systemctl status mariadb
```
