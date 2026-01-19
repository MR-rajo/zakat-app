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
        COALESCE(COUNT(md.id), 0) as jumlah_muzakki,
        MAX(i.id) as infak_id
      FROM muzakki m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN muzakki_details md ON m.id = md.muzakki_id
      LEFT JOIN infak i ON m.id = i.muzakki_id
      WHERE m.rt_id = ?
      GROUP BY m.id, u.name
      ORDER BY m.created_at DESC
    `,
      [rtId]
    );

    // Debug: Log data untuk troubleshooting
    console.log('=== RT DETAIL DEBUG ===');
    console.log('RT ID:', rtId);
    console.log('Total muzakki:', muzakki.length);
    muzakki.forEach((m, idx) => {
      console.log(`Muzakki ${idx + 1}:`, {
        id: m.id,
        nama: m.nama_muzakki_list,
        kembalian: m.kembalian,
        infak_id: m.infak_id,
        jumlah_bayar: m.jumlah_bayar
      });
    });

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
    
    // Get all master_zakat for dropdown
    const [masterZakatList] = await db.execute(
      "SELECT id, nama, harga, kg FROM master_zakat ORDER BY nama"
    );

    res.render("muzakki/create", {
      title: "Tambah Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      rtList,
      masterZakatList,
    });
  } catch (error) {
    console.error("Error loading create form:", error);
    req.flash("error_msg", "Terjadi kesalahan saat memuat form");
    res.redirect("/muzakki");
  }
});

// POST /muzakki - Create new muzakki
router.post("/", async (req, res) => {
  const { rt_id, muzakki, jumlah_jiwa, master_zakat_id, jumlah_bayar, catatan } =
    req.body;

  try {
    // Debug log untuk melihat data yang diterima
    console.log("Received data:", {
      rt_id,
      muzakki,
      jumlah_jiwa,
      master_zakat_id,
      jumlah_bayar,
      catatan,
    });

    // Input validation
    if (!rt_id || !jumlah_jiwa || !master_zakat_id || !jumlah_bayar) {
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

    const db = req.app.locals.db;
    
    // Get master_zakat data
    const [masterZakat] = await db.execute(
      "SELECT * FROM master_zakat WHERE id = ?",
      [master_zakat_id]
    );
    
    if (masterZakat.length === 0) {
      req.flash("error_msg", "Jenis zakat tidak valid");
      return res.redirect("/muzakki/create");
    }
    
    const zakatData = masterZakat[0];
    const jenis_zakat = zakatData.kg > 0 ? 'beras' : 'uang';
    
    // Calculate kewajiban based on master_zakat data
    let jumlah_beras_kg = null;
    let jumlah_uang = null;
    let kewajiban = 0;

    if (jenis_zakat === "beras") {
      jumlah_beras_kg = jiwa * parseFloat(zakatData.kg);
      kewajiban = jiwa * parseFloat(zakatData.harga); // Kewajiban dalam rupiah
    } else if (jenis_zakat === "uang") {
      jumlah_uang = jiwa * parseFloat(zakatData.harga);
      kewajiban = jumlah_uang;
    }

    // Calculate kembalian
    const kembalian = Math.max(0, bayar - kewajiban);
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
        (rt_id, jumlah_jiwa, jenis_zakat, jumlah_beras_kg, jumlah_uang, jumlah_bayar, kembalian, catatan, user_id, master_zakat_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          master_zakat_id,
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
    
    // Get all master_zakat for dropdown
    const [masterZakatList] = await db.execute(
      "SELECT id, nama, harga, kg FROM master_zakat ORDER BY nama"
    );

    res.render("muzakki/edit", {
      title: "Edit Muzakki - Zakat Fitrah",
      layout: "layouts/main",
      muzakki: muzakki[0],
      muzakkiDetails: muzakkiDetails, // Pass all details
      rtList,
      masterZakatList,
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
  const { rt_id, muzakki, jumlah_jiwa, master_zakat_id, jumlah_bayar, catatan } =
    req.body;

  try {
    // Input validation
    if (!rt_id || !jumlah_jiwa || !master_zakat_id || !jumlah_bayar) {
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

    const db = req.app.locals.db;
    
    // Get master_zakat data
    const [masterZakat] = await db.execute(
      "SELECT * FROM master_zakat WHERE id = ?",
      [master_zakat_id]
    );
    
    if (masterZakat.length === 0) {
      req.flash("error_msg", "Jenis zakat tidak valid");
      return res.redirect(`/muzakki/${id}/edit`);
    }
    
    const zakatData = masterZakat[0];
    const jenis_zakat = zakatData.kg > 0 ? 'beras' : 'uang';
    
    // Calculate kewajiban based on master_zakat data
    let jumlah_beras_kg = null;
    let jumlah_uang = null;
    let kewajiban = 0;

    if (jenis_zakat === "beras") {
      jumlah_beras_kg = jiwa * parseFloat(zakatData.kg);
      kewajiban = jiwa * parseFloat(zakatData.harga);
    } else if (jenis_zakat === "uang") {
      jumlah_uang = jiwa * parseFloat(zakatData.harga);
      kewajiban = jumlah_uang;
    }

    // Calculate kembalian
    const kembalian = Math.max(0, bayar - kewajiban);

    // Begin transaction
    await db.query("START TRANSACTION");

    try {
      // Update muzakki main record
      await db.execute(
        `
        UPDATE muzakki 
        SET rt_id = ?, jumlah_jiwa = ?, jenis_zakat = ?, 
            jumlah_beras_kg = ?, jumlah_uang = ?, jumlah_bayar = ?, 
            kembalian = ?, catatan = ?, master_zakat_id = ?
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
          master_zakat_id,
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

// POST /muzakki/rt/:rtId/batch-infak - Batch insert infak dari kembalian
router.post("/rt/:rtId/batch-infak", async (req, res) => {
  const rtId = req.params.rtId;
  const { muzakki_ids } = req.body;

  try {
    const db = req.app.locals.db;

    // Validate input
    if (!muzakki_ids || muzakki_ids.length === 0) {
      req.flash("error_msg", "Pilih minimal 1 muzakki untuk ditambahkan sebagai infak");
      return res.redirect(`/muzakki/rt/${rtId}`);
    }

    // Ensure muzakki_ids is array
    const ids = Array.isArray(muzakki_ids) ? muzakki_ids : [muzakki_ids];
    
    let successCount = 0;
    let totalInfak = 0;
    const errors = [];

    // Process each muzakki
    for (const muzakkiId of ids) {
      try {
        // Get muzakki data
        const [muzakki] = await db.execute(
          "SELECT * FROM muzakki WHERE id = ? AND rt_id = ?",
          [muzakkiId, rtId]
        );

        if (muzakki.length === 0) {
          errors.push(`Muzakki ID ${muzakkiId} tidak ditemukan`);
          continue;
        }

        const muzakkiData = muzakki[0];

        // Check if already has infak
        const [existingInfak] = await db.execute(
          "SELECT id FROM infak WHERE muzakki_id = ?",
          [muzakkiId]
        );

        if (existingInfak.length > 0) {
          errors.push(`Muzakki ${muzakkiData.nama_muzakki_list || muzakkiId} sudah memiliki infak`);
          continue;
        }

        if (muzakkiData.kembalian <= 0) {
          errors.push(`Muzakki ${muzakkiData.nama_muzakki_list || muzakkiId} tidak memiliki kembalian`);
          continue;
        }

        // Get keterangan for this muzakki
        const keterangan = req.body[`keterangan_${muzakkiId}`] || "Kembalian dari zakat fitrah";

        // Insert infak
        await db.execute(
          `INSERT INTO infak (muzakki_id, jumlah, keterangan) VALUES (?, ?, ?)`,
          [muzakkiId, muzakkiData.kembalian, keterangan]
        );

        // Reset kembalian to 0
        await db.execute("UPDATE muzakki SET kembalian = 0 WHERE id = ?", [muzakkiId]);

        successCount++;
        totalInfak += muzakkiData.kembalian;
      } catch (err) {
        console.error(`Error processing muzakki ${muzakkiId}:`, err);
        errors.push(`Error pada muzakki ID ${muzakkiId}`);
      }
    }

    // Show results
    if (successCount > 0) {
      req.flash(
        "success_msg",
        `Berhasil menambahkan ${successCount} infak dengan total Rp ${totalInfak.toLocaleString("id-ID")}`
      );
    }

    if (errors.length > 0) {
      req.flash("error_msg", errors.join(", "));
    }

    res.redirect(`/muzakki/rt/${rtId}`);
  } catch (error) {
    console.error("Error batch infak:", error);
    req.flash("error_msg", "Terjadi kesalahan saat menambahkan infak");
    res.redirect(`/muzakki/rt/${rtId}`);
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

// ========================================
// API Routes for Master Zakat CRUD
// ========================================

// GET /api/master-zakat - Get all master zakat
router.get("/api/master-zakat", async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const [masterZakat] = await db.execute(
      `SELECT id, nama, harga, kg, created_at, updated_at 
       FROM master_zakat 
       ORDER BY id ASC`
    );

    res.json({
      success: true,
      data: masterZakat
    });
  } catch (error) {
    console.error("Error fetching master zakat:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data master zakat"
    });
  }
});

// POST /api/master-zakat - Create new master zakat
router.post("/api/master-zakat", async (req, res) => {
  const { nama, harga, kg } = req.body;

  try {
    // Validation
    if (!nama || nama.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Nama jenis zakat harus diisi"
      });
    }

    if (harga === undefined || harga === null || harga === '' || parseFloat(harga) < 0) {
      return res.status(400).json({
        success: false,
        message: "Harga tidak boleh kosong atau kurang dari 0"
      });
    }

    const db = req.app.locals.db;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Session tidak valid. Silakan login kembali."
      });
    }

    // Insert to database
    const [result] = await db.execute(
      `INSERT INTO master_zakat (nama, harga, kg, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [nama.trim(), parseFloat(harga), parseFloat(kg) || 0, userId, userId]
    );

    res.json({
      success: true,
      message: "Data jenis zakat berhasil ditambahkan",
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error("Error creating master zakat:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menyimpan data: " + error.message
    });
  }
});

// PUT /api/master-zakat/:id - Update master zakat
router.put("/api/master-zakat/:id", async (req, res) => {
  const { id } = req.params;
  const { nama, harga, kg } = req.body;

  try {
    // Validation
    if (!nama || nama.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Nama jenis zakat harus diisi"
      });
    }

    if (harga === undefined || harga === null || harga === '' || parseFloat(harga) < 0) {
      return res.status(400).json({
        success: false,
        message: "Harga tidak boleh kosong atau kurang dari 0"
      });
    }

    const db = req.app.locals.db;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Session tidak valid. Silakan login kembali."
      });
    }

    // Check if exists
    const [existing] = await db.execute(
      "SELECT id FROM master_zakat WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan"
      });
    }

    // Update database
    await db.execute(
      `UPDATE master_zakat 
       SET nama = ?, harga = ?, kg = ?, updated_by = ?
       WHERE id = ?`,
      [nama.trim(), parseFloat(harga), parseFloat(kg) || 0, userId, id]
    );

    res.json({
      success: true,
      message: "Data jenis zakat berhasil diupdate"
    });
  } catch (error) {
    console.error("Error updating master zakat:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengupdate data: " + error.message
    });
  }
});

// DELETE /api/master-zakat/:id - Delete master zakat
router.delete("/api/master-zakat/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    // Check if exists
    const [existing] = await db.execute(
      "SELECT id, nama FROM master_zakat WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan"
      });
    }

    // Check if being used
    const [usageCount] = await db.execute(
      "SELECT COUNT(*) as count FROM muzakki WHERE master_zakat_id = ?",
      [id]
    );

    if (usageCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Data ini sedang digunakan oleh ${usageCount[0].count} muzakki. Tidak dapat dihapus.`
      });
    }

    // Delete from database
    await db.execute("DELETE FROM master_zakat WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Data jenis zakat berhasil dihapus"
    });
  } catch (error) {
    console.error("Error deleting master zakat:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghapus data: " + error.message
    });
  }
});

// GET /muzakki/export-excel - Export all muzakki data to Excel with sheets per RT
router.get("/export-excel", async (req, res) => {
  const ExcelJS = require('exceljs');
  
  try {
    const db = req.app.locals.db;

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Get all RT data
    const [rtList] = await db.execute(`
      SELECT id, nomor_rt, ketua_rt 
      FROM rt 
      ORDER BY nomor_rt
    `);

    // If no RT found, return empty workbook
    if (rtList.length === 0) {
      const worksheet = workbook.addWorksheet('Data Kosong');
      worksheet.addRow(['Tidak ada data RT']);
    }

    // Create a sheet for each RT
    for (const rt of rtList) {
      // Get muzakki data for this RT
      const [muzakkiData] = await db.execute(`
        SELECT 
          m.id,
          m.jumlah_jiwa,
          m.jenis_zakat,
          m.jumlah_beras_kg,
          m.jumlah_uang,
          m.jumlah_bayar,
          m.kembalian,
          m.created_at,
          u.name as pencatat_name
        FROM muzakki m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.rt_id = ?
        ORDER BY m.created_at DESC
      `, [rt.id]);

      // For each muzakki, get detail names
      for (let i = 0; i < muzakkiData.length; i++) {
        const [details] = await db.execute(`
          SELECT GROUP_CONCAT(nama_muzakki SEPARATOR ', ') as nama_muzakki_list
          FROM muzakki_details
          WHERE muzakki_id = ?
        `, [muzakkiData[i].id]);
        
        muzakkiData[i].nama_muzakki_list = details[0]?.nama_muzakki_list || '-';
      }

      // Create worksheet
      const sheetName = `RT ${String(rt.nomor_rt).padStart(2, '0')}`;
      const worksheet = workbook.addWorksheet(sheetName);

      // Add title
      worksheet.mergeCells('A1:J1');
      worksheet.getCell('A1').value = `DATA MUZAKKI RT ${rt.nomor_rt}`;
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Add ketua info
      worksheet.mergeCells('A2:J2');
      worksheet.getCell('A2').value = `Ketua RT: ${rt.ketua_rt || '-'}`;
      worksheet.getCell('A2').font = { italic: true };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      // Empty row
      worksheet.addRow([]);

      // Header row
      const headerRow = worksheet.addRow([
        'No',
        'Nama Muzakki',
        'Jumlah Jiwa',
        'Jenis Zakat',
        'Jumlah Beras (kg)',
        'Jumlah Uang (Rp)',
        'Jumlah Bayar (Rp)',
        'Kembalian (Rp)',
        'Pencatat',
        'Tanggal'
      ]);

      // Style header
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center' };

      // Set column widths
      worksheet.getColumn(1).width = 5;
      worksheet.getColumn(2).width = 35;
      worksheet.getColumn(3).width = 12;
      worksheet.getColumn(4).width = 12;
      worksheet.getColumn(5).width = 18;
      worksheet.getColumn(6).width = 18;
      worksheet.getColumn(7).width = 18;
      worksheet.getColumn(8).width = 18;
      worksheet.getColumn(9).width = 20;
      worksheet.getColumn(10).width = 15;

      // Add data
      let totalJiwa = 0;
      let totalBeras = 0;
      let totalUang = 0;
      let totalBayar = 0;
      let totalKembalian = 0;

      muzakkiData.forEach((item, index) => {
        const jiwa = parseInt(item.jumlah_jiwa) || 0;
        const beras = parseFloat(item.jumlah_beras_kg) || 0;
        const uang = parseFloat(item.jumlah_uang) || 0;
        const bayar = parseFloat(item.jumlah_bayar) || 0;
        const kembalian = parseFloat(item.kembalian) || 0;

        totalJiwa += jiwa;
        totalBeras += beras;
        totalUang += uang;
        totalBayar += bayar;
        totalKembalian += kembalian;

        worksheet.addRow([
          index + 1,
          item.nama_muzakki_list,
          jiwa,
          item.jenis_zakat === 'beras' ? 'Beras' : 'Uang',
          beras,
          uang,
          bayar,
          kembalian,
          item.pencatat_name || '-',
          new Date(item.created_at).toLocaleDateString('id-ID')
        ]);
      });

      // Add total row
      if (muzakkiData.length > 0) {
        worksheet.addRow([]);
        const totalRow = worksheet.addRow([
          '',
          'TOTAL',
          totalJiwa,
          '',
          totalBeras,
          totalUang,
          totalBayar,
          totalKembalian,
          '',
          ''
        ]);
        totalRow.font = { bold: true };
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers
    const filename = `Data_Muzakki_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send buffer
    res.send(buffer);

  } catch (error) {
    console.error("Error exporting to Excel:", error);
    console.error("Stack:", error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat export ke Excel: " + error.message
      });
    }
  }
});

module.exports = router;

