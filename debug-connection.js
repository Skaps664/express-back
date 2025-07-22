const mongoose = require("mongoose");
require("dotenv").config({ path: "./config/config.env" });

async function testConnection() {
  console.log("🧪 Testing MongoDB Atlas Connection");
  console.log("==================================");

  try {
    console.log("📡 Attempting to connect to MongoDB Atlas...");
    console.log(
      "🔗 URI (partial):",
      process.env.MONGODB_URI.substring(0, 30) + "..."
    );

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("✅ MongoDB connection successful!");

    // Test basic operations
    const User = require("./models/UserModel");
    const userCount = await User.countDocuments();
    console.log("👥 Total users in database:", userCount);

    // Test finding the admin user
    const admin = await User.findOne({ email: "adnantfw@gmail.com" })
      .select("email isAdmin refreshToken")
      .lean();

    if (admin) {
      console.log("👑 Admin user found:", admin.email);
      console.log("🔑 Has refresh token:", !!admin.refreshToken);
      console.log("🛡️ Is admin:", admin.isAdmin);
    } else {
      console.log("❌ Admin user not found");
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error("Error:", error.message);

    if (error.message.includes("IP")) {
      console.log("\n🚨 IP WHITELIST ISSUE DETECTED!");
      console.log("Solution:");
      console.log("1. Go to https://cloud.mongodb.com/");
      console.log("2. Select your project/cluster");
      console.log("3. Click 'Network Access' in sidebar");
      console.log("4. Click 'Add IP Address'");
      console.log("5. Add current IP or 0.0.0.0/0 for testing");
      console.log("6. Wait 2-3 minutes for changes to apply");
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

testConnection();
