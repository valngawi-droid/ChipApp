# Menjalankan Server ChipApp di Termux (Android)

Backend ChipApp **murni JavaScript** — tidak ada modul native, jadi tidak perlu
`node-gyp`, `python`, atau `clang`. Inilah alasan server ini ringan dijalankan
langsung dari HP Android.

Sudah diverifikasi: seluruh pohon dependensi (`express`, `socket.io`,
`google-auth-library`, `jsonwebtoken`, `cors`, `dotenv`) tidak memuat satu pun
berkas `.node` atau `binding.gyp`.

---

## Cara cepat (otomatis)

```bash
pkg install git nodejs-lts -y
git clone https://github.com/valngawi-droid/ChipApp.git
cd ChipApp/backend
bash termux-setup.sh
```

Skrip tersebut akan:

1. memasang `nodejs-lts` dan `git` bila belum ada,
2. memasang dependensi npm (tanpa devDependencies),
3. menyalin `.env.example` → `.env` **dan membuat `JWT_SECRET` acak**,
4. mengaktifkan wake-lock agar Android tidak mematikan server,
5. menguji server dan melaporkan alamat LAN Anda.

Setelah selesai:

```bash
npm start
```

---

## Cara manual (langkah demi langkah)

### 1. Pasang Termux

Unduh dari **F-Droid**, bukan Play Store — versi Play Store sudah usang dan
paketnya tidak lagi diperbarui.

### 2. Pasang kebutuhan dasar

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts git -y
node -v      # harus 18 atau lebih baru
```

### 3. Ambil kode dan pasang dependensi

```bash
git clone https://github.com/valngawi-droid/ChipApp.git
cd ChipApp/backend
npm install --omit=dev
```

### 4. Siapkan konfigurasi

```bash
cp .env.example .env
nano .env
```

Isi minimal:

```ini
GOOGLE_CLIENT_ID=<client id Google Anda>
JWT_SECRET=<acak, panjang, rahasia>
PORT=4000
HOST=0.0.0.0
```

Membuat secret acak:

```bash
node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))'
```

### 5. Jalankan

```bash
npm start
```

Uji dari HP yang sama:

```bash
curl localhost:4000/api/health
```

Harus muncul: `{"status":"ok","service":"chipapp-backend",...}`

---

## Agar server tidak mati sendiri

Android agresif mematikan proses latar belakang. Tiga langkah ini penting:

```bash
# 1. Wake-lock (wajib)
pkg install termux-api -y
termux-wake-lock
```

2. **Matikan optimasi baterai** untuk Termux:
   *Setelan → Aplikasi → Termux → Baterai → Tidak dibatasi*

3. Jalankan di sesi yang bertahan, memakai `tmux`:

```bash
pkg install tmux -y
tmux new -s chipapp
npm start
# lepas sesi: tekan Ctrl+B lalu D
# kembali:    tmux attach -t chipapp
```

Atau pakai skrip bawaan yang sudah menyalakan wake-lock:

```bash
npm run termux:start
```

---

## Mengakses server

### Dari perangkat lain di Wi-Fi yang sama

```bash
npm run lan     # menampilkan http://192.168.x.x:4000
```

Pastikan `HOST=0.0.0.0` di `.env` (bukan `127.0.0.1`), agar bisa diakses
dari luar HP.

### Dari internet (tanpa port forwarding)

```bash
pkg install cloudflared -y
npm run tunnel
```

Cloudflare akan memberi URL publik `https://…` yang meneruskan `/api` dan
`/socket.io` ke server di HP Anda. Arahkan aplikasi ke domain itu lewat
`EXPO_PUBLIC_API_URL`.

> Token tunnel dibaca dari `.env`, jadi tidak pernah tertulis di berkas yang
> masuk Git.

---

## Menyambungkan aplikasi ke server Termux

Di mesin tempat aplikasi dijalankan:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npm run web
```

atau, jika memakai tunnel:

```bash
EXPO_PUBLIC_API_URL=https://nama-tunnel-anda.trycloudflare.com npm run web
```

---

## Masalah yang sering muncul

| Gejala | Penyebab & solusi |
| --- | --- |
| `EADDRINUSE: address already in use` | Port dipakai proses lain. `pkill node` lalu jalankan lagi, atau ubah `PORT` di `.env`. |
| `EACCES` saat pakai port 80/443 | Android melarang port < 1024 tanpa root. Gunakan 4000 lalu ekspos via tunnel. |
| Server mati saat layar padam | Wake-lock belum aktif atau optimasi baterai masih menyala. Lihat bagian di atas. |
| Perangkat lain tidak bisa konek | `HOST` masih `127.0.0.1`. Ubah ke `0.0.0.0`. Cek juga isolasi klien di router. |
| `npm install` gagal / lambat | Ganti registry: `npm config set registry https://registry.npmmirror.com` |
| `command not found: node` | `pkg install nodejs-lts` — jangan pakai `nodejs` yang versinya bisa berbeda. |
| Socket.io putus-nyambung | Normal saat jaringan seluler berpindah. Klien sudah otomatis reconnect. |

---

## Catatan performa & keamanan

- **Performa cukup untuk skala kecil.** HP kelas menengah sanggup melayani
  puluhan koneksi socket bersamaan. Ini tepat untuk pemakaian pribadi,
  keluarga, atau demo — bukan untuk produksi berskala besar.
- **Penyimpanan pesan masih di memori.** Pesan diteruskan antar klien, bukan
  disimpan permanen; server restart = riwayat hilang. Untuk persistensi,
  tambahkan SQLite (`pkg install sqlite`).
- **Jangan buka port langsung ke internet** lewat DMZ atau port forwarding.
  Pakai Cloudflare Tunnel, yang sudah menyediakan TLS.
- **`.env` tidak pernah masuk Git.** Bila token pernah dibagikan, ganti segera.
- **Baterai.** Menjalankan server terus-menerus menguras daya; sambungkan
  pengisi daya untuk pemakaian panjang.
