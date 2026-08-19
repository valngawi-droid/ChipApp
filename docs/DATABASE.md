# Penyimpanan MySQL (chat tidak reset)

Mulai v5.0.0 backend mendukung **MySQL** untuk menyimpan pengguna, obrolan,
dan pesan secara permanen. Jika MySQL tidak dikonfigurasi, backend otomatis
kembali ke mode in-memory (data hilang saat restart).

## 1. Jalankan MySQL

Paling mudah pakai Docker (sudah ada `docker-compose.yml` di root):

```bash
docker compose up -d mysql
```

Atau pasang MySQL sendiri, lalu buat database:

```sql
CREATE DATABASE chipapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'chipapp'@'%' IDENTIFIED BY 'chipapp_pass';
GRANT ALL ON chipapp.* TO 'chipapp'@'%';
FLUSH PRIVILEGES;
```

Tabel dibuat otomatis saat backend pertama kali jalan.

## 2. Konfigurasi backend

Salin `backend/.env.example` ke `backend/.env`, lalu isi salah satu:

```env
DATABASE_URL=mysql://chipapp:chipapp_pass@127.0.0.1:3306/chipapp
```

atau

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=chipapp
MYSQL_PASSWORD=chipapp_pass
MYSQL_DATABASE=chipapp
```

Restart backend. Saat start, log akan menampilkan:

```
[storage] MySQL connected (.../chipapp)
ChipApp backend v5.0.0 on http://0.0.0.0:4000 (storage: mysql)
```

## 3. Verifikasi

```bash
curl https://xerophis.pallrzki.my.id/api/health
# {"storage":"mysql", ...}
```

Setelah ini, **riwayat chat tetap ada** walaupun Termux/HP/Server di-restart.

## Skema

- `users` — profil pengguna (Google & demo)
- `rooms` — obrolan 1:1
- `room_members` — anggota tiap room
- `messages` — pesan, reaksi (JSON), tanda dihapus/diedit

`HISTORY_LIMIT` (default 500) membatasi pesan terbaru yang dimuat per obrolan.
