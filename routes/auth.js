const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// GET /auth/login - Show login form
router.get("/login", (req, res) => {
  // Redirect to dashboard if already logged in
  if (req.session.user) {
    return res.redirect("/");
  }

  // Get messages from query parameters
  const success = req.query.success;
  const error = req.query.error;

  res.render("auth/login", {
    title: "Login - Zakat Fitrah",
    layout: "layouts/main",
    success: success,
    error: error,
  });
});

// POST /auth/login - Process login
router.post("/login", async (req, res) => {
  const { nomor_wa, password } = req.body;

  try {
    // Input validation
    if (!nomor_wa || !password) {
      req.flash("error_msg", "Nomor WhatsApp dan password harus diisi");
      return res.redirect("/auth/login");
    }

    // Get database connection
    const db = req.app.locals.db;

    // Find user by nomor_wa
    const [users] = await db.execute("SELECT * FROM users WHERE nomor_wa = ?", [
      nomor_wa,
    ]);

    if (users.length === 0) {
      req.flash("error_msg", "Nomor WhatsApp atau password salah");
      return res.redirect("/auth/login");
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      req.flash("error_msg", "Nomor WhatsApp atau password salah");
      return res.redirect("/auth/login");
    }

    // Create session
    req.session.user = {
      id: user.id,
      name: user.name,
      nomor_wa: user.nomor_wa,
      role: user.role,
    };

    req.flash("success", `Selamat datang, ${user.name}!`);
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error_msg", "Terjadi kesalahan saat login");
    res.redirect("/auth/login");
  }
});

// GET /auth/logout - Logout user
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect("/?error=Terjadi kesalahan saat logout");
    }
    res.redirect("/?success=Anda telah berhasil logout");
  });
});

// POST /auth/logout - Logout user (for form submission)
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect("/?error=Terjadi kesalahan saat logout");
    }
    res.redirect("/?success=Anda telah berhasil logout");
  });
});

// GET /auth/register - Show register form (only for development)
router.get("/register", (req, res) => {
  // Only show register form in development mode
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).send("Not Found");
  }

  res.render("auth/register", {
    title: "Register - Zakat Fitrah",
    layout: "layouts/main",
  });
});

// POST /auth/register - Process registration (only for development)
router.post("/register", async (req, res) => {
  // Only allow registration in development mode
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).send("Not Found");
  }

  const { name, nomor_wa, password, confirm_password, role } = req.body;

  try {
    // Input validation
    if (!name || !nomor_wa || !password || !confirm_password) {
      req.flash("error_msg", "Semua field harus diisi");
      return res.redirect("/auth/register");
    }

    if (password !== confirm_password) {
      req.flash("error_msg", "Password dan konfirmasi password tidak cocok");
      return res.redirect("/auth/register");
    }

    if (password.length < 6) {
      req.flash("error_msg", "Password minimal 6 karakter");
      return res.redirect("/auth/register");
    }

    // Check if nomor_wa already exists
    const db = req.app.locals.db;
    const [existingUsers] = await db.execute(
      "SELECT id FROM users WHERE nomor_wa = ?",
      [nomor_wa]
    );

    if (existingUsers.length > 0) {
      req.flash("error_msg", "Nomor WhatsApp sudah terdaftar");
      return res.redirect("/auth/register");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await db.execute(
      "INSERT INTO users (name, nomor_wa, password, role) VALUES (?, ?, ?, ?)",
      [name, nomor_wa, hashedPassword, role || "panitia"]
    );

    req.flash("success_msg", "Registrasi berhasil! Silakan login");
    res.redirect("/auth/login");
  } catch (error) {
    console.error("Registration error:", error);
    req.flash("error_msg", "Terjadi kesalahan saat registrasi");
    res.redirect("/auth/register");
  }
});

module.exports = router;
