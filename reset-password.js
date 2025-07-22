const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config({ path: "./config/config.env" });

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("🔐 Password Reset Utility");
    console.log("========================");

    const User = require("./models/UserModel");

    // Find the first user
    const user = await User.findOne({ email: "adnantfw@gmail.com" });

    if (user) {
      // Reset password to "123456"
      const newPassword = "123456";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user password directly
      await User.findByIdAndUpdate(user._id, {
        password: hashedPassword,
      });

      console.log("✅ Password reset successful!");
      console.log("📧 Email:", user.email);
      console.log("🔑 New password:", newPassword);

      // Test the login immediately
      const testUser = await User.findById(user._id);
      const isMatch = await testUser.isPasswordMatched(newPassword);
      console.log(
        "🧪 Password test:",
        isMatch ? "✅ Working!" : "❌ Still not working"
      );
    } else {
      console.log("❌ User not found");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();
