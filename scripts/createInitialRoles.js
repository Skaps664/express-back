const mongoose = require("mongoose");
const User = require("../models/UserModel");
require("dotenv").config();

const setupAdminAccess = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find all users with isAdmin=true
    const adminUsers = await User.find({ isAdmin: true });

    if (adminUsers.length === 0) {
      console.log("No admin users found. Please create an admin user first.");
      process.exit(1);
    }

    console.log("✅ Admin access verified successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error verifying admin access:", error);
    process.exit(1);
  }
};

setupAdminAccess();
