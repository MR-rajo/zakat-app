const express = require("express");
const router = express.Router();

// GET /infak - List all infak
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get all infak with muzakki info
    const [infak] = await db.execute(`
            SELECT 
                i.*,
                m.nama as muzakki_name,
                r.nomor_rt
            FROM infak i
            LEFT JOIN muzakki m ON i.muzakki_id = m.id
            LEFT JOIN rt r ON m.rt_id = r.id
            ORDER BY i.created_at DESC
        `);

    res.render("infak/index", {
      title: "Data Infak - Zakat Fitrah",
      layout: "layouts/main",
      infak,
    });
  } catch (error) {
    console.error("Error fetching infak:", error);
    req.flash("error_msg", "Terjadi kesalahan saat mengambil data infak");
    res.redirect("/");
  }
});

module.exports = router;
