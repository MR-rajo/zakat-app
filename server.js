const app = require("./app");

// Get port from environment variables or use default
const PORT = process.env.PORT || 3000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📅 Started at: ${new Date().toLocaleString("id-ID")}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("📥 SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("📥 SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Process terminated");
  });
});

module.exports = server;
