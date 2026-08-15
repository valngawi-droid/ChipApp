# ChipApp — Panduan Lengkap: Termux, APK, dan Server

Panduan langkah demi langkah dari nol sampai aplikasi terpasang di HP dan
terhubung ke server Anda sendiri.

Repo: `https://github.com/valngawi-droid/ChipApp` (branch `arena/01a0038a-chipapp`)

---

## Baca ini dulu — hal penting soal build APK

**APK tidak bisa dibuat di dalam Termux.** Ini bukan pilihan desain, tapi
batasan nyata:

- Expo SDK 57 (yang dipakai proyek ini) menargetkan **Android SDK 36**
  (terverifikasi di `expo-modules-core`: `compileSdkVersion 36`, `targetSdkVersion 36`)
- `aapt2` — perkakas wajib untuk mengemas APK — versi Termux baru mendukung
  sampai **SDK 34**
- Google tidak merilis Android SDK/NDK resmi untuk arsitektur ARM64 (prosesor HP)

Jadi ada **tiga peran** yang perlu dibedakan:

| Peran | Di mana dijalankan | Bisa di Termux? |
| --- | --- | --- |
| **Server backend** | HP Android via Termux | ✅ Ya, sudah teruji |
| **Build APK** | PC/laptop, atau cloud EAS | ❌ Tidak |
| **Menjalankan aplikasi** | HP Android | ✅ Ya, hasil pasang APK |

Panduan ini membahas ketiganya secara berurutan.

---

# BAGIAN 1 — Pasang Termux & Jalankan Server

### Langkah 1.1 — Pasang Termux dari F-Droid

Unduh dari **[f-droid.org/packages/com.termux](https://f-droid.org/packages/com.termux/)**

> ⚠️ **Jangan dari Play Store.** Versi di sana sudah lama tidak diperbarui dan
> paket-paketnya rusak.

Pasang juga **Termux:API** dari F-Droid (untuk wake-lock).

### Langkah 1.2 — Siapkan Termux

```bash
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts -y
node -v      # pastikan v18 atau lebih baru
```

### Langkah 1.3 — Ambil kode

```bash
git clone -b arena/01a0038a-chipapp \
  https://github.com/valngawi-droid/ChipApp.git
cd ChipApp/backend
```

### Langkah 1.4 — Jalankan penyiapan otomatis

```bash
bash termux-setup.sh
```

Skrip ini akan memasang dependensi, membuat `.env`, membuat `JWT_SECRET` acak,
menyalakan wake-lock, lalu menguji servernya sendiri.

### Langkah 1.5 — Nyalakan server

```bash
npm start
```

Uji di jendela Termux lain (geser dari kiri → New session):

```bash
curl localhost:4000/api/health
```

Harus muncul `{"status":"ok",...}`.

### Langkah 1.6 — Catat alamat IP HP Anda

```bash
npm run lan
# contoh keluaran: http://192.168.1.10:4000
```

**Simpan alamat ini** — nanti dipakai saat membuat APK.

### Langkah 1.7 — Cegah Android mematikan server

```bash
pkg install termux-api tmux -y
termux-wake-lock
```

Lalu: *Setelan → Aplikasi → Termux → Baterai → **Tidak dibatasi***

Agar server tetap hidup meski Termux ditutup:

```bash
tmux new -s chipapp
npm start
# lepas: Ctrl+B lalu D     |     kembali: tmux attach -t chipapp
```

---

# BAGIAN 2 — Membuat APK

Pilih **salah satu** dari dua cara berikut.

## Cara A — EAS Build (paling mudah, tanpa pasang apa-apa)

Build dikerjakan di server Expo. Anda hanya perlu akun gratis. Bisa dijalankan
**bahkan dari Termux**, karena yang bekerja adalah komputer di cloud.

### A.1 — Buat akun

Daftar gratis di **[expo.dev/signup](https://expo.dev/signup)**

### A.2 — Pasang EAS CLI

```bash
npm install -g eas-cli
eas login
```

### A.3 — Masuk ke folder proyek

```bash
cd ~/ChipApp        # folder utama, bukan backend/
npm install
```

### A.4 — Hubungkan proyek

```bash
eas init
```

Perintah ini otomatis mengisi `owner` dan `projectId` di `app.json`.

### A.5 — Arahkan aplikasi ke server Anda

Buka `eas.json`, cari profil `apk`, lalu ganti nilainya dengan alamat dari
Langkah 1.6:

```json
"apk": {
  "env": {
    "EXPO_PUBLIC_API_URL": "http://192.168.1.10:4000"
  }
}
```

> Kalau ingin diakses dari luar rumah (bukan hanya satu Wi-Fi), pakai URL
> Cloudflare Tunnel — lihat Bagian 4.

### A.6 — Build

```bash
eas build --platform android --profile apk
```

EAS akan bertanya soal keystore — pilih **"Generate new keystore"**. Expo yang
menyimpan dan mengelolanya, jadi tidak ada risiko hilang.

Tunggu 10–20 menit. Setelah selesai Anda dapat tautan unduhan APK.

### A.7 — Pasang

Unduh APK-nya di HP, ketuk, izinkan *"Instal aplikasi tak dikenal"*.

---

## Cara B — Build sendiri di PC/laptop (gratis, tanpa akun)

Butuh **Linux atau macOS** dengan JDK 17 dan Android SDK.

### B.1 — Pasang prasyarat

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install openjdk-17-jdk unzip wget -y

# Android SDK command-line tools
mkdir -p ~/Android/Sdk/cmdline-tools && cd ~/Android/Sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*.zip && mv cmdline-tools latest

# Variabel lingkungan (tambahkan ke ~/.bashrc agar permanen)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

### B.2 — Ambil kode dan build

```bash
git clone -b arena/01a0038a-chipapp \
  https://github.com/valngawi-droid/ChipApp.git
cd ChipApp
npm install

# Ganti dengan alamat dari Langkah 1.6
bash scripts/build-apk-local.sh http://192.168.1.10:4000
```

Skrip akan:
1. memeriksa JDK dan Android SDK,
2. **membuat keystore** dan meminta password (hanya sekali),
3. menjalankan `expo prebuild` untuk membuat folder `android/`,
4. mengatur signing config,
5. mengompilasi APK,
6. memverifikasi tanda tangannya.

Hasil: **`chipapp-release.apk`**

### B.3 — Pasang ke HP

```bash
adb install -r chipapp-release.apk
```

Atau salin berkasnya ke HP lalu ketuk.

> 🔑 **Backup `chipapp-release.keystore`!** Kalau hilang, Anda tidak akan pernah
> bisa merilis pembaruan untuk aplikasi yang sama. Simpan di cloud/flashdisk.

---

# BAGIAN 3 — Menandatangani APK (penjelasan)

Android **menolak memasang APK tanpa tanda tangan**. Tanda tangan membuktikan
semua pembaruan berasal dari orang yang sama.

Kedua cara di atas sudah menandatangani otomatis:

| | Keystore disimpan di | Risiko hilang |
| --- | --- | --- |
| **EAS (Cara A)** | Server Expo | Rendah — Expo yang mengelola |
| **Lokal (Cara B)** | Komputer Anda | **Tinggi — wajib backup sendiri** |

Memeriksa tanda tangan APK secara manual:

```bash
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs chipapp-release.apk
```

---

# BAGIAN 4 — Akses Server dari Mana Saja

Kalau HP-server dan HP-aplikasi tidak satu Wi-Fi, alamat `192.168.x.x` tidak
akan bisa dihubungi. Solusinya Cloudflare Tunnel — gratis dan tanpa perlu
membuka port di router.

### Di HP yang menjalankan server (Termux)

```bash
pkg install cloudflared -y
cd ~/ChipApp/backend
npm run tunnel
```

Cloudflare akan menampilkan URL seperti:

```
https://nama-acak-anda.trycloudflare.com
```

### Lalu build ulang APK dengan URL itu

```bash
# Cara A — ubah eas.json, lalu:
eas build --platform android --profile apk

# Cara B:
bash scripts/build-apk-local.sh https://nama-acak-anda.trycloudflare.com
```

Sekarang aplikasi bisa terhubung dari jaringan mana pun.

---

# Ringkasan Alur

```
┌─────────────────────┐         ┌──────────────────────┐
│  HP #1 (Termux)     │         │  PC / Cloud EAS      │
│                     │         │                      │
│  Server backend     │         │  Build APK           │
│  npm start :4000    │         │  (tidak bisa di      │
│  + cloudflared      │         │   Termux)            │
└──────────┬──────────┘         └───────────┬──────────┘
           │                                │
           │  EXPO_PUBLIC_API_URL           │  chipapp-release.apk
           │                                ▼
           │                     ┌──────────────────────┐
           └────────────────────▶│  HP #2 — ChipApp     │
                                 │  terpasang & jalan   │
                                 └──────────────────────┘
```

Satu HP juga bisa merangkap keduanya: menjalankan server **dan** aplikasi.

---

# Masalah yang Sering Muncul

| Gejala | Solusi |
| --- | --- |
| `aapt2 daemon failed to start` di Termux | Memang tidak didukung. Pakai EAS atau PC. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | APK lama ditandatangani keystore berbeda. Copot dulu aplikasi lama. |
| Aplikasi terpasang tapi tidak bisa login | Alamat backend salah. Cek `npm run lan` dan build ulang dengan URL yang benar. |
| `Network request failed` di aplikasi | Server mati, beda Wi-Fi, atau `HOST` masih `127.0.0.1` (harus `0.0.0.0`). |
| Server mati saat layar padam | Wake-lock belum aktif / optimasi baterai masih menyala. Lihat Langkah 1.7. |
| `eas build` minta login terus | Jalankan `eas login` lalu `eas whoami` untuk memastikan. |
| Build EAS gagal soal `projectId` | Jalankan `eas init` lebih dulu. |
| `npm install` lambat di Termux | `npm config set registry https://registry.npmmirror.com` |

---

# Catatan Jujur

Beberapa hal yang perlu Anda tahu sebelum berharap terlalu banyak:

- **APK ini belum pernah benar-benar dikompilasi.** Sandbox tempat proyek ini
  dibangun tidak punya Android SDK maupun Java, jadi skrip build sudah
  diverifikasi secara logika (sintaks, penyuntingan `build.gradle`, urutan
  langkah) tetapi belum dijalankan sampai menghasilkan `.apk`. Kemungkinan
  masih ada penyesuaian kecil saat Anda menjalankannya pertama kali.
- **`termux-setup.sh` juga belum diuji di Termux asli** — hanya di Linux x86.
  Logika dan sintaksnya sudah benar; langkah `pkg install` baru terbukti di HP Anda.
- **Pesan belum tersimpan permanen.** Server meneruskan pesan antar klien, tapi
  tidak menyimpannya. Restart server = riwayat hilang.
- **Login Google memakai profil demo** di lingkungan yang origin-nya belum
  terdaftar di OAuth client. Jalur verifikasi Google asli sudah ada dan dipakai
  begitu ID token tersedia.
- **Enkripsi end-to-end baru di tampilan.** Nomor keamanan 60 digit dihitung
  konsisten, tapi pesan belum benar-benar dienkripsi.
- **Ganti kredensial sebelum dipakai serius.** Token tunnel dan JWT secret yang
  dipakai selama pengembangan sudah pernah dibagikan dalam bentuk teks biasa.
