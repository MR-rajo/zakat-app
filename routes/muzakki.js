const express = require("express");
const router = express.Router();

// Constants for zakat calculation
const ZAKAT_BERAS_PER_JIWA = 2.5; // kg per jiwa
const ZAKAT_UANG_PER_JIWA = 45000; // Rp per jiwa

// GET /muzakki - List all muzakki grouped by RT
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get RT data with aggregated muzakki information
    const [rtData] = await db.execute(`
            SELECT 
                r.id as rt_id,
                r.nomor_rt,
                r.ketua_rt,
                COUNT(DISTINCT m.id) as total_muzakki,
                SUM(m.jumlah_jiwa) as total_jiwa,
                SUM(CASE WHEN m.jenis_zakat = 'beras' THEN m.jumlah_beras_kg ELSE 0 END) as total_beras,
                SUM(CASE WHEN m.jenis_zakat = 'uang' THEN m.jumlah_bayar ELSE 0 END) as total_uang,
                SUM(m.kembalian) as total_kembalian,
                COUNT(DISTINCT md.id) as total_nama_muzakki
            FROM rt r
            LEFT JOIN muzakki m ON r.id = m.rt_id
            LEFT JOIN muzakki_details md ON m.id = md.muzakki_id
            GROUP BY r.id, r.nomor_rt, r.ketua_rt
            ORDER BY r.nomor_rt
        `);

    // Get overall statistics
    const [stats] = await db.execute(`
            SELECT 
                COUNT(DISTINCT m.id) as total_muzakki_records,
                SUM(m.jumlah_jiwa) as total_jiwa_all,
                SUM(CASE WHEN m.jenis_zakat = 'beras' THEN m.jumlah_beras_kg ELSE 0 END) as total_beras_all,
                SUM(CASE WHEN m.jenis_zakat = 'uang' THEN m.jumlah_bayar ELSE 0 END) as total_uang_all,
                SUM(m.kembalian) as total_kembalian_all,
                COUNT(DISTINCT md.id) as total_nama_muzakki_all
            FROM muzakki m
            LEFT JOIN muzakki_details md ON m.id = md.muzakki_id
        `);

    res.render("muzakki/index", {
      title: "Data Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      rtData,
      stats: stats[0] || {},
    });
  } catch (error) {
    console.error("Error fetching muzakki:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil data muzakki");
    res.redirect("/");
  }
});

// GET /muzakki/rt/:rt_id - Show detail muzakki for specific RT
router.get("/rt/:rt_id", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const rtId = req.params.rt_id;

    // Get RT info
    const [rtInfo] = await db.execute("SELECT * FROM rt WHERE id = ?", [rtId]);

    if (rtInfo.length === 0) {
      req.flash("error_msg", "Data RT tidak ditemukan");
      return res.redirect("/muzakki");
    }

    // Get all muzakki for this RT
    const [muzakki] = await db.execute(
      `
      SELECT 
        m.*,
        u.name as pencatat_name,
        GROUP_CONCAT(md.nama_muzakki SEPARATOR ', ') as nama_muzakki_list,
        COUNT(md.id) as jumlah_muzakki
      FROM muzakki m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN muzakki_details md ON m.id = md.muzakki_id
      WHERE m.rt_id = ?
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `,
      [rtId]
    );

    res.render("muzakki/rt-detail", {
      title: `Detail Muzakki RT ${rtInfo[0].nomor_rt} - Zakat Fitrah`,
      layout: "layouts/main",
      rt: rtInfo[0],
      muzakki,
    });
  } catch (error) {
    console.error("Error fetching RT detail:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil detail RT");
    res.redirect("/muzakki");
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
  const { rt_id, muzakki, jumlah_jiwa, jenis_zakat, jumlah_bayar, catatan } =
    req.body;

  try {
    // Debug log untuk melihat data yang diterima
    console.log("Received data:", {
      rt_id,
      muzakki,
      jumlah_jiwa,
      jenis_zakat,
      jumlah_bayar,
      catatan,
    });

    // Input validation
    if (!rt_id || !jumlah_jiwa || !jenis_zakat || !jumlah_bayar) {
      req.flash("error_msg", "Semua field yang wajib harus diisi");
      return res.redirect("/muzakki/create");
    }

    // Validate muzakki array - check if it's an object instead of array
    let muzakkiArray = [];
    if (muzakki) {
      if (Array.isArray(muzakki)) {
        muzakkiArray = muzakki;
      } else if (typeof muzakki === "object") {
        // Convert object to array
        muzakkiArray = Object.values(muzakki);
      }
    }

    console.log("Processed muzakkiArray:", muzakkiArray);

    if (!muzakkiArray || muzakkiArray.length === 0) {
      req.flash("error_msg", "Minimal harus ada satu data muzakki");
      return res.redirect("/muzakki/create");
    }

    // Validate each muzakki has nama
    for (let i = 0; i < muzakkiArray.length; i++) {
      if (
        !muzakkiArray[i] ||
        !muzakkiArray[i].nama ||
        !muzakkiArray[i].nama.trim()
      ) {
        req.flash("error_msg", `Nama muzakki #${i + 1} tidak boleh kosong`);
        return res.redirect("/muzakki/create");
      }
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
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
      req.flash("error_msg", "Session tidak valid. Silakan login kembali.");
      return res.redirect("/auth/login");
    }

    console.log("About to start transaction with data:", {
      rt_id,
      jiwa,
      jenis_zakat,
      jumlah_beras_kg,
      jumlah_uang,
      bayar,
      kembalian,
      catatan,
      userId,
      muzakkiCount: muzakkiArray.length,
    });

    // Begin transaction
    await db.query("START TRANSACTION");

    try {
      // Insert main muzakki record (without nama)
      const [result] = await db.execute(
        `
        INSERT INTO muzakki 
        (rt_id, jumlah_jiwa, jenis_zakat, jumlah_beras_kg, jumlah_uang, jumlah_bayar, kembalian, catatan, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          rt_id,
          jiwa,
          jenis_zakat,
          jumlah_beras_kg,
          jumlah_uang,
          bayar,
          kembalian,
          catatan || null,
          userId,
        ]
      );

      const muzakkiId = result.insertId;
      console.log("Inserted muzakki with ID:", muzakkiId);

      // Insert muzakki details for each individual
      for (let i = 0; i < muzakkiArray.length; i++) {
        const muzakkiData = muzakkiArray[i];
        console.log(`Inserting muzakki detail ${i + 1}:`, muzakkiData);

        await db.execute(
          `
          INSERT INTO muzakki_details 
          (muzakki_id, nama_muzakki, bin_binti, nama_orang_tua)
          VALUES (?, ?, ?, ?)
          `,
          [
            muzakkiId,
            muzakkiData.nama.trim(),
            muzakkiData.bin_binti || null,
            muzakkiData.nama_orang_tua || null,
          ]
        );
      }

      // Generate infak from kembalian if exists
      if (kembalian > 0) {
        console.log("Inserting infak with kembalian:", kembalian);
        await db.execute(
          `
          INSERT INTO infak (muzakki_id, jumlah, keterangan)
          VALUES (?, ?, ?)
          `,
          [muzakkiId, kembalian, "Kembalian zakat fitrah"]
        );
      }

      // Commit transaction
      await db.query("COMMIT");
      console.log("Transaction committed successfully");

      req.flash(
        "success_msg",
        `Data muzakki berhasil ditambahkan dengan ${muzakkiArray.length} orang muzakki`
      );
      res.redirect("/muzakki");
    } catch (error) {
      // Rollback on error
      await db.query("ROLLBACK");
      console.error("Error in transaction:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error creating muzakki:", error);
    req.flash(
      "error_msg",
      `Terjadi kesalahan saat menyimpan data muzakki: ${error.message}`
    );
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

    // Get muzakki details
    const [muzakkiDetails] = await db.execute(
      "SELECT * FROM muzakki_details WHERE muzakki_id = ? ORDER BY id",
      [id]
    );

    // Get all RT for dropdown
    const [rtList] = await db.execute("SELECT * FROM rt ORDER BY nomor_rt");

    res.render("muzakki/edit", {
      title: "Edit Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      muzakki: muzakki[0],
      muzakkiDetails: muzakkiDetails, // Pass all details
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
  const { rt_id, muzakki, jumlah_jiwa, jenis_zakat, jumlah_bayar, catatan } =
    req.body;

  try {
    // Input validation
    if (!rt_id || !jumlah_jiwa || !jenis_zakat || !jumlah_bayar) {
      req.flash("error_msg", "Semua field yang wajib harus diisi");
      return res.redirect(`/muzakki/${id}/edit`);
    }

    // Validate muzakki array
    if (!muzakki || !Array.isArray(muzakki) || muzakki.length === 0) {
      req.flash("error_msg", "Minimal harus ada satu data muzakki");
      return res.redirect(`/muzakki/${id}/edit`);
    }

    // Validate each muzakki has nama
    for (let i = 0; i < muzakki.length; i++) {
      if (!muzakki[i].nama || !muzakki[i].nama.trim()) {
        req.flash("error_msg", `Nama muzakki #${i + 1} tidak boleh kosong`);
        return res.redirect(`/muzakki/${id}/edit`);
      }
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

    // Begin transaction
    await db.query("START TRANSACTION");

    try {
      // Update muzakki main record
      await db.execute(
        `
        UPDATE muzakki 
        SET rt_id = ?, jumlah_jiwa = ?, jenis_zakat = ?, 
            jumlah_beras_kg = ?, jumlah_uang = ?, jumlah_bayar = ?, 
            kembalian = ?, catatan = ?
        WHERE id = ?
        `,
        [
          rt_id,
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

      // Delete existing muzakki details
      await db.execute("DELETE FROM muzakki_details WHERE muzakki_id = ?", [
        id,
      ]);

      // Insert new muzakki details
      for (let i = 0; i < muzakki.length; i++) {
        const muzakkiData = muzakki[i];

        await db.execute(
          `
          INSERT INTO muzakki_details 
          (muzakki_id, nama_muzakki, bin_binti, nama_orang_tua)
          VALUES (?, ?, ?, ?)
          `,
          [
            id,
            muzakkiData.nama.trim(),
            muzakkiData.bin_binti || null,
            muzakkiData.nama_orang_tua || null,
          ]
        );
      }

      // Update infak if kembalian changed
      const [existingInfak] = await db.execute(
        "SELECT id FROM infak WHERE muzakki_id = ? AND keterangan = 'Kembalian zakat fitrah'",
        [id]
      );

      if (kembalian > 0) {
        if (existingInfak.length > 0) {
          // Update existing infak
          await db.execute(
            "UPDATE infak SET jumlah = ? WHERE muzakki_id = ? AND keterangan = 'Kembalian zakat fitrah'",
            [kembalian, id]
          );
        } else {
          // Insert new infak
          await db.execute(
            `
            INSERT INTO infak (muzakki_id, jumlah, keterangan)
            VALUES (?, ?, ?)
            `,
            [id, kembalian, "Kembalian zakat fitrah"]
          );
        }
      } else if (existingInfak.length > 0) {
        // Delete infak if no kembalian
        await db.execute(
          "DELETE FROM infak WHERE muzakki_id = ? AND keterangan = 'Kembalian zakat fitrah'",
          [id]
        );
      }

      // Commit transaction
      await db.query("COMMIT");

      req.flash(
        "success_msg",
        `Data muzakki berhasil diupdate dengan ${muzakki.length} orang muzakki`
      );
      res.redirect("/muzakki");
    } catch (error) {
      // Rollback transaction on error
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error updating muzakki:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengupdate data muzakki");
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

    // Get muzakki details
    const [muzakkiDetails] = await db.execute(
      "SELECT * FROM muzakki_details WHERE muzakki_id = ? ORDER BY id",
      [id]
    );

    res.render("muzakki/detail", {
      title: "Detail Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      muzakki: muzakki[0],
      muzakkiDetails: muzakkiDetails,
    });
  } catch (error) {
    console.error("Error fetching muzakki detail:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil detail muzakki");
    res.redirect("/muzakki");
  }
});

module.exports = router;
