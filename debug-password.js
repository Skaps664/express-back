const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Simple test to debug password issues
async function debugPassword() {
  try {
    console.log("🔍 Password Debug Test");
    console.log("====================");

    // Test bcrypt directly
    const testPassword = "123456";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(testPassword, salt);

    console.log("✅ Raw password:", testPassword);
    console.log("✅ Hashed password:", hashedPassword);

    // Test comparison
    const isMatch1 = await bcrypt.compare(testPassword, hashedPassword);
    const isMatch2 = await bcrypt.compare("wrongpassword", hashedPassword);

    console.log("✅ Correct password match:", isMatch1);
    console.log("✅ Wrong password match:", isMatch2);

    // Connect to database and check existing user
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("✅ Connected to MongoDB");

    const User = require("./models/UserModel");

    // Check if there are any users
    const userCount = await User.countDocuments();
    console.log("📊 Total users in database:", userCount);

    if (userCount > 0) {
      // Get first user (without password for security)
      const firstUser = await User.findOne({}, { password: 0 }).lean();
      console.log("👤 First user:", firstUser);

      // Check password structure of first user
      const userWithPassword = await User.findById(firstUser._id)
        .select("email password")
        .lean();
      console.log("🔐 Password length:", userWithPassword.password?.length);
      console.log(
        "🔐 Password starts with:",
        userWithPassword.password?.substring(0, 10) + "..."
      );

      // Check if password looks hashed (bcrypt hashes start with $2b$)
      const isHashed = userWithPassword.password?.startsWith("$2b$");
      console.log("🔐 Password appears to be hashed:", isHashed);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

debugPassword();
