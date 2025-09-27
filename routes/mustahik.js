const express = require("express");
const router = express.Router();

// Middleware untuk auth
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/auth/login");
}

// Apply auth middleware to all routes
router.use(isAuthenticated);

// Get all mustahik
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get mustahik with RT info
    const [mustahik] = await db.execute(`
      SELECT m.*, r.nomor_rt as rt_nama 
      FROM mustahik m 
      LEFT JOIN rt r ON m.rt_id = r.id 
      ORDER BY m.created_at DESC
    `);

    // Get RT list for filter
    const [rtList] = await db.execute("SELECT * FROM rt ORDER BY nomor_rt");

    res.render("mustahik/index", {
      title: "Data Mustahik - Zakat Fitrah App",
      user: req.session.user,
      mustahik,
      rtList,
      currentPage: "mustahik",
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error fetching mustahik:", error);
    req.flash("error", "Gagal mengambil data mustahik");
    res.redirect("/dashboard");
  }
});

// Show create form
router.get("/create", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rtList] = await db.execute("SELECT * FROM rt ORDER BY nomor_rt");

    res.render("mustahik/create", {
      title: "Tambah Mustahik - Zakat Fitrah App",
      user: req.session.user,
      rtList,
      currentPage: "mustahik",
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error loading create form:", error);
    req.flash("error", "Gagal memuat form tambah mustahik");
    res.redirect("/mustahik");
  }
});

// Create new mustahik
router.post("/create", async (req, res) => {
  try {
    const { rt_id, nama, kategori } = req.body;

    // Validation
    if (!nama || !kategori) {
      req.flash("error", "Nama dan kategori harus diisi");
      return res.redirect("/mustahik/create");
    }

    const db = req.app.locals.db;

    // Insert mustahik
    await db.execute(
      "INSERT INTO mustahik (rt_id, nama, kategori) VALUES (?, ?, ?)",
      [rt_id || null, nama, kategori]
    );

    req.flash("success", "Data mustahik berhasil ditambahkan");
    res.redirect("/mustahik");
  } catch (error) {
    console.error("Error creating mustahik:", error);
    req.flash("error", "Gagal menambahkan data mustahik");
    res.redirect("/mustahik/create");
  }
});

// Show edit form
router.get("/edit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    // Get mustahik data
    const [mustahik] = await db.execute("SELECT * FROM mustahik WHERE id = ?", [
      id,
    ]);
    if (mustahik.length === 0) {
      req.flash("error", "Data mustahik tidak ditemukan");
      return res.redirect("/mustahik");
    }

    // Get RT list
    const [rtList] = await db.execute("SELECT * FROM rt ORDER BY nomor_rt");

    res.render("mustahik/edit", {
      title: "Edit Mustahik - Zakat Fitrah App",
      user: req.session.user,
      mustahik: mustahik[0],
      rtList,
      currentPage: "mustahik",
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error loading edit form:", error);
    req.flash("error", "Gagal memuat form edit mustahik");
    res.redirect("/mustahik");
  }
});

// Update mustahik
router.put("/edit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rt_id, nama, kategori } = req.body;

    // Validation
    if (!nama || !kategori) {
      req.flash("error", "Nama dan kategori harus diisi");
      return res.redirect(`/mustahik/edit/${id}`);
    }

    const db = req.app.locals.db;

    // Update mustahik
    await db.execute(
      "UPDATE mustahik SET rt_id = ?, nama = ?, kategori = ? WHERE id = ?",
      [rt_id || null, nama, kategori, id]
    );

    req.flash("success", "Data mustahik berhasil diperbarui");
    res.redirect("/mustahik");
  } catch (error) {
    console.error("Error updating mustahik:", error);
    req.flash("error", "Gagal memperbarui data mustahik");
    res.redirect(`/mustahik/edit/${req.params.id}`);
  }
});

// Delete mustahik
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    // Check if mustahik has distributions
    const [distributions] = await db.execute(
      "SELECT COUNT(*) as count FROM distribusi_zakat WHERE mustahik_id = ?",
      [id]
    );

    if (distributions[0].count > 0) {
      req.flash(
        "error",
        "Tidak dapat menghapus mustahik yang sudah memiliki data distribusi zakat"
      );
      return res.redirect("/mustahik");
    }

    // Delete mustahik
    await db.execute("DELETE FROM mustahik WHERE id = ?", [id]);

    req.flash("success", "Data mustahik berhasil dihapus");
    res.redirect("/mustahik");
  } catch (error) {
    console.error("Error deleting mustahik:", error);
    req.flash("error", "Gagal menghapus data mustahik");
    res.redirect("/mustahik");
  }
});

// Show mustahik detail
router.get("/detail/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    // Get mustahik with RT info
    const [mustahik] = await db.execute(
      `
      SELECT m.*, r.nomor_rt as rt_nama 
      FROM mustahik m 
      LEFT JOIN rt r ON m.rt_id = r.id 
      WHERE m.id = ?
    `,
      [id]
    );

    if (mustahik.length === 0) {
      req.flash("error", "Data mustahik tidak ditemukan");
      return res.redirect("/mustahik");
    }

    // Get distribution history
    const [distributions] = await db.execute(
      `
      SELECT dz.*, u.name as user_nama
      FROM distribusi_zakat dz
      LEFT JOIN users u ON dz.user_id = u.id
      WHERE dz.mustahik_id = ?
      ORDER BY dz.created_at DESC
    `,
      [id]
    );

    res.render("mustahik/detail", {
      title: `Detail ${mustahik[0].nama} - Zakat Fitrah App`,
      user: req.session.user,
      mustahik: mustahik[0],
      distributions,
      currentPage: "mustahik",
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error fetching mustahik detail:", error);
    req.flash("error", "Gagal mengambil detail mustahik");
    res.redirect("/mustahik");
  }
});

module.exports = router;
