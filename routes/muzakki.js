const express = require("express");
const router = express.Router();

// Constants for zakat calculation
const ZAKAT_BERAS_PER_JIWA = 2.5; // kg per jiwa
const ZAKAT_UANG_PER_JIWA = 45000; // Rp per jiwa

// GET /muzakki - List all muzakki
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get all muzakki with RT info and user info
    const [muzakki] = await db.execute(`
            SELECT 
                m.*,
                r.nomor_rt,
                r.ketua_rt,
                u.name as pencatat_name
            FROM muzakki m
            LEFT JOIN rt r ON m.rt_id = r.id
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
        `);

    res.render("muzakki/index", {
      title: "Data Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      muzakki,
    });
  } catch (error) {
    console.error("Error fetching muzakki:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil data muzakki");
    res.redirect("/");
  }
});

// GET /muzakki/create - Show create form
router.get("/create", async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get all RT for dropdown
    const [rtList] = await db.execute("SELECT * FROM rt ORDER BY nomor_rt");

    res.render("muzakki/create", {
      title: "Tambah Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      rtList,
    });
  } catch (error) {
    console.error("Error loading create form:", error);
    req.flash("error_msg", "Terjadi kesalahan saat memuat form");
    res.redirect("/muzakki");
  }
});

// POST /muzakki - Create new muzakki
router.post("/", async (req, res) => {
  const { rt_id, nama, jumlah_jiwa, jenis_zakat, jumlah_bayar, catatan } =
    req.body;

  try {
    // Input validation
    if (!rt_id || !nama || !jumlah_jiwa || !jenis_zakat || !jumlah_bayar) {
      req.flash("error_msg", "Semua field yang wajib harus diisi");
      return res.redirect("/muzakki/create");
    }

    const jiwa = parseInt(jumlah_jiwa);
    const bayar = parseFloat(jumlah_bayar);

    if (jiwa <= 0 || bayar <= 0) {
      req.flash("error_msg", "Jumlah jiwa dan jumlah bayar harus lebih dari 0");
      return res.redirect("/muzakki/create");
    }

    // Calculate kewajiban based on jenis zakat
    let jumlah_beras_kg = null;
    let jumlah_uang = null;
    let kewajiban = 0;

    if (jenis_zakat === "beras") {
      jumlah_beras_kg = jiwa * ZAKAT_BERAS_PER_JIWA;
      kewajiban = jumlah_beras_kg;
    } else if (jenis_zakat === "uang") {
      jumlah_uang = jiwa * ZAKAT_UANG_PER_JIWA;
      kewajiban = jumlah_uang;
    }

    // Calculate kembalian
    const kembalian = Math.max(0, bayar - kewajiban);

    const db = req.app.locals.db;
    const userId = req.session.user.id;

    // Insert muzakki
    const [result] = await db.execute(
      `
            INSERT INTO muzakki 
            (rt_id, nama, jumlah_jiwa, jenis_zakat, jumlah_beras_kg, jumlah_uang, jumlah_bayar, kembalian, catatan, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        rt_id,
        nama,
        jiwa,
        jenis_zakat,
        jumlah_beras_kg,
        jumlah_uang,
        bayar,
        kembalian,
        catatan,
        userId,
      ]
    );

    req.flash("success_msg", "Data muzakki berhasil ditambahkan");
    res.redirect("/muzakki");
  } catch (error) {
    console.error("Error creating muzakki:", error);
    req.flash("error_msg", "Terjadi kesalahan saat menyimpan data");
    res.redirect("/muzakki/create");
  }
});

// GET /muzakki/:id/edit - Show edit form
router.get("/:id/edit", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;

    // Get muzakki data
    const [muzakki] = await db.execute(
      `
            SELECT 
                m.*,
                r.nomor_rt,
                r.ketua_rt
            FROM muzakki m
            LEFT JOIN rt r ON m.rt_id = r.id
            WHERE m.id = ?
        `,
      [id]
    );

    if (muzakki.length === 0) {
      req.flash("error_msg", "Data muzakki tidak ditemukan");
      return res.redirect("/muzakki");
    }

    // Get all RT for dropdown
    const [rtList] = await db.execute("SELECT * FROM rt ORDER BY nomor_rt");

    res.render("muzakki/edit", {
      title: "Edit Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      muzakki: muzakki[0],
      rtList,
    });
  } catch (error) {
    console.error("Error loading edit form:", error);
    req.flash("error_msg", "Terjadi kesalahan saat memuat form");
    res.redirect("/muzakki");
  }
});

// PUT /muzakki/:id - Update muzakki
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { rt_id, nama, jumlah_jiwa, jenis_zakat, jumlah_bayar, catatan } =
    req.body;

  try {
    // Input validation
    if (!rt_id || !nama || !jumlah_jiwa || !jenis_zakat || !jumlah_bayar) {
      req.flash("error_msg", "Semua field yang wajib harus diisi");
      return res.redirect(`/muzakki/${id}/edit`);
    }

    const jiwa = parseInt(jumlah_jiwa);
    const bayar = parseFloat(jumlah_bayar);

    if (jiwa <= 0 || bayar <= 0) {
      req.flash("error_msg", "Jumlah jiwa dan jumlah bayar harus lebih dari 0");
      return res.redirect(`/muzakki/${id}/edit`);
    }

    // Calculate kewajiban based on jenis zakat
    let jumlah_beras_kg = null;
    let jumlah_uang = null;
    let kewajiban = 0;

    if (jenis_zakat === "beras") {
      jumlah_beras_kg = jiwa * ZAKAT_BERAS_PER_JIWA;
      kewajiban = jumlah_beras_kg;
    } else if (jenis_zakat === "uang") {
      jumlah_uang = jiwa * ZAKAT_UANG_PER_JIWA;
      kewajiban = jumlah_uang;
    }

    // Calculate kembalian
    const kembalian = Math.max(0, bayar - kewajiban);

    const db = req.app.locals.db;

    // Update muzakki
    await db.execute(
      `
            UPDATE muzakki 
            SET rt_id = ?, nama = ?, jumlah_jiwa = ?, jenis_zakat = ?, 
                jumlah_beras_kg = ?, jumlah_uang = ?, jumlah_bayar = ?, 
                kembalian = ?, catatan = ?
            WHERE id = ?
        `,
      [
        rt_id,
        nama,
        jiwa,
        jenis_zakat,
        jumlah_beras_kg,
        jumlah_uang,
        bayar,
        kembalian,
        catatan,
        id,
      ]
    );

    req.flash("success_msg", "Data muzakki berhasil diupdate");
    res.redirect("/muzakki");
  } catch (error) {
    console.error("Error updating muzakki:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengupdate data");
    res.redirect(`/muzakki/${id}/edit`);
  }
});

// DELETE /muzakki/:id - Delete muzakki
router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const db = req.app.locals.db;

    // Check if muzakki exists
    const [muzakki] = await db.execute("SELECT * FROM muzakki WHERE id = ?", [
      id,
    ]);

    if (muzakki.length === 0) {
      req.flash("error_msg", "Data muzakki tidak ditemukan");
      return res.redirect("/muzakki");
    }

    // Delete related infak records first
    await db.execute("DELETE FROM infak WHERE muzakki_id = ?", [id]);

    // Delete muzakki
    await db.execute("DELETE FROM muzakki WHERE id = ?", [id]);

    req.flash("success_msg", "Data muzakki berhasil dihapus");
    res.redirect("/muzakki");
  } catch (error) {
    console.error("Error deleting muzakki:", error);
    req.flash("error_msg", "Terjadi kesalahan saat menghapus data");
    res.redirect("/muzakki");
  }
});

// POST /muzakki/:id/sedekahkan-kembalian - Sedekahkan kembalian sebagai infak
router.post("/:id/sedekahkan-kembalian", async (req, res) => {
  const id = req.params.id;

  try {
    const db = req.app.locals.db;

    // Get muzakki data
    const [muzakki] = await db.execute("SELECT * FROM muzakki WHERE id = ?", [
      id,
    ]);

    if (muzakki.length === 0) {
      req.flash("error_msg", "Data muzakki tidak ditemukan");
      return res.redirect("/muzakki");
    }

    const muzakkiData = muzakki[0];

    if (muzakkiData.kembalian <= 0) {
      req.flash("error_msg", "Tidak ada kembalian untuk disedekahkan");
      return res.redirect("/muzakki");
    }

    // Insert infak
    await db.execute(
      `
            INSERT INTO infak (muzakki_id, jumlah, keterangan)
            VALUES (?, ?, ?)
        `,
      [id, muzakkiData.kembalian, "Kembalian dari zakat fitrah"]
    );

    // Reset kembalian to 0
    await db.execute("UPDATE muzakki SET kembalian = 0 WHERE id = ?", [id]);

    req.flash(
      "success_msg",
      `Kembalian Rp ${muzakkiData.kembalian.toLocaleString(
        "id-ID"
      )} berhasil disedekahkan sebagai infak`
    );
    res.redirect("/muzakki");
  } catch (error) {
    console.error("Error sedekahkan kembalian:", error);
    req.flash("error_msg", "Terjadi kesalahan saat menyedekahkan kembalian");
    res.redirect("/muzakki");
  }
});

// GET /muzakki/:id - Show detail muzakki
router.get("/:id", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;

    // Get muzakki data with RT and user info
    const [muzakki] = await db.execute(
      `
            SELECT 
                m.*,
                r.nomor_rt,
                r.ketua_rt,
                u.name as pencatat_name
            FROM muzakki m
            LEFT JOIN rt r ON m.rt_id = r.id
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
        `,
      [id]
    );

    if (muzakki.length === 0) {
      req.flash("error_msg", "Data muzakki tidak ditemukan");
      return res.redirect("/muzakki");
    }

    res.render("muzakki/detail", {
      title: "Detail Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      muzakki: muzakki[0],
    });
  } catch (error) {
    console.error("Error fetching muzakki detail:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil detail muzakki");
    res.redirect("/muzakki");
  }
});

module.exports = router;
