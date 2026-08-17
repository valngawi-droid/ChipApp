# Fix Realtime — Vercel Frontend + Render Backend + NeonDB (chiperx.cyou)

Masalah sebelumnya: Vercel serverless gak support WebSocket persistent penuh, jadi Socket.io cuma polling fallback, kadang gak realtime. Fix: **Hybrid**

```
User -> https://chiperx.cyou (Vercel Edge - frontend cepat)
       |
       ├─ / (dist) -> Vercel static
       └─ /api/*, /socket.io/* -> proxy atau direct ke Render backend
                                   |
                                   Render backend (Express + Socket.io full WebSocket)
                                   |
                                   Neon Postgres (persistent)
```

Real-time full jalan karena Socket.io konek langsung ke Render (yang support WebSocket persistent), bukan ke Vercel serverless.

---

## Cara Fix Realtime (2 opsi)

### Opsi A — Direct Connect (RECOMMENDED, realtime full)

Frontend Vercel konek langsung ke Render backend untuk API + Socket.io.

1. Deploy backend di Render dulu (yang pakai NeonDB) — kamu sudah punya Render backend kan? Contoh URL:
   ```
   https://chipapp-xxxx.onrender.com
   ```
   Test: `https://chipapp-xxxx.onrender.com/api/health` harus ok + database type postgres

2. Di **Vercel Dashboard** → Project `chip-app` → **Settings → Environment Variables** → Add:
   ```
   Key: EXPO_PUBLIC_API_URL
   Value: https://chipapp-xxxx.onrender.com
   Environments: Production, Preview
   ```
   Ganti `xxxx` dengan URL Render backend kamu.

3. Juga set (untuk proxy fallback):
   ```
   RENDER_BACKEND_URL=https://chipapp-xxxx.onrender.com
   DATABASE_URL=postgresql://... (Neon kamu)
   ```

4. Save → **Redeploy** (Use existing Build Cache OFF)

5. Setelah deploy, buka https://chiperx.cyou → Buka DevTools → Network → WS (WebSocket) → harus ada koneksi `wss://chipapp-xxxx.onrender.com/socket.io/?EIO=4&transport=websocket` → Status 101 Switching Protocols = realtime full!

6. Test: Buka 2 tab https://chiperx.cyou, kirim pesan di tab 1 → langsung muncul di tab 2 tanpa refresh = realtime jalan!

**Kenapa ini work?** Karena `src/api/config.ts`:
```ts
const EXPLICIT_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
export const API_BASE_URL = Platform.OS === 'web' ? EXPLICIT_BASE_URL ?? '' : NATIVE_BASE_URL;
```
Kalau `EXPO_PUBLIC_API_URL` di-set, frontend akan call API + Socket.io langsung ke Render backend, bukan via Vercel proxy. Render backend support WebSocket persistent penuh.

### Opsi B — Proxy via Vercel API (juga realtime tapi via polling)

Kalau gak mau set EXPO_PUBLIC_API_URL, pakai proxy yang sudah ada di `api/index.js`:

1. Set di Vercel Env:
   ```
   RENDER_BACKEND_URL=https://chipapp-xxxx.onrender.com
   ```
2. `api/index.js` akan proxy `/api/*` dan `/socket.io/*` (polling) ke Render backend
3. Socket.io akan fallback ke polling (bukan websocket full) tapi tetap realtime (delay 100-500ms)

Opsi A lebih realtime full (websocket), Opsi B lebih simple tapi polling.

---

## Env Vars yang harus ada di Vercel untuk realtime full

```
# Database persistent (Neon free)
DATABASE_URL=postgresql://neondb_owner:xxx@ep-...neon.tech/neondb?sslmode=require

# Backend Render untuk realtime full (ganti xxxx dengan URL Render kamu)
RENDER_BACKEND_URL=https://chipapp-xxxx.onrender.com
EXPO_PUBLIC_API_URL=https://chipapp-xxxx.onrender.com

# Auth
JWT_SECRET=random_32_char
GOOGLE_CLIENT_ID=68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID=68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com

# CORS
ALLOWED_ORIGINS=https://chiperx.cyou,https://www.chiperx.cyou

# Node
NODE_ENV=production
```

**Cara dapet Render backend URL:**
- Render Dashboard → service `chipapp` (backend) → copy URL di atas, contoh `https://chipapp-backend-abc123.onrender.com`
- Test: `https://chipapp-backend-abc123.onrender.com/api/health` harus ok

---

## Test Realtime Setelah Fix

```bash
# 1. Buka https://chiperx.cyou
# 2. Login demo
# 3. Buka DevTools (F12) → Network → filter WS
# 4. Harus ada websocket: wss://.../socket.io/?transport=websocket → 101
# 5. Kirim pesan → di Network harus ada POST /api/chats/.../messages atau socket emit
# 6. Buka 2 tab → kirim di tab 1 → harus langsung muncul di tab 2
```

Kalau masih gak realtime:
- Cek `EXPO_PUBLIC_API_URL` sudah di-set di Vercel Env belum
- Cek Render backend logs: `[socket] connected ...` harus muncul waktu user join
- Cek CORS di Render backend: `ALLOWED_ORIGINS` harus include `https://chiperx.cyou` dan `https://*.vercel.app` (sudah ada di code)

---

## Kenapa Vercel saja gak bisa full realtime?

Vercel serverless functions:
- Stateless, gak support persistent WebSocket connection lama
- Socket.io butuh server yang keep connection (Express + http.createServer + Socket.io)
- Render Web Service support persistent connection, full WebSocket

Jadi hybrid Vercel (frontend Edge cepat) + Render (backend Socket.io persistent) + NeonDB (DB persistent) = best for free plan.

---

## Checklist Realtime Fix

- [ ] Render backend deploy + NeonDB, test `/api/health` ok + `database.type: postgres`
- [ ] Copy Render backend URL
- [ ] Vercel Env set `EXPO_PUBLIC_API_URL` + `RENDER_BACKEND_URL` = Render URL
- [ ] Vercel Env set `DATABASE_URL` = Neon URL (optional, tapi recommended)
- [ ] Redeploy Vercel (Build Cache OFF)
- [ ] Buka https://chiperx.cyou → DevTools → WS → 101 Switching Protocols
- [ ] Test 2 tab realtime

Selesai! Sekarang **semua fungsi berjalan realtime**: chat, typing indicator, read receipt, online status, dll.
