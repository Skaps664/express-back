const { default: mongoose } = require("mongoose");

// Configure mongoose for better performance and reliability
mongoose.set("strictQuery", false);
mongoose.set("bufferCommands", false);

const dbConnect = () => {
  const options = {
    dbName: "solar-express",
    // Enterprise-scale connection timeout and retry settings
    serverSelectionTimeoutMS: 3000, // Faster server selection
    socketTimeoutMS: 30000, // Reduced socket timeout
    connectTimeoutMS: 8000, // Faster connection timeout

    // High-scale connection pool settings
    maxPoolSize: 50, // Increased for high traffic (100k+ users)
    minPoolSize: 10, // Higher minimum to handle baseline load
    maxIdleTimeMS: 20000, // Faster cleanup for memory efficiency
    maxConnecting: 10, // Limit concurrent connections

    // High-performance reliability settings
    retryWrites: true,
    retryReads: true,
    readPreference: "secondaryPreferred", // Distribute read load
    readConcern: { level: "local" }, // Faster reads for non-critical data
    writeConcern: { w: "majority", j: true, wtimeout: 5000 }, // Fast, safe writes

    // Optimized buffering settings
    bufferCommands: false,

    // Aggressive heartbeat settings for high availability
    heartbeatFrequencyMS: 5000, // More frequent heartbeats

    // Maximum performance compression
    compressors: ["zstd", "zlib"], // zstd for better compression ratio
    zlibCompressionLevel: 6,

    // Additional enterprise settings
    appName: "SolarExpress-Production", // For MongoDB monitoring
    monitorCommands: false, // Disable for performance in production
    directConnection: false, // Use replica set for scaling

    // Advanced timeout settings
    waitQueueTimeoutMS: 5000, // Quick queue timeout
    localThresholdMS: 15, // Prefer nearby servers
  };

  return mongoose
    .connect(process.env.MONGODB_URI, options)
    .then(() => {
      console.log(
        "✅ Successfully connected to MongoDB with optimized settings"
      );
      console.log(`🏢 Connected to database: ${options.dbName}`);
      // Set default query timeout
      mongoose.set("bufferCommands", false);
      return mongoose.connection;
    })
    .catch((error) => {
      console.error("❌ Error connecting to MongoDB:", error.message);

      // Specific error handling for common issues
      if (error.message.includes("IP whitelist")) {
        console.error("🚨 IP WHITELIST ERROR:");
        console.error("   1. Go to MongoDB Atlas Dashboard");
        console.error("   2. Navigate to Network Access");
        console.error("   3. Add your current IP or 0.0.0.0/0 for testing");
        console.error("   4. Save and wait 2-3 minutes");
      }

      if (error.message.includes("authentication failed")) {
        console.error("🚨 AUTHENTICATION ERROR:");
        console.error("   Check your MongoDB username/password in config.env");
      }

      // For Vercel deployment, don't retry indefinitely
      if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        console.error(
          "Production environment detected - not retrying connection"
        );
        return Promise.reject(error);
      }

      // Retry connection after 5 seconds (development only)
      console.log("🔄 Retrying MongoDB connection in 5 seconds...");
      setTimeout(() => {
        dbConnect();
      }, 5000);

      return Promise.reject(error);
    });
};

// Handle connection events
mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed through app termination");
  process.exit(0);
});

module.exports = dbConnect;
