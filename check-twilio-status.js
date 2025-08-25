#!/usr/bin/env node

require("dotenv").config();
const axios = require("axios");

async function checkTwilioStatus() {
  try {
    console.log("🔍 Checking Twilio WhatsApp Status...\n");

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
    const adminWhatsApp = process.env.ADMIN_WHATSAPP;

    console.log("📋 Twilio Configuration:");
    console.log("========================");
    console.log(`Account SID: ${accountSid}`);
    console.log(
      `Auth Token: ${authToken ? authToken.substring(0, 8) + "..." : "Not set"}`
    );
    console.log(`Twilio WhatsApp: ${twilioWhatsApp}`);
    console.log(`Admin WhatsApp: ${adminWhatsApp}`);
    console.log("");

    // Check Twilio account status
    console.log("🔍 Checking Twilio Account Status...");
    try {
      const accountResponse = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
        }
      );

      console.log("✅ Account Status:", accountResponse.data.status);
      console.log("📞 Account Type:", accountResponse.data.type);
      console.log("💰 Account Balance:", accountResponse.data.balance);
      console.log("");
    } catch (error) {
      console.error(
        "❌ Account check failed:",
        error.response?.data || error.message
      );
      return;
    }

    // Get recent WhatsApp messages
    console.log("📱 Checking Recent WhatsApp Messages...");
    try {
      const messagesResponse = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=10`,
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

      console.log(
        `Found ${whatsappMessages.length} WhatsApp messages in recent history:`
      );

      whatsappMessages.forEach((msg, index) => {
        console.log(`\n${index + 1}. Message SID: ${msg.sid}`);
        console.log(`   From: ${msg.from}`);
        console.log(`   To: ${msg.to}`);
        console.log(`   Status: ${msg.status}`);
        console.log(`   Date: ${new Date(msg.date_sent).toLocaleString()}`);
        console.log(`   Error Code: ${msg.error_code || "None"}`);
        console.log(`   Error Message: ${msg.error_message || "None"}`);
        if (msg.body) {
          console.log(`   Preview: ${msg.body.substring(0, 100)}...`);
        }
      });

      // Check for any failed messages
      const failedMessages = whatsappMessages.filter(
        (msg) =>
          msg.status === "failed" ||
          msg.status === "undelivered" ||
          msg.error_code
      );

      if (failedMessages.length > 0) {
        console.log(
          `\n⚠️  Found ${failedMessages.length} failed WhatsApp messages:`
        );
        failedMessages.forEach((msg, index) => {
          console.log(
            `${index + 1}. ${msg.sid} - ${msg.status} - ${
              msg.error_message || "Unknown error"
            }`
          );
        });
      }
    } catch (error) {
      console.error(
        "❌ Messages check failed:",
        error.response?.data || error.message
      );
    }

    // Test sending a simple WhatsApp message
    console.log("\n🧪 Sending Test WhatsApp Message...");
    try {
      const testMessage = `🧪 Test message from Solar Express\nTime: ${new Date().toLocaleString()}\nThis is a test to verify WhatsApp functionality.`;

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        new URLSearchParams({
          From: `whatsapp:${twilioWhatsApp}`,
          To: `whatsapp:${adminWhatsApp}`,
          Body: testMessage,
        }),
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log("✅ Test message sent successfully!");
      console.log(`📱 Message SID: ${response.data.sid}`);
      console.log(`📊 Status: ${response.data.status}`);
      console.log("📲 Check your WhatsApp for the test message");
    } catch (error) {
      console.error("❌ Test message failed:");
      if (error.response?.data) {
        console.error(
          "Error Details:",
          JSON.stringify(error.response.data, null, 2)
        );
      } else {
        console.error("Error:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ General error:", error);
  }
}

checkTwilioStatus();
