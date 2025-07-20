const mongoose = require("mongoose");
const User = require("../models/UserModel");
require("dotenv").config();

const setupDefaultAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Check if admin exists
    const adminExists = await User.findOne({ isAdmin: true });

    if (!adminExists) {
      // Create default admin
      const adminUser = await User.create({
        name: "Admin User",
        email: "admin@solarexpress.com",
        password: "admin123456", // Change this to a secure password
        mobile: "1234567890",
        isAdmin: true,
      });
      console.log("✅ Default admin user created:", adminUser.email);
    } else {
      console.log("✅ Admin user already exists:", adminExists.email);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error setting up admin:", error);
    process.exit(1);
  }
};

setupDefaultAdmin();
