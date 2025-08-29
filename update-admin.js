const mongoose = require("mongoose");
require("dotenv").config();

async function updateAdminStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("🔧 Updating admin status for users...");

    const User = require("./models/UserModel");

    // Update users with role="admin" to have isAdmin=true
    const result = await User.updateMany(
      { role: "admin" },
      { $set: { isAdmin: true } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with admin role`);

    // Show current admin users
    const adminUsers = await User.find({
      $or: [{ isAdmin: true }, { role: "admin" }],
    }).select("name email isAdmin role");

    console.log("👑 Current admin users:");
    adminUsers.forEach((user) => {
      console.log(
        `   ${user.name} (${user.email}) - isAdmin: ${user.isAdmin}, role: ${user.role}`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

updateAdminStatus();
