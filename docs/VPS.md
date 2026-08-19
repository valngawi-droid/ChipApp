# Deploy ke VPS

Target: VPS Ubuntu/Debian dengan IP publik `69.33.213.153`, domain:

- **`xerophis.pallrzki.my.id`**

## 1. Arahkan DNS

Di panel domain `pallrzki.my.id`, buat record:

| Tipe | Nama/Nama host | Nilai |
|------|----------------|-------|
| A | `xerophis` | `69.33.213.153` |

Tunggu propagasi (5 menit – 1 jam). Cek:

```bash
dig +short xerophis.pallrzki.my.id
```

## 2. Login ke VPS

```bash
ssh root@69.33.213.153
```

## 3. Ambil kode & jalankan setup

```bash
apt update && apt install -y git
git clone --branch arena/01a00409-chipapp https://github.com/valngawi-droid/ChipApp.git /opt/chipapp
cd /opt/chipapp
bash scripts/setup-vps.sh
```

Skrip otomatis memasang:

- Node.js 20
- MariaDB/MySQL (database `chipapp`, password acak)
- Nginx (website + reverse proxy API & socket.io)
- PM2 (backend auto-start saat reboot)
- Firewall

Setelah selesai, website & API aktif di `http://xerophis.pallrzki.my.id`.

## 4. Aktifkan HTTPS (SSL gratis)

```bash
certbot --nginx -d xerophis.pallrzki.my.id \
  --redirect --non-interactive --agree-tos -m admin@pallrzki.my.id
```

Setelah ini domain bisa diakses `https://xerophis.pallrzki.my.id`.

## 5. Cek

```bash
curl https://xerophis.pallrzki.my.id/api/health
# {"status":"ok","storage":"mysql","version":"5.2.0","domain":"xerophis.pallrzki.my.id",...}
```

## 6. Build APK

`eas.json` sudah di-set ke `https://xerophis.pallrzki.my.id`.

```bash
EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile apk
```

## Update ke versi baru

```bash
cd /opt/chipapp
git pull
npm install
cd backend && npm install --omit=dev && cd ..
EXPO_PUBLIC_API_URL=https://xerophis.pallrzki.my.id npx expo export --platform web --output-dir dist
cp -r dist/* /var/www/chipapp/
pm2 restart chipapp-backend
```

## Manajemen

```bash
pm2 status
pm2 logs chipapp-backend
pm2 restart chipapp-backend
systemctl status nginx
systemctl status mariadb
```
