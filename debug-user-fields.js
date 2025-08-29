const mongoose = require("mongoose");
require("dotenv").config();

async function debugUserFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("🔍 Checking user field structure...");

    const User = require("./models/UserModel");

    // Get first user with all fields
    const user = await User.findOne({}).lean();

    console.log("📋 All user fields:");
    console.log(Object.keys(user));

    console.log("\n🔐 Testing login with actual user data:");
    const testUser = await User.findOne({ email: user.email });

    if (testUser) {
      console.log("✅ User found:", testUser.email);
      console.log(
        "✅ User has isPasswordMatched method:",
        typeof testUser.isPasswordMatched
      );

      // Test with a common password
      const commonPasswords = ["123456", "password", "admin", "test", "user"];

      for (const pwd of commonPasswords) {
        try {
          const isMatch = await testUser.isPasswordMatched(pwd);
          console.log(
            `🔐 Password "${pwd}": ${isMatch ? "✅ MATCH" : "❌ No match"}`
          );
        } catch (error) {
          console.log(`🔐 Password "${pwd}": ❌ Error - ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

debugUserFields();
