const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config({ path: "./config/config.env" });

async function findCorrectPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("🔍 Finding correct password...");

    // Get raw user data directly from MongoDB
    const db = mongoose.connection.db;
    const users = await db.collection("users").find({}).toArray();

    console.log("📋 Found", users.length, "users");

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n👤 User ${i + 1}:`);
      console.log("   Email:", user.email);
      console.log("   Name:", user.name);
      console.log("   Password Hash:", user.password.substring(0, 20) + "...");

      // Try to reverse-engineer the password by testing common patterns
      const possiblePasswords = [
        "123456",
        "password",
        "admin123",
        user.name?.toLowerCase(),
        user.email?.split("@")[0],
        "Adnan123", // Based on name
        "adnan123",
        "Adnan",
        "adnan",
        "Khan123",
        "khan123",
      ];

      for (const pwd of possiblePasswords) {
        try {
          const isMatch = await bcrypt.compare(pwd, user.password);
          if (isMatch) {
            console.log(`   🎉 FOUND PASSWORD: "${pwd}"`);
            break;
          }
        } catch (error) {
          // Continue trying
        }
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

findCorrectPassword();
