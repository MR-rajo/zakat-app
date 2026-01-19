const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

// GET - List all users
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const [users] = await db.execute(`
      SELECT id, name, nomor_wa, role, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.render("users/index", {
      title: "Manajemen User - Zakat Fitrah",
      layout: "layouts/main",
      currentPage: "users",
      user: req.session.user,
      users: users,
      success: req.flash("success_msg"),
      error: req.flash("error_msg")
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    req.flash("error_msg", "Gagal mengambil data user");
    res.redirect("/dashboard");
  }
});

// POST - Create new user
router.post("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, nomor_wa, role, password } = req.body;

    // Validation
    if (!name || !nomor_wa || !role || !password) {
      req.flash("error_msg", "Semua field wajib diisi");
      return res.redirect("/users");
    }

    if (password.length < 6) {
      req.flash("error_msg", "Password minimal 6 karakter");
      return res.redirect("/users");
    }

    // Check if nomor_wa already exists
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE nomor_wa = ?",
      [nomor_wa]
    );

    if (existing.length > 0) {
      req.flash("error_msg", "Nomor WhatsApp sudah terdaftar");
      return res.redirect("/users");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await db.execute(
      "INSERT INTO users (name, nomor_wa, password, role) VALUES (?, ?, ?, ?)",
      [name, nomor_wa, hashedPassword, role]
    );

    req.flash("success_msg", "User berhasil ditambahkan");
    res.redirect("/users");
  } catch (error) {
    console.error("Error creating user:", error);
    req.flash("error_msg", "Gagal menambahkan user: " + error.message);
    res.redirect("/users");
  }
});

// PUT - Update user
router.put("/:id", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { name, nomor_wa, role, password } = req.body;

    // Validation
    if (!name || !nomor_wa || !role) {
      req.flash("error_msg", "Nama, nomor WA, dan role wajib diisi");
      return res.redirect("/users");
    }

    // Check if nomor_wa already exists for other users
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE nomor_wa = ? AND id != ?",
      [nomor_wa, id]
    );

    if (existing.length > 0) {
      req.flash("error_msg", "Nomor WhatsApp sudah digunakan user lain");
      return res.redirect("/users");
    }

    // Update user
    if (password && password.length >= 6) {
      // Update with new password
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.execute(
        "UPDATE users SET name = ?, nomor_wa = ?, role = ?, password = ? WHERE id = ?",
        [name, nomor_wa, role, hashedPassword, id]
      );
    } else {
      // Update without changing password
      await db.execute(
        "UPDATE users SET name = ?, nomor_wa = ?, role = ? WHERE id = ?",
        [name, nomor_wa, role, id]
      );
    }

    req.flash("success_msg", "User berhasil diupdate");
    res.redirect("/users");
  } catch (error) {
    console.error("Error updating user:", error);
    req.flash("error_msg", "Gagal mengupdate user: " + error.message);
    res.redirect("/users");
  }
});

// DELETE - Delete user
router.delete("/:id", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    // Prevent deleting current user
    if (req.session.user.id === parseInt(id)) {
      req.flash("error_msg", "Tidak dapat menghapus user yang sedang login");
      return res.redirect("/users");
    }

    // Check if user exists
    const [user] = await db.execute("SELECT id FROM users WHERE id = ?", [id]);
    
    if (user.length === 0) {
      req.flash("error_msg", "User tidak ditemukan");
      return res.redirect("/users");
    }

    // Delete user
    await db.execute("DELETE FROM users WHERE id = ?", [id]);

    req.flash("success_msg", "User berhasil dihapus");
    res.redirect("/users");
  } catch (error) {
    console.error("Error deleting user:", error);
    req.flash("error_msg", "Gagal menghapus user: " + error.message);
    res.redirect("/users");
  }
});

// POST - Reset password
router.post("/:id/reset-password", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    // Default password
    const defaultPassword = "123456";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await db.execute(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedPassword, id]
    );

    res.json({
      success: true,
      message: "Password berhasil direset ke default (123456)"
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Gagal reset password: " + error.message
    });
  }
});

module.exports = router;
