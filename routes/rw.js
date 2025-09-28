const express = require("express");
const router = express.Router();

// GET /rw - Tampilkan daftar RW
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(`
      SELECT 
        rw.*,
        COUNT(DISTINCT rt.id) as total_rt,
        COUNT(DISTINCT m.id) as total_muzakki
      FROM rw 
      LEFT JOIN rt ON rw.id = rt.rw_id 
      LEFT JOIN muzakki m ON rt.id = m.rt_id 
      GROUP BY rw.id 
      ORDER BY rw.nomor_rw ASC
    `);

    res.render("rw/index", {
      title: "Data RW - Zakat Fitrah App",
      user: req.session.user,
      rwList: rows,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error fetching RW data:", error);
    req.flash("error", "Gagal mengambil data RW");
    res.redirect("/rw");
  }
});

// GET /rw/create - Form tambah RW
router.get("/create", (req, res) => {
  res.render("rw/create", {
    title: "Tambah RW - Zakat Fitrah App",
    user: req.session.user,
    error: req.flash("error"),
    success: req.flash("success"),
  });
});

// POST /rw/create - Simpan RW baru
router.post("/create", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { nomor_rw, ketua_rw, keterangan } = req.body;

    // Validasi input
    if (!nomor_rw || !ketua_rw) {
      req.flash("error", "Nomor RW dan Ketua RW harus diisi");
      return res.redirect("/rw/create");
    }

    // Cek apakah nomor RW sudah ada
    const [existing] = await db.execute(
      "SELECT id FROM rw WHERE nomor_rw = ?",
      [nomor_rw]
    );

    if (existing.length > 0) {
      req.flash("error", "Nomor RW sudah terdaftar");
      return res.redirect("/rw/create");
    }

    // Insert RW baru
    await db.execute(
      "INSERT INTO rw (nomor_rw, ketua_rw, keterangan) VALUES (?, ?, ?)",
      [nomor_rw, ketua_rw, keterangan || null]
    );

    req.flash("success", `RW ${nomor_rw} berhasil ditambahkan`);
    res.redirect("/rw");
  } catch (error) {
    console.error("Error creating RW:", error);
    req.flash("error", "Gagal menambahkan RW");
    res.redirect("/rw/create");
  }
});

// GET /rw/:id/edit - Form edit RW
router.get("/:id/edit", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute("SELECT * FROM rw WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      req.flash("error", "RW tidak ditemukan");
      return res.redirect("/rw");
    }

    res.render("rw/edit", {
      title: "Edit RW - Zakat Fitrah App",
      user: req.session.user,
      rw: rows[0],
      error: req.flash("error"),
      success: req.flash("success"),
    });
  } catch (error) {
    console.error("Error fetching RW for edit:", error);
    req.flash("error", "Gagal mengambil data RW");
    res.redirect("/rw");
  }
});

// POST /rw/:id/edit - Update RW
router.post("/:id/edit", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { nomor_rw, ketua_rw, keterangan } = req.body;

    // Validasi input
    if (!nomor_rw || !ketua_rw) {
      req.flash("error", "Nomor RW dan Ketua RW harus diisi");
      return res.redirect(`/rw/${req.params.id}/edit`);
    }

    // Cek apakah nomor RW sudah ada (kecuali untuk RW yang sedang diedit)
    const [existing] = await db.execute(
      "SELECT id FROM rw WHERE nomor_rw = ? AND id != ?",
      [nomor_rw, req.params.id]
    );

    if (existing.length > 0) {
      req.flash("error", "Nomor RW sudah terdaftar");
      return res.redirect(`/rw/${req.params.id}/edit`);
    }

    // Update RW
    await db.execute(
      "UPDATE rw SET nomor_rw = ?, ketua_rw = ?, keterangan = ? WHERE id = ?",
      [nomor_rw, ketua_rw, keterangan || null, req.params.id]
    );

    req.flash("success", `RW ${nomor_rw} berhasil diperbarui`);
    res.redirect("/rw");
  } catch (error) {
    console.error("Error updating RW:", error);
    req.flash("error", "Gagal memperbarui RW");
    res.redirect(`/rw/${req.params.id}/edit`);
  }
});

// POST /rw/:id/delete - Hapus RW
router.post("/:id/delete", async (req, res) => {
  try {
    const db = req.app.locals.db;
    // Cek apakah RW masih memiliki RT
    const [rt] = await db.execute(
      "SELECT COUNT(*) as count FROM rt WHERE rw_id = ?",
      [req.params.id]
    );

    if (rt[0].count > 0) {
      req.flash(
        "error",
        "RW tidak dapat dihapus karena masih memiliki data RT"
      );
      return res.redirect("/rw");
    }

    // Ambil data RW untuk pesan konfirmasi
    const [rwData] = await db.execute("SELECT nomor_rw FROM rw WHERE id = ?", [
      req.params.id,
    ]);

    if (rwData.length === 0) {
      req.flash("error", "RW tidak ditemukan");
      return res.redirect("/rw");
    }

    // Hapus RW
    await db.execute("DELETE FROM rw WHERE id = ?", [req.params.id]);

    req.flash("success", `RW ${rwData[0].nomor_rw} berhasil dihapus`);
    res.redirect("/rw");
  } catch (error) {
    console.error("Error deleting RW:", error);
    req.flash("error", "Gagal menghapus RW");
    res.redirect("/rw");
  }
});

// GET /rw/:id/detail - Detail RW dengan daftar RT
router.get("/:id/detail", async (req, res) => {
  try {
    const db = req.app.locals.db;
    // Ambil data RW
    const [rwData] = await db.execute("SELECT * FROM rw WHERE id = ?", [
      req.params.id,
    ]);

    if (rwData.length === 0) {
      req.flash("error", "RW tidak ditemukan");
      return res.redirect("/rw");
    }

    // Ambil daftar RT di RW ini
    const [rtData] = await db.execute(
      `
      SELECT 
        rt.*,
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
        END) as muzakki_lunas
      FROM rt 
      LEFT JOIN muzakki m ON rt.id = m.rt_id 
      WHERE rt.rw_id = ? 
      GROUP BY rt.id 
      ORDER BY rt.nomor_rt ASC
    `,
      [req.params.id]
    );

    // Hitung statistik
    const stats = {
      total_rt: rtData.length,
      total_muzakki: rtData.reduce((sum, rt) => sum + rt.total_muzakki, 0),
      total_zakat: rtData.reduce((sum, rt) => sum + parseFloat(rt.total_zakat || 0), 0),
      muzakki_lunas: rtData.reduce((sum, rt) => sum + rt.muzakki_lunas, 0),
    };

    res.render("rw/detail", {
      title: `Detail RW ${rwData[0].nomor_rw} - Zakat Fitrah App`,
      user: req.session.user,
      rw: rwData[0],
      rtList: rtData,
      stats: stats,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error fetching RW detail:", error);
    req.flash("error", "Gagal mengambil detail RW");
    res.redirect("/rw");
  }
});

module.exports = router;