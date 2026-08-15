#!/usr/bin/env bash
#
# ChipApp — build APK yang sudah ditandatangani, di komputer (Linux/macOS).
#
# CATATAN PENTING: skrip ini TIDAK bisa dijalankan di dalam Termux.
# Expo SDK 57 menargetkan Android SDK 36, sedangkan aapt2 bawaan Termux baru
# mendukung sampai SDK 34, jadi Gradle akan gagal. Jalankan skrip ini di PC/laptop,
# lalu salin APK-nya ke HP.
#
# Pemakaian:
#   bash scripts/build-apk-local.sh [URL_BACKEND]
#
# Contoh:
#   bash scripts/build-apk-local.sh http://192.168.1.10:4000
#
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!!${NC}  $*"; }
fail() { echo -e "${RED}xx${NC}  $*" >&2; exit 1; }

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_URL="${1:-}"
KEYSTORE="${KEYSTORE_PATH:-$PWD/chipapp-release.keystore}"
KEY_ALIAS="${KEY_ALIAS:-chipapp}"

echo
echo "  ChipApp — Build APK Lokal"
echo "  ========================="
echo

# --- 0. Tolak dengan jelas bila dijalankan di Termux -------------------------
if [ -d "/data/data/com.termux/files/usr" ]; then
  fail "Terdeteksi Termux.
      Build APK Expo SDK 57 tidak bisa dilakukan di Termux (aapt2 Termux
      hanya sampai Android SDK 34, sedangkan proyek ini butuh SDK 36).
      Jalankan skrip ini di PC/laptop, atau pakai 'eas build' di cloud."
fi

# --- 1. Prasyarat -------------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js tidak ditemukan."
command -v java >/dev/null 2>&1 || fail "Java (JDK 17) tidak ditemukan. Pasang: openjdk-17-jdk"

JAVA_MAJOR="$(java -version 2>&1 | head -1 | grep -oE '[0-9]+' | head -1)"
[ "$JAVA_MAJOR" -ge 17 ] || fail "Butuh JDK 17 atau lebih baru (terpasang: $JAVA_MAJOR)."

[ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] \
  || fail "ANDROID_HOME belum diset. Pasang Android SDK lalu:
      export ANDROID_HOME=\$HOME/Android/Sdk"

SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
info "Node $(node -v), JDK $JAVA_MAJOR, SDK di $SDK"

# --- 2. Dependensi ------------------------------------------------------------
[ -d node_modules ] && info "node_modules sudah ada." || { info "Memasang dependensi…"; npm install; }

# --- 3. Keystore (dibuat sekali, JANGAN sampai hilang) ------------------------
if [ ! -f "$KEYSTORE" ]; then
  warn "Keystore belum ada — membuat yang baru."
  warn "SIMPAN BAIK-BAIK. Kalau hilang, Anda tidak bisa merilis pembaruan"
  warn "untuk aplikasi yang sama selamanya."
  echo
  read -r -s -p "  Buat password keystore: " KS_PASS; echo
  [ ${#KS_PASS} -ge 6 ] || fail "Password minimal 6 karakter."

  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=ChipApp, OU=Mobile, O=ChipApp, L=Jakarta, S=DKI, C=ID"
  info "Keystore dibuat: $KEYSTORE"
else
  info "Memakai keystore yang sudah ada: $KEYSTORE"
  read -r -s -p "  Password keystore: " KS_PASS; echo
fi

# --- 4. Prebuild: hasilkan folder android/ ------------------------------------
info "Menghasilkan proyek Android native (expo prebuild)…"
npx expo prebuild --platform android --clean

# --- 5. Tanamkan alamat backend ----------------------------------------------
if [ -n "$API_URL" ]; then
  info "Backend disetel ke: $API_URL"
  export EXPO_PUBLIC_API_URL="$API_URL"
else
  warn "URL backend tidak diberikan — aplikasi memakai nilai bawaan."
  warn "Ulangi dengan: bash scripts/build-apk-local.sh http://IP-HP-ANDA:4000"
fi

# --- 6. Konfigurasi penandatanganan ------------------------------------------
info "Menyiapkan signing config…"
cp "$KEYSTORE" android/app/release.keystore
{
  echo "MYAPP_RELEASE_STORE_FILE=release.keystore"
  echo "MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS"
  echo "MYAPP_RELEASE_STORE_PASSWORD=$KS_PASS"
  echo "MYAPP_RELEASE_KEY_PASSWORD=$KS_PASS"
} >> android/gradle.properties

# Sisipkan signingConfig release ke build.gradle bila belum ada.
node - <<'NODE'
const fs = require('fs');
const p = 'android/app/build.gradle';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('MYAPP_RELEASE_STORE_FILE')) {
  s = s.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }`
  );
  // Arahkan buildType release ke signingConfig di atas.
  s = s.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );
  fs.writeFileSync(p, s);
  console.log('   build.gradle diperbarui.');
} else {
  console.log('   build.gradle sudah dikonfigurasi.');
}
NODE

# --- 7. Build ------------------------------------------------------------------
info "Mengompilasi APK release (butuh beberapa menit)…"
cd android
./gradlew assembleRelease --no-daemon
cd ..

APK="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || fail "Build gagal — APK tidak ditemukan."

# --- 8. Verifikasi tanda tangan ------------------------------------------------
APKSIGNER="$(find "$SDK/build-tools" -name apksigner -type f 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$APKSIGNER" ]; then
  info "Memverifikasi tanda tangan…"
  "$APKSIGNER" verify --print-certs "$APK" | head -4
else
  warn "apksigner tidak ditemukan — verifikasi dilewati."
fi

OUT="chipapp-release.apk"
cp "$APK" "$OUT"

echo
echo "  Selesai."
echo "  ---------------------------------------------------"
echo "  APK   : $OUT  ($(du -h "$OUT" | cut -f1))"
echo "  Pasang: adb install -r $OUT"
echo "          atau salin ke HP lalu ketuk berkasnya."
echo "  ---------------------------------------------------"
echo
warn "Backup '$KEYSTORE' di tempat aman. Tanpa itu, pembaruan mustahil."
