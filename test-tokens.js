const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "./config/config.env" });

async function testTokens() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "solar-express",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });

    console.log("🧪 Testing Token Generation and Verification");
    console.log("===========================================");

    const User = require("./models/UserModel");
    const { generateToken } = require("./config/jwtToken");
    const { generateRefreshToken } = require("./config/refreshToken");

    // Get test user
    const user = await User.findOne({ email: "adnantfw@gmail.com" });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("👤 User found:", user.email);
    console.log("🔑 User ID:", user._id);
    console.log("👑 Is Admin:", user.isAdmin);
    console.log("🎭 Role:", user.role);

    // Test token generation
    const accessToken = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    console.log("\n🔐 Generated Tokens:");
    console.log(
      "Access Token (first 50 chars):",
      accessToken.substring(0, 50) + "..."
    );
    console.log(
      "Refresh Token (first 50 chars):",
      refreshToken.substring(0, 50) + "..."
    );

    // Test token verification
    try {
      const accessDecoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      console.log("✅ Access token verified, user ID:", accessDecoded.id);

      const refreshDecoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_JWT_SECRET
      );
      console.log("✅ Refresh token verified, user ID:", refreshDecoded.id);

      // Test if tokens match user
      console.log(
        "🔍 Token user matches:",
        accessDecoded.id === user._id.toString()
      );
    } catch (tokenError) {
      console.log("❌ Token verification failed:", tokenError.message);
    }

    // Check JWT secrets
    console.log("\n🔧 Environment Check:");
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
    console.log("REFRESH_JWT_SECRET exists:", !!process.env.REFRESH_JWT_SECRET);
    console.log("NODE_ENV:", process.env.NODE_ENV);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

testTokens();
