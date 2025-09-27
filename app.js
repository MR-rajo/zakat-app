const express = require("express");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const path = require("path");

// Load environment variables
dotenv.config();

const app = express();

// Setup database connection pool
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "zakat_fitrah",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Database connected successfully");
    connection.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

testConnection();

// Make database available to all routes
app.locals.db = pool;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-default-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Flash messages middleware
app.use(flash());

// Global variables for all routes
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  next();
});

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  req.flash("error_msg", "Silakan login untuk mengakses halaman ini");
  res.redirect("/auth/login");
}

// Admin middleware
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  req.flash(
    "error_msg",
    "Akses ditolak. Hanya admin yang dapat mengakses halaman ini"
  );
  res.redirect("/");
}

// Make middleware available globally
app.locals.isAuthenticated = isAuthenticated;
app.locals.isAdmin = isAdmin;

// Routes
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const muzakkiRoutes = require("./routes/muzakki");
const infakRoutes = require("./routes/infak");
const laporanRoutes = require("./routes/laporan");
const rtRoutes = require("./routes/rt");
const mustahikRoutes = require("./routes/mustahik");
const distribusiRoutes = require("./routes/distribusi");

// Route middleware
app.use("/auth", authRoutes);
app.use("/users", isAuthenticated, isAdmin, usersRoutes);
app.use("/muzakki", isAuthenticated, muzakkiRoutes);
app.use("/infak", isAuthenticated, infakRoutes);
app.use("/laporan", isAuthenticated, laporanRoutes);
app.use("/rt", isAuthenticated, rtRoutes);
app.use("/mustahik", isAuthenticated, mustahikRoutes);
app.use("/distribusi", isAuthenticated, distribusiRoutes);

// Dashboard route
app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const db = req.app.locals.db;
    // Get statistics
    const [statsResult] = await db.execute(`
      SELECT
        COUNT(DISTINCT m.id) as total_muzakki,
        COALESCE(SUM(CASE 
          WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
          ELSE m.jumlah_beras_kg * 12000 
        END), 0) as total_zakat,
        COUNT(CASE 
          WHEN m.jumlah_bayar < CASE 
            WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
            ELSE m.jumlah_beras_kg * 12000 
          END THEN 1 
        END) as belum_bayar
      FROM muzakki m
    `);

    // Get infak total separately
    const [infakResult] = await db.execute(`
      SELECT COALESCE(SUM(jumlah), 0) as total_infak FROM infak
    `);

    // Get recent muzakki
    const [recentMuzakki] = await db.execute(`
      SELECT m.*, rt.nomor_rt as rt_nama,
        CASE 
          WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
          ELSE m.jumlah_beras_kg * 12000 
        END as jumlah_zakat,
        CASE
          WHEN m.jumlah_bayar >= CASE 
            WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
            ELSE m.jumlah_beras_kg * 12000 
          END THEN 'lunas'
          ELSE 'belum_lunas'
        END as status
      FROM muzakki m
      LEFT JOIN rt ON m.rt_id = rt.id
      ORDER BY m.created_at DESC
      LIMIT 5
    `);

    // Get RT statistics
    const [rtStats] = await db.execute(`
      SELECT
        rt.nomor_rt as nama,
        COUNT(m.id) as total_muzakki,
        COALESCE(SUM(CASE 
          WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
          ELSE m.jumlah_beras_kg * 12000 
        END), 0) as total_zakat,
        COUNT(CASE 
          WHEN m.jumlah_bayar >= CASE 
            WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
            ELSE m.jumlah_beras_kg * 12000 
          END THEN 1 
        END) as lunas,
        COUNT(CASE 
          WHEN m.jumlah_bayar < CASE 
            WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang 
            ELSE m.jumlah_beras_kg * 12000 
          END THEN 1 
        END) as belum_bayar
      FROM rt
      LEFT JOIN muzakki m ON rt.id = m.rt_id
      GROUP BY rt.id, rt.nomor_rt
      ORDER BY rt.nomor_rt
      LIMIT 10
    `);

    // Combine stats
    const stats = {
      ...statsResult[0],
      total_infak: infakResult[0].total_infak,
    };

    res.render("dashboard", {
      title: "Dashboard - Zakat Fitrah App",
      user: req.session.user,
      stats: stats || {},
      recentMuzakki: recentMuzakki || [],
      rtStats: rtStats || [],
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.flash("error", "Gagal memuat dashboard");
    res.redirect("/muzakki");
  }
});

// Home route - redirect to dashboard if authenticated
app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/auth/login");
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Halaman Tidak Ditemukan",
    message: "Halaman yang Anda cari tidak ditemukan",
    error: { status: 404 },
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(500).render("error", {
    title: "Server Error",
    message: "Terjadi kesalahan pada server",
    error: process.env.NODE_ENV === "development" ? error : {},
  });
});

module.exports = app;
