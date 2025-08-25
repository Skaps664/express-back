#!/usr/bin/env node

require("dotenv").config();
const axios = require("axios");

async function setupTwilioGuide() {
  console.log("🔧 Twilio WhatsApp Setup Assistant");
  console.log("==================================\n");

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const adminWhatsApp = process.env.ADMIN_WHATSAPP;

  // Check configuration
  console.log("📋 Current Configuration:");
  console.log(`✅ Account SID: ${accountSid}`);
  console.log(`✅ Auth Token: ${authToken ? "Configured" : "Missing"}`);
  console.log(`✅ Admin WhatsApp: ${adminWhatsApp}`);
  console.log(`✅ Twilio WhatsApp: ${process.env.TWILIO_WHATSAPP_NUMBER}\n`);

  if (!accountSid || !authToken) {
    console.log("❌ Missing Twilio credentials in .env file");
    return;
  }

  try {
    // Check account status
    console.log("🔍 Checking Twilio Account Status...");
    const accountResponse = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
      }
    );

    console.log(`✅ Account Status: ${accountResponse.data.status}`);
    console.log(`📱 Account Type: ${accountResponse.data.type}`);

    if (accountResponse.data.type === "Trial") {
      console.log("\n🚨 TRIAL ACCOUNT DETECTED - This is your issue!");
      console.log("Trial accounts require number verification for WhatsApp.\n");
    }

    // Get recent WhatsApp messages to see errors
    console.log("📱 Checking Recent WhatsApp Messages...");
    const messagesResponse = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=5`,
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
      }
    );

    const whatsappMessages = messagesResponse.data.messages.filter(
      (msg) => msg.from.includes("whatsapp:") || msg.to.includes("whatsapp:")
    );

    const failedMessages = whatsappMessages.filter(
      (msg) => msg.status === "failed" || msg.error_code
    );

    if (failedMessages.length > 0) {
      console.log(
        `\n❌ Found ${failedMessages.length} failed WhatsApp messages:`
      );
      failedMessages.forEach((msg, index) => {
        console.log(
          `${index + 1}. Status: ${msg.status} | Error: ${
            msg.error_code
          } | Date: ${new Date(msg.date_sent).toLocaleDateString()}`
        );
      });

      const hasError63015 = failedMessages.some(
        (msg) => msg.error_code === 63015
      );
      if (hasError63015) {
        console.log(
          "\n🎯 FOUND THE PROBLEM: Error 63015 - Number not verified!"
        );
        console.log(
          "This confirms your admin WhatsApp number needs verification.\n"
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Error checking Twilio:",
      error.response?.data || error.message
    );
    return;
  }

  // Provide step-by-step instructions
  console.log("🔧 STEP-BY-STEP FIX INSTRUCTIONS:");
  console.log("=================================\n");

  console.log("Step 1: Open Twilio Console");
  console.log("📖 Go to: https://console.twilio.com/\n");

  console.log("Step 2: Navigate to WhatsApp Sandbox");
  console.log(
    "📖 Click: Develop → Messaging → Try it out → Send a WhatsApp message"
  );
  console.log(
    "📖 Or go directly to: https://console.twilio.com/develop/sms/try-it-out/whatsapp-learn\n"
  );

  console.log("Step 3: Join WhatsApp Sandbox");
  console.log("📱 You'll see something like:");
  console.log("   'Send \"join <some-code>\" to +1 415 523 8886'");
  console.log(`📱 Add +1 415 523 8886 to your WhatsApp contacts`);
  console.log(`📱 Send the join message they show you\n`);

  console.log("Step 4: Verify Your Admin Number");
  console.log(`📱 In the console, enter your number: ${adminWhatsApp}`);
  console.log("📱 Send yourself a test message");
  console.log("📱 This will verify your number for receiving messages\n");

  console.log("Step 5: Test After Setup");
  console.log("🧪 Run this command to test:");
  console.log("   cd /home/skaps/solar-express-live/backend");
  console.log("   node check-twilio-status.js\n");

  console.log("🎯 WHAT SHOULD HAPPEN:");
  console.log("After completing the steps above:");
  console.log("✅ Your WhatsApp number will be verified");
  console.log("✅ Future order notifications will work automatically");
  console.log("✅ Error 63015 will be resolved\n");

  console.log("💡 ALTERNATIVE: Upgrade Account");
  console.log("If you prefer to skip verification:");
  console.log("💳 Upgrade to paid Twilio account ($20/month minimum)");
  console.log("🚀 This removes all trial restrictions");
  console.log("📱 Can send to any number without verification\n");

  console.log("❓ Need help? Run this script again after following the steps!");
}

setupTwilioGuide().catch(console.error);
