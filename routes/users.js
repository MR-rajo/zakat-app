const express = require("express");
const router = express.Router();

// Placeholder for users routes (admin only)
router.get("/", (req, res) => {
  res.render("users/index", {
    title: "Manajemen User - Zakat Fitrah",
    layout: "layouts/main",
  });
});

module.exports = router;
