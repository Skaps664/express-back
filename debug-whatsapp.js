const axios = require("axios");
require("dotenv").config();

console.log("🔍 WhatsApp Configuration Debug");
console.log("===============================");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(
  `TWILIO_ACCOUNT_SID: ${
    process.env.TWILIO_ACCOUNT_SID ? "✅ Set" : "❌ Not set"
  }`
);
console.log(
  `TWILIO_AUTH_TOKEN: ${
    process.env.TWILIO_AUTH_TOKEN ? "✅ Set" : "❌ Not set"
  }`
);
console.log(`TWILIO_WHATSAPP_NUMBER: ${process.env.TWILIO_WHATSAPP_NUMBER}`);
console.log(`ADMIN_WHATSAPP: ${process.env.ADMIN_WHATSAPP}`);
console.log(
  `CALLMEBOT_API_KEY: ${
    process.env.CALLMEBOT_API_KEY ? "✅ Set" : "❌ Not set"
  }`
);
console.log("");

// Test Twilio WhatsApp API
async function testTwilioWhatsApp() {
  try {
    console.log("📱 Testing Twilio WhatsApp API...");

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log("❌ Twilio credentials not configured");
      return { success: false, error: "Missing credentials" };
    }

    const testMessage = `🧪 *TWILIO TEST MESSAGE*

📅 ${new Date().toLocaleDateString("en-PK", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}

✅ Twilio WhatsApp API is working correctly!
🏢 From: Solar Express System
🎯 Environment: ${process.env.NODE_ENV}

This is an automated test message.`;

    const adminWhatsApp = process.env.ADMIN_WHATSAPP || "923259327819";
    const cleanPhone = adminWhatsApp.replace(/[^0-9]/g, "");

    console.log(`📱 Sending to: +${cleanPhone}`);
    console.log(`📞 From: ${process.env.TWILIO_WHATSAPP_NUMBER}`);

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      new URLSearchParams({
        From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        To: `whatsapp:+${cleanPhone}`,
        Body: testMessage,
      }),
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 30000, // 30 seconds
      }
    );

    console.log("✅ Twilio WhatsApp test successful!");
    console.log(`📧 Message SID: ${response.data.sid}`);
    console.log(`📊 Status: ${response.data.status}`);
    console.log(`💰 Price: ${response.data.price} ${response.data.price_unit}`);

    return {
      success: true,
      sid: response.data.sid,
      status: response.data.status,
    };
  } catch (error) {
    console.error("❌ Twilio WhatsApp test failed:");
    console.error(`Error type: ${error.constructor.name}`);
    console.error(`Error message: ${error.message}`);

    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Twilio Error Code: ${error.response.data?.code}`);
      console.error(`Twilio Error Message: ${error.response.data?.message}`);
      console.error(`More Info: ${error.response.data?.more_info}`);

      // Specific error handling
      const errorCode = error.response.data?.code;
      if (errorCode === 63015) {
        console.error("\n💡 SOLUTION FOR ERROR 63015:");
        console.error("1. This is a Twilio trial account restriction");
        console.error("2. Your admin WhatsApp number needs to be verified");
        console.error(
          "3. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
        );
        console.error(`4. Add and verify: ${process.env.ADMIN_WHATSAPP}`);
        console.error("5. Or upgrade to a paid Twilio account");
      } else if (errorCode === 21211) {
        console.error("\n💡 SOLUTION FOR ERROR 21211:");
        console.error("1. Invalid 'To' phone number format");
        console.error("2. Check your ADMIN_WHATSAPP number format");
        console.error("3. Should be in format: +923259327819");
      }
    }

    return { success: false, error: error.response?.data || error.message };
  }
}

// Test CallMeBot API
async function testCallMeBot() {
  try {
    console.log("\n📱 Testing CallMeBot WhatsApp API...");

    if (!process.env.CALLMEBOT_API_KEY) {
      console.log("❌ CallMeBot API key not configured");
      console.log("\n📝 CallMeBot Setup Instructions:");
      console.log("1. Add +34 644 84 71 89 to your WhatsApp contacts");
      console.log(
        "2. Send this exact message: 'I allow callmebot to send me messages'"
      );
      console.log("3. You'll receive an API key in response");
      console.log("4. Add it to your .env as: CALLMEBOT_API_KEY=your_key_here");
      return { success: false, error: "CallMeBot API key not configured" };
    }

    const testMessage = `🧪 CALLMEBOT TEST MESSAGE

📅 ${new Date().toLocaleDateString("en-PK", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}

✅ CallMeBot WhatsApp API is working!
🏢 From: Solar Express System  
🎯 Environment: ${process.env.NODE_ENV}

This is an automated test message.`;

    const adminPhone = process.env.ADMIN_WHATSAPP || "923259327819";
    const cleanPhone = adminPhone.replace(/[^0-9]/g, "");

    console.log(`📱 Sending to: +${cleanPhone}`);
    console.log(
      `🔑 Using API key: ${process.env.CALLMEBOT_API_KEY.substring(0, 8)}...`
    );

    const response = await axios.get(`https://api.callmebot.com/whatsapp.php`, {
      params: {
        phone: cleanPhone,
        text: testMessage,
        apikey: process.env.CALLMEBOT_API_KEY,
      },
      timeout: 15000,
    });

    console.log("✅ CallMeBot test successful!");
    console.log(`📊 Response: ${response.data}`);

    return { success: true, response: response.data };
  } catch (error) {
    console.error("❌ CallMeBot test failed:");
    console.error(`Error message: ${error.message}`);

    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response: ${error.response.data}`);

      if (error.response.status === 400) {
        console.error("\n💡 POSSIBLE SOLUTIONS:");
        console.error("1. Check if your phone number is correct");
        console.error("2. Verify your CallMeBot API key");
        console.error("3. Make sure you completed the setup process");
        console.error("4. Try sending the setup message again");
      }
    }

    return { success: false, error: error.response?.data || error.message };
  }
}

// Test Twilio credentials
async function testTwilioCredentials() {
  try {
    console.log("\n🔐 Testing Twilio Account Credentials...");

    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      }
    );

    console.log("✅ Twilio credentials are valid!");
    console.log(`📊 Account Status: ${response.data.status}`);
    console.log(`📊 Account Type: ${response.data.type}`);
    console.log(
      `💰 Balance: ${response.data.balance} ${
        response.data.balance_currency || "USD"
      }`
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error("❌ Twilio credential test failed:");
    console.error(`Error: ${error.response?.data?.message || error.message}`);

    if (error.response?.status === 401) {
      console.error("\n💡 AUTHENTICATION ERROR:");
      console.error("1. Check your TWILIO_ACCOUNT_SID");
      console.error("2. Check your TWILIO_AUTH_TOKEN");
      console.error("3. Verify credentials at: https://console.twilio.com/");
    }

    return { success: false, error: error.response?.data || error.message };
  }
}

// Run all tests
async function runWhatsAppTests() {
  console.log("🚀 Starting WhatsApp notification tests...\n");

  // Test 1: Twilio credentials
  const credentialTest = await testTwilioCredentials();

  // Test 2: Twilio WhatsApp
  const twilioTest = await testTwilioWhatsApp();

  // Test 3: CallMeBot
  const callmebotTest = await testCallMeBot();

  console.log("\n" + "=".repeat(50));
  console.log("📊 WHATSAPP TEST SUMMARY");
  console.log("=".repeat(50));
  console.log(
    `🔐 Twilio Credentials: ${
      credentialTest.success ? "✅ VALID" : "❌ INVALID"
    }`
  );
  console.log(
    `📱 Twilio WhatsApp: ${twilioTest.success ? "✅ WORKING" : "❌ FAILED"}`
  );
  console.log(
    `📱 CallMeBot: ${callmebotTest.success ? "✅ WORKING" : "❌ FAILED"}`
  );

  if (!twilioTest.success && !callmebotTest.success) {
    console.log("\n🚨 CRITICAL: All WhatsApp methods failed!");
    console.log("📝 Recommended actions:");
    console.log("1. Fix Twilio setup for primary notifications");
    console.log("2. Configure CallMeBot as backup method");
    console.log("3. Check network connectivity and firewall settings");
  } else if (twilioTest.success) {
    console.log("\n✅ SUCCESS: Twilio WhatsApp is working!");
    console.log("📱 Order notifications will be sent via Twilio");
  } else if (callmebotTest.success) {
    console.log("\n⚠️ PARTIAL: Only CallMeBot is working");
    console.log("📱 Order notifications will use CallMeBot fallback");
    console.log("💡 Consider fixing Twilio for better reliability");
  }

  console.log("\n🔧 For production deployment:");
  console.log("1. Ensure at least one method is working");
  console.log("2. Monitor WhatsApp notification logs");
  console.log("3. Set up alerting for failed notifications");

  process.exit(0);
}

runWhatsAppTests().catch(console.error);
