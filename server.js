const app = require("./app");
const PORT = process.env.PORT || 3000;

// Railway requires binding to 0.0.0.0, but let's make it more explicit
const HOST =
  process.env.NODE_ENV === "production"
    ? "0.0.0.0"
    : process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 Health check: http://${HOST}:${PORT}/api/health`);
});

// Graceful shutdown for Railway
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});
