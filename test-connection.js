const mongoose = require("mongoose");
require("dotenv").config();

async function quickConnectionTest() {
  console.log("🧪 Quick MongoDB Connection Test");
  console.log("=================================");

  const uri = process.env.MONGODB_URI;
  console.log("🔗 Testing URI:", uri.replace(/:[^@]*@/, ":****@"));

  try {
    console.log("📡 Connecting...");

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      connectTimeoutMS: 10000,
      bufferCommands: false,
    });

    console.log("✅ Connection successful!");
    console.log("📊 Connection state:", mongoose.connection.readyState);
    console.log("🏢 Database name:", mongoose.connection.db.databaseName);

    await mongoose.disconnect();
    console.log("✅ Test completed successfully");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);

    if (error.message.includes("authentication failed")) {
      console.log("\n🚨 AUTHENTICATION ISSUE:");
      console.log("- Check MongoDB username/password");
      console.log("- Verify database user permissions");
    }

    if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("timeout")
    ) {
      console.log("\n🚨 NETWORK/DNS ISSUE:");
      console.log("- Check internet connection");
      console.log("- Verify cluster URL is correct");
      console.log("- Check if cluster is paused in Atlas");
    }
  }
}

quickConnectionTest();
