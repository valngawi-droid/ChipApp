#!/usr/bin/env bash
#
# ChipApp — siapkan proyek Android native untuk CI.
#
# Dipakai oleh GitHub Actions. Menghasilkan folder android/ via expo prebuild,
# membakar EXPO_PUBLIC_API_URL ke dalam bundle, dan menyiapkan signing config.
#
# Environment:
#   EXPO_PUBLIC_API_URL   URL backend yang dibakar ke APK (default production).
#   KEYSTORE_PATH         Berkas .keystore yang sudah ada (opsional).
#   KEYSTORE_PASSWORD     Password keystore.
#
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${EXPO_PUBLIC_API_URL:=https://chiapp.chiperx.cyou}"
KEYSTORE_PATH="${KEYSTORE_PATH:-$PWD/chipapp-ci.keystore}"
KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-chipapp_ci_password}"
KEY_ALIAS="${KEY_ALIAS:-chipapp}"

echo "==> Menghasilkan proyek Android (expo prebuild)..."
npx expo prebuild --platform android --clean --non-interactive

# Nonaktifkan New Architecture supaya build lebih ringkas & kompatibel di CI
# (animasi Reanimated/worklets tetap jalan di arsitektur lama).
GRADLE_PROPS="android/gradle.properties"
if ! grep -q "newArchEnabled=false" "$GRADLE_PROPS"; then
  echo "newArchEnabled=false" >> "$GRADLE_PROPS"
fi

echo "==> Menyiapkan signing config..."
if [ -f "$KEYSTORE_PATH" ]; then
  cp "$KEYSTORE_PATH" android/app/release.keystore
  {
    echo "MYAPP_RELEASE_STORE_FILE=release.keystore"
    echo "MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS"
    echo "MYAPP_RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD"
    echo "MYAPP_RELEASE_KEY_PASSWORD=$KEYSTORE_PASSWORD"
  } >> "$GRADLE_PROPS"
  echo "   keystore dipasang: $KEYSTORE_PATH"
else
  echo "   !! keystore tidak ditemukan di $KEYSTORE_PATH — APK tidak akan ditandatangani rilis."
fi

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
  s = s.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );
  fs.writeFileSync(p, s);
  console.log('   signingConfig release ditanam.');
} else {
  console.log('   signingConfig sudah ada.');
}
NODE

echo "==> Prebuild selesai. API: $EXPO_PUBLIC_API_URL"
