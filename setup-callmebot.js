#!/usr/bin/env node

require("dotenv").config();
const axios = require("axios");

console.log("🧪 CallMeBot WhatsApp Setup & Test\n");

async function setupCallMeBot() {
  console.log("📋 CallMeBot Setup Instructions:");
  console.log("================================");
  console.log(
    "1. 📱 Add this number to your WhatsApp contacts: +34 644 84 71 89"
  );
  console.log(
    "2. 💬 Send this exact message: 'I allow callmebot to send me messages'"
  );
  console.log("3. 🔑 You'll receive your API key in response");
  console.log("4. 📝 Add the API key to your .env file as CALLMEBOT_API_KEY");
  console.log("");

  // Check current configuration
  console.log("🔍 Current Configuration:");
  console.log("========================");
  console.log(`Admin WhatsApp: ${process.env.ADMIN_WHATSAPP || "❌ Not set"}`);
  console.log(
    `CallMeBot API Key: ${
      process.env.CALLMEBOT_API_KEY
        ? "✅ Set (" + process.env.CALLMEBOT_API_KEY.substring(0, 6) + "...)"
        : "❌ Not set"
    }`
  );
  console.log("");

  if (
    !process.env.CALLMEBOT_API_KEY ||
    process.env.CALLMEBOT_API_KEY === "YOUR_API_KEY_HERE"
  ) {
    console.log("⚠️  CallMeBot API key not configured yet.");
    console.log(
      "📝 Please follow the setup instructions above, then run this script again."
    );
    return;
  }

  // Test CallMeBot
  console.log("🧪 Testing CallMeBot WhatsApp...");
  console.log("==============================");

  try {
    const testMessage = `🧪 CallMeBot Test Message

✅ This is a test from Solar Express
🕐 Time: ${new Date().toLocaleString()}
🔧 System: CallMeBot WhatsApp API

If you received this message, CallMeBot is working perfectly!

Your order notifications will now be sent via CallMeBot.`;

    const adminPhone = process.env.ADMIN_WHATSAPP || "923259327819";
    const cleanPhone = adminPhone.replace(/[^0-9]/g, "");

    console.log(`📱 Sending test message to: +${cleanPhone}`);
    console.log(
      `🔑 Using API key: ${process.env.CALLMEBOT_API_KEY.substring(0, 6)}...`
    );

    const response = await axios.get(`https://api.callmebot.com/whatsapp.php`, {
      params: {
        phone: cleanPhone,
        text: testMessage,
        apikey: process.env.CALLMEBOT_API_KEY,
      },
      timeout: 10000,
    });

    console.log("✅ Test message sent successfully!");
    console.log("📊 Response:", response.data);
    console.log("📱 Check your WhatsApp for the test message");

    console.log("\n🎉 CallMeBot Setup Complete!");
    console.log("===============================");
    console.log("✅ Your WhatsApp notifications are now configured");
    console.log("✅ All future order notifications will use CallMeBot");
    console.log("✅ No more Twilio trial account restrictions!");
  } catch (error) {
    console.error("❌ Test failed!");
    console.error("Error:", error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("===================");
    console.log(
      "1. ✅ Make sure you added +34 644 84 71 89 to WhatsApp contacts"
    );
    console.log(
      "2. ✅ Make sure you sent the exact message: 'I allow callmebot to send me messages'"
    );
    console.log("3. ✅ Make sure you received an API key in response");
    console.log(
      "4. ✅ Make sure the API key is correctly added to your .env file"
    );
    console.log("5. ✅ Make sure your admin WhatsApp number is correct");
  }
}

setupCallMeBot();
