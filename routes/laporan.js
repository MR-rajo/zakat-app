const express = require("express");
const router = express.Router();

// GET /laporan - Show laporan page
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get laporan per RT
    const [laporanRT] = await db.execute(`
            SELECT 
                r.nomor_rt,
                r.ketua_rt,
                COUNT(m.id) as total_muzakki,
                SUM(CASE WHEN m.jenis_zakat = 'beras' THEN m.jumlah_beras_kg ELSE 0 END) as total_beras_kg,
                SUM(CASE WHEN m.jenis_zakat = 'uang' THEN m.jumlah_uang ELSE 0 END) as total_uang_kewajiban,
                SUM(m.jumlah_bayar) as total_terkumpul,
                SUM(m.kembalian) as total_kembalian
            FROM rt r
            LEFT JOIN muzakki m ON r.id = m.rt_id
            GROUP BY r.id, r.nomor_rt, r.ketua_rt
            ORDER BY r.nomor_rt
        `);

    // Get total infak
    const [totalInfak] = await db.execute(`
            SELECT SUM(jumlah) as total_infak FROM infak
        `);

    res.render("laporan/index", {
      title: "Laporan Zakat - Zakat Fitrah",
      layout: "layouts/main",
      laporanRT,
      totalInfak: totalInfak[0].total_infak || 0,
    });
  } catch (error) {
    console.error("Error fetching laporan:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil data laporan");
    res.redirect("/");
  }
});

module.exports = router;
