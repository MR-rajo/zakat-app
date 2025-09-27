# 🕌 Aplikasi Pendataan Zakat Fitrah

Aplikasi web untuk mengelola pendataan zakat fitrah dengan fitur CRUD muzakki, perhitungan otomatis, dan manajemen infak. Dibangun dengan **Node.js**, **Express**, **MySQL**, **EJS**, dan **TailwindCSS**.

## ✨ Fitur Utama

- 🔐 **Autentikasi User** - Login/logout dengan session management
- 👥 **CRUD Muzakki** - Kelola data muzakki dan perhitungan zakat
- 🧮 **Perhitungan Otomatis** - Hitung kewajiban zakat beras (2.5kg/jiwa) atau uang (Rp 45.000/jiwa)
- 💰 **Manajemen Kembalian** - Sedekahkan kembalian sebagai infak
- 📊 **Laporan RT** - Laporan pengumpulan zakat per RT
- 🎯 **Data Infak** - Tracking infak dari kembalian zakat
- 👨‍💼 **Role Management** - Admin dan Panitia dengan akses berbeda

## 🛠 Teknologi

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Template Engine**: EJS
- **Styling**: TailwindCSS
- **Authentication**: bcryptjs, express-session
- **Flash Messages**: connect-flash
- **Method Override**: method-override untuk PUT/DELETE

## 📋 Prasyarat

- Node.js (v14 atau lebih baru)
- MySQL Server
- npm atau yarn

## 🚀 Instalasi

### 1. Clone Repository dan Install Dependencies

```bash
# Clone atau download project ke folder zakat-app
cd d:\zakat-app

# Install dependencies
npm install
```

### 2. Setup Database

Buat database MySQL dan jalankan script berikut:

```sql
-- Buat database
CREATE DATABASE zakat_fitrah;
USE zakat_fitrah;

-- Tabel users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nomor_wa VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','panitia') DEFAULT 'panitia',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel rt
CREATE TABLE rt (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nomor_rt VARCHAR(10) NOT NULL,
    ketua_rt VARCHAR(100) NOT NULL,
    keterangan VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel muzakki
CREATE TABLE muzakki (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rt_id INT NOT NULL,
    nama VARCHAR(100) NOT NULL,
    jumlah_jiwa INT NOT NULL,
    jenis_zakat ENUM('beras','uang') NOT NULL,
    jumlah_beras_kg DECIMAL(10,2) DEFAULT NULL,
    jumlah_uang DECIMAL(10,2) DEFAULT NULL,
    jumlah_bayar DECIMAL(10,2) DEFAULT NULL,
    kembalian DECIMAL(10,2) DEFAULT 0,
    catatan VARCHAR(255) NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rt_id) REFERENCES rt(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabel mustahik
CREATE TABLE mustahik (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rt_id INT DEFAULT NULL,
    nama VARCHAR(100) NOT NULL,
    kategori ENUM('fakir','miskin','amil','mualaf','fisabilillah','gharim','ibnusabil') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rt_id) REFERENCES rt(id)
);

-- Tabel distribusi_zakat
CREATE TABLE distribusi_zakat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mustahik_id INT NOT NULL,
    jenis_zakat ENUM('beras','uang') NOT NULL,
    jumlah DECIMAL(10,2) NOT NULL,
    status ENUM('pending','disalurkan','diterima','batal') DEFAULT 'pending',
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (mustahik_id) REFERENCES mustahik(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabel infak
CREATE TABLE infak (
    id INT AUTO_INCREMENT PRIMARY KEY,
    muzakki_id INT NOT NULL,
    jumlah DECIMAL(10,2) NOT NULL,
    keterangan VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (muzakki_id) REFERENCES muzakki(id)
);
```

### 3. Sample Data (Opsional)

```sql
-- Sample RT data
INSERT INTO rt (nomor_rt, ketua_rt, keterangan) VALUES
('RT 01', 'Bapak Ahmad', 'Wilayah Utara'),
('RT 02', 'Bapak Budi', 'Wilayah Selatan'),
('RT 03', 'Bapak Candra', 'Wilayah Timur');

-- Sample admin user (password: admin123)
INSERT INTO users (name, nomor_wa, password, role) VALUES
('Admin Zakat', '08123456789', '$2a$10$rqMqHgI8Q8HxJ1d2LHBKHeF7rqHgI8Q8HxJ1d2LHBKHeF7rqHgI8Q8', 'admin');
```

### 4. Konfigurasi Environment

Edit file `.env` sesuai dengan konfigurasi database Anda:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=zakat_fitrah

# Server Configuration
PORT=3000
NODE_ENV=development

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
```

### 5. Build CSS (Jika perlu)

```bash
# Build TailwindCSS (opsional, CSS sudah include)
npm run build-css
```

### 6. Jalankan Aplikasi

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Akses aplikasi di: http://localhost:3000

## 👤 Login Default

Setelah setup database, Anda bisa:

1. **Mode Development**: Akses `/auth/register` untuk membuat user baru
2. **Buat user admin manual**:
   ```sql
   -- Password: admin123
   INSERT INTO users (name, nomor_wa, password, role) VALUES
   ('Admin', '08123456789', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
   ```

## 📱 Penggunaan

### 1. Login System

- Login menggunakan nomor WhatsApp dan password
- Session otomatis expire setelah 24 jam
- Flash messages untuk feedback user

### 2. Manajemen Muzakki

- **Tambah muzakki**: Form dengan validasi lengkap
- **Edit data**: Update informasi muzakki
- **Hapus data**: Dengan konfirmasi safety
- **Perhitungan otomatis**: Kewajiban zakat berdasarkan jumlah jiwa

### 3. Sistem Kembalian

- Jika pembayaran > kewajiban → ada kembalian
- Tombol "Sedekahkan kembalian" → otomatis jadi infak
- Tracking infak yang terkumpul

### 4. Laporan

- **Per RT**: Statistik muzakki, zakat terkumpul
- **Total keseluruhan**: Summary semua RT
- **Infak**: Total dari kembalian yang disedekahkan

## 🎯 Fitur Unggulan

### Perhitungan Otomatis

- **Zakat Beras**: 2,5 kg × jumlah jiwa
- **Zakat Uang**: Rp 45.000 × jumlah jiwa
- **Kembalian**: Otomatis dihitung jika bayar > kewajiban

### UI/UX Modern

- Responsive design dengan TailwindCSS
- Icons dari Font Awesome
- Flash messages yang user-friendly
- Form validation yang robust

### Security

- Password hashing dengan bcryptjs
- Session management
- Input validation & sanitization
- Role-based access control

## 📁 Struktur Project

```
zakat-app/
├── app.js                 # Konfigurasi Express
├── server.js              # Server runner
├── .env                   # Environment variables
├── package.json           # Dependencies
├── tailwind.config.js     # TailwindCSS config
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── muzakki.js        # Muzakki CRUD routes
│   ├── infak.js          # Infak routes
│   ├── laporan.js        # Report routes
│   └── users.js          # User management routes
├── views/
│   ├── layouts/
│   │   └── main.ejs      # Main layout
│   ├── auth/
│   │   ├── login.ejs     # Login page
│   │   └── register.ejs  # Register page
│   ├── muzakki/
│   │   ├── index.ejs     # Muzakki list
│   │   ├── create.ejs    # Add muzakki form
│   │   └── edit.ejs      # Edit muzakki form
│   ├── infak/
│   │   └── index.ejs     # Infak list
│   ├── laporan/
│   │   └── index.ejs     # Reports page
│   ├── users/
│   │   └── index.ejs     # User management
│   └── error.ejs         # Error page
└── public/
    └── css/
        ├── input.css     # TailwindCSS input
        └── output.css    # Compiled CSS
```

## 🔧 Script NPM

```bash
npm start          # Jalankan production server
npm run dev        # Jalankan development server dengan nodemon
npm run build-css  # Build TailwindCSS dengan watch mode
```

## 🛡 Security Notes

- Ganti `SESSION_SECRET` di production
- Gunakan HTTPS di production
- Backup database secara berkala
- Monitor akses user admin

## 🐛 Troubleshooting

### Database Connection Error

- Pastikan MySQL server berjalan
- Cek kredensial di file `.env`
- Pastikan database `zakat_fitrah` sudah dibuat

### CSS Tidak Muncul

- Jalankan `npm run build-css`
- Pastikan file `public/css/output.css` ada

### Session Error

- Clear browser cookies
- Restart server
- Cek `SESSION_SECRET` di `.env`

## 📈 Pengembangan Selanjutnya

- [ ] Export laporan ke Excel/PDF
- [ ] Notifikasi WhatsApp otomatis
- [ ] Dashboard analytics
- [ ] Backup/restore database
- [ ] Multi-tahun zakat
- [ ] Print receipts

## 🤝 Kontribusi

1. Fork repository
2. Buat feature branch
3. Commit changes
4. Push ke branch
5. Buat Pull Request

## 📄 License

MIT License - Silakan digunakan untuk keperluan sosial dan dakwah.

## 📞 Support

Jika ada pertanyaan atau butuh bantuan:

- Buat issue di repository
- Email: [your-email@example.com]

---

**Barakallahu fiikum** - Semoga aplikasi ini bermanfaat untuk kemudahan pengelolaan zakat fitrah di masyarakat. 🤲
