# ChipApp

An iOS-fidelity instant messenger built with **Expo / React Native**, a **Node + Socket.io**
backend, Google OAuth verification, and a ten-language localization engine with RTL support.

**Bahasa Indonesia is the default language.** The app launches in Indonesian regardless of
device locale; users can switch to any of the other nine languages — or opt into following
the device via *Bawaan Sistem* — from Pengaturan → Bahasa Aplikasi.

The UI targets Apple HIG parity: large-title collapsing navigation bars, the SF type ramp,
grouped table views, physics-based spring animations (Reanimated 4 worklets), swipe-to-reply
gestures, reaction trays, and adaptive light/dark tokens.

---

## Quick start

```bash
npm install
(cd backend && npm install)

cp backend/.env.example backend/.env   # then fill in your secrets

npm run dev        # backend (:4000) + Expo web (:3000) together
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Backend + web app concurrently |
| `npm run web` / `ios` / `android` | Individual Expo targets |
| `npm run backend` | Express + Socket.io server only |
| `npm test` | Typecheck + backend + render + UI + i18n + untranslated suites |
| `npm run size` | Build-size breakdown |
| `npm run assets:sounds` / `assets:stickers` | Regenerate bundled media |

> The web target is a **preview convenience** (react-native-web). iOS is the design target;
> Android is supported through the same codebase.

---

## Running the server on Android (Termux)

The backend is **pure JavaScript** — no native modules, so no `node-gyp`,
`python` or `clang` toolchain is required. That makes it practical to host
straight from an Android phone.

```bash
pkg install git nodejs-lts -y
git clone https://github.com/valngawi-droid/ChipApp.git
cd ChipApp/backend
bash termux-setup.sh     # installs deps, generates a random JWT_SECRET, self-tests
npm start
```

Point the app at that phone with `EXPO_PUBLIC_API_URL`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npm run web
```

Full walkthrough — wake-locks, battery optimisation, `tmux`, Cloudflare Tunnel
and a troubleshooting table — is in **[backend/TERMUX.md](backend/TERMUX.md)**
(written in Indonesian).

### Building an installable APK

> **APK builds cannot run inside Termux.** Expo SDK 57 targets Android SDK 36
> while Termux's `aapt2` only supports up to SDK 34, and Google ships no ARM64
> Android SDK. Build in the cloud or on a desktop instead.

```bash
npm run apk:eas      # cloud build via EAS (easiest; free account)
npm run apk:local    # local build on Linux/macOS with JDK 17 + Android SDK
```

**[PANDUAN.md](PANDUAN.md)** is the complete Indonesian walkthrough covering
Termux setup, both APK routes, signing, and connecting the app to your server.

---

## Architecture

```
ChipApp/
├── assets/
│   ├── loc/          10 language dictionaries (en id es fr de ar ja zh pt ru)
│   ├── sounds/       8 procedurally-synthesised notification cues (.wav)
│   └── stickers/     28 original stickers — SVG sources + @1x/@2x/@3x PNGs
├── backend/
│   ├── server.js     Express, Socket.io, Google ID-token verification, JWT sessions
│   └── .env.example  Configuration template (real .env is git-ignored)
├── scripts/          Asset generators, size report, and the test harnesses
└── src/
    ├── api/          REST client, socket transport, auth calls
    ├── components/   Avatar, ChatBubble (+tail/voice/reactions), nav bar, sheets,
    │                 grouped list, search bar, language & sticker pickers
    ├── data/         Deterministic seed content
    ├── i18n/         Provider, device-locale detection, RTL handling
    ├── navigation/   Bottom tabs + native stack (chat room, full-screen call)
    ├── screens/      Login, Chats, ChatRoom, Status(+Viewer), Calls, Call,
    │                 Communities, Settings
    ├── state/        Zustand store
    ├── theme/        Design tokens + ThemeProvider
    └── utils/        Haptics, date/byte formatters, safety-number helpers
```

### Networking model

The browser rendering the preview is **not** inside the sandbox, so the app never calls
`localhost` for the API. It uses relative paths (`/api`, `/socket.io`) and Metro proxies
them to the backend (`metro.config.js`). In production the same relative paths are served
through the Cloudflare Tunnel hostname, so no client code changes between environments.

```bash
# Expose the backend publicly
cloudflared tunnel run --token $CLOUDFLARE_TUNNEL_TOKEN
```

---

## Feature coverage

| Area | Implemented |
| --- | --- |
| Auth | Google ID-token verification → signed JWT (30-day), bearer-protected `/api/me` |
| Chats | Pin / mute / delete, unread badges, search, swipe-to-reply, reactions, read receipts, day separators, typing indicators |
| Media | Voice notes with waveform + 1×/1.5×/2× playback, sticker packs, attachment sheet |
| Calls | CallKit-style screen, slide-to-answer, mute/speaker/video toggles, filtered log |
| Status | Circular gradient rings, progress bars, tap-to-advance, hold-to-pause, reply bar |
| Communities | Expandable parent → group hierarchy, verified channels |
| Settings | Grouped tables, safety number, appearance switching, language picker |
| i18n | Indonesian default, 10 locales, live switching, opt-in device detection, Arabic RTL |

---

## Testing

`npm test` runs five suites (all green):

- **typecheck** — `tsc --noEmit`, strict mode
- **backend** (19 checks) — health, demo auth, JWT signature/expiry, tampered- and
  forged-token rejection, socket auth, delivery acks, typing relay, room isolation
- **smoke / flow** — executes the real Metro bundle in jsdom, asserts the login screen
  renders and that sign-in reaches the authenticated chat list with zero runtime errors
- **ui** (28 checks) — navigates every tab and asserts the emitted DOM carries the exact
  design tokens (`#25D366`, `#007AFF`, `#DCF8C6`, `#EFE7DE`), the 34/17 px type ramp,
  hairline separators, and expected per-screen content
- **i18n** — key parity across all 10 dictionaries (107 keys each), no empty values, RTL
  metadata, translations differ from English, plus live switching to English and Arabic
- **untranslated sweep** — renders all 7 screens in the default locale and scans all ~145
  visible strings for leftover English chrome that never went through `t()`

Chrome cannot be installed in this environment, so the harnesses execute the production
bundle in **jsdom** rather than a real browser. That verifies logic, state, navigation and
computed styles, but not final paint — check the live preview for visual confirmation.

---

## Notes on the spec

A few deliberate deviations, each for a concrete reason:

- **`≥ 76 MB` bundle.** The authored payload is ~1.7 MB and the web build ~2.5 MB. A release
  binary reaches roughly 60–95 MB (unthinned iOS install) or 70–110 MB (universal Android
  APK) once Hermes and the native libraries are linked, but a *thinned* per-device download
  lands nearer 28–42 MB. Padding the bundle with filler bytes to force the number would
  slow installs and invite App Store review problems, so the assets are all real and
  functional instead. `npm run size` prints the full breakdown.
- **SF Pro fonts are not bundled.** Apple's licence forbids redistributing the binaries.
  The theme resolves the genuine system font on Apple platforms and uses a metrically
  similar stack elsewhere — the correct way to get SF.
- **Sounds and stickers are original.** iOS system sounds and WhatsApp artwork are
  copyrighted; both asset sets are generated from scratch by `scripts/` and are safe to ship.
- **Google sign-in falls back to a demo profile.** The sandbox preview origin is not on the
  OAuth client's authorised list, so the consent screen cannot complete there. The real
  verification path (`POST /api/auth/google`) is fully implemented and used whenever an ID
  token is present; the fallback issues a genuine signed JWT so the app stays explorable.
  Disable it with `ALLOW_DEMO_AUTH=false`.
- **E2EE is presentation-only.** `src/utils/crypto.ts` derives the displayed safety number
  and fingerprints. Real end-to-end encryption needs the Signal double-ratchet with native
  key storage; shipping a fake cipher that looks protective would be worse than being clear
  that it is not yet wired.
- **Voice-note playback is simulated** on a timer. The transport, scrubbing and speed
  cycling are real; decoding needs `expo-av` plus recorded assets per message.

## Security

`backend/.env` is git-ignored — only `.env.example` is committed. Rotate any credential
that has been shared in plaintext (including the tunnel token and JWT secret used during
development) before deploying.
