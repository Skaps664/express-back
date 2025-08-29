const axios = require("axios");
require("dotenv").config();

console.log("🔍 Twilio Credential Verification");
console.log("=================================");

// Display current credentials (safely)
console.log(`TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID}`);
console.log(
  `TWILIO_AUTH_TOKEN: ${
    process.env.TWILIO_AUTH_TOKEN
      ? process.env.TWILIO_AUTH_TOKEN.substring(0, 8) + "..."
      : "Not set"
  }`
);
console.log(`TWILIO_WHATSAPP_NUMBER: ${process.env.TWILIO_WHATSAPP_NUMBER}`);
console.log("");

async function verifyTwilioCredentials() {
  try {
    console.log("🔐 Verifying Twilio credentials...");

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error("❌ Missing Twilio credentials");
      return false;
    }

    // Check account details
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
        timeout: 10000,
      }
    );

    console.log("✅ Twilio credentials are valid!");
    console.log(`📊 Account SID: ${response.data.sid}`);
    console.log(`📊 Account Status: ${response.data.status}`);
    console.log(`📊 Account Type: ${response.data.type}`);
    console.log(`💰 Balance: $${response.data.balance || "0.00"}`);
    console.log(
      `📅 Created: ${new Date(response.data.date_created).toLocaleDateString()}`
    );

    // Check if account is trial
    if (response.data.type === "Trial") {
      console.log("\n⚠️ TRIAL ACCOUNT DETECTED");
      console.log("📝 Trial account limitations:");
      console.log("1. Can only send to verified phone numbers");
      console.log("2. Limited messaging capabilities");
      console.log("3. All messages will have trial account prefix");
      console.log("4. Need to verify recipient numbers in Twilio Console");
      console.log(
        "🔗 Verify numbers at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
      );
    }

    return true;
  } catch (error) {
    console.error("❌ Twilio credential verification failed:");
    console.error(`Status: ${error.response?.status}`);
    console.error(`Error: ${error.response?.data?.message || error.message}`);

    if (error.response?.status === 401) {
      console.error("\n💡 AUTHENTICATION FAILED:");
      console.error("1. Double-check your Account SID and Auth Token");
      console.error("2. Go to: https://console.twilio.com/");
      console.error("3. Navigate to Account > API keys & tokens");
      console.error("4. Copy the correct Account SID and Auth Token");
      console.error("5. Make sure there are no extra spaces or characters");
    }

    return false;
  }
}

async function checkWhatsAppCapability() {
  try {
    console.log("\n📱 Checking WhatsApp capabilities...");

    // Check if WhatsApp sandbox is enabled
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json?PageSize=1`,
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      }
    );

    console.log("✅ Twilio Messaging API accessible");

    // Try to get WhatsApp sandbox settings
    try {
      const sandboxResponse = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Sandbox/WhatsApp.json`,
        {
          auth: {
            username: process.env.TWILIO_ACCOUNT_SID,
            password: process.env.TWILIO_AUTH_TOKEN,
          },
        }
      );

      console.log("✅ WhatsApp Sandbox accessible");
      console.log(`📱 Sandbox Number: ${sandboxResponse.data.phone_number}`);
    } catch (sandboxError) {
      console.log(
        "⚠️ WhatsApp Sandbox not accessible (normal for production accounts)"
      );
    }
  } catch (error) {
    console.error("❌ WhatsApp capability check failed:");
    console.error(`Error: ${error.response?.data?.message || error.message}`);
  }
}

async function testSimpleWhatsApp() {
  try {
    console.log("\n📱 Testing simple WhatsApp message...");

    // Simple test message
    const testMessage =
      "🧪 Twilio Test from Solar Express - " + new Date().toLocaleTimeString();

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      new URLSearchParams({
        From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        To: `whatsapp:${process.env.ADMIN_WHATSAPP}`,
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
        timeout: 30000,
      }
    );

    console.log("✅ WhatsApp test message sent successfully!");
    console.log(`📧 Message SID: ${response.data.sid}`);
    console.log(`📊 Status: ${response.data.status}`);
    console.log(`📱 To: ${response.data.to}`);
    console.log(`📱 From: ${response.data.from}`);
    console.log(
      `💰 Price: ${response.data.price || "Free"} ${
        response.data.price_unit || ""
      }`
    );

    return true;
  } catch (error) {
    console.error("❌ WhatsApp test message failed:");
    console.error(`Status: ${error.response?.status}`);
    console.error(`Error Code: ${error.response?.data?.code}`);
    console.error(`Error Message: ${error.response?.data?.message}`);
    console.error(`More Info: ${error.response?.data?.more_info}`);

    const errorCode = error.response?.data?.code;

    if (errorCode === 63015) {
      console.error("\n💡 ERROR 63015 - UNVERIFIED NUMBER:");
      console.error(
        "1. This is a trial account trying to send to unverified number"
      );
      console.error(
        "2. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
      );
      console.error(`3. Add and verify: ${process.env.ADMIN_WHATSAPP}`);
      console.error("4. OR upgrade to a paid Twilio account");
    } else if (errorCode === 21211) {
      console.error("\n💡 ERROR 21211 - INVALID NUMBER:");
      console.error("1. The 'To' number is not a valid phone number");
      console.error(`2. Check format of: ${process.env.ADMIN_WHATSAPP}`);
      console.error("3. Should be: +923259327819 (with country code)");
    } else if (errorCode === 21612) {
      console.error("\n💡 ERROR 21612 - WHATSAPP NOT ENABLED:");
      console.error("1. WhatsApp is not enabled for this number");
      console.error("2. Contact Twilio support to enable WhatsApp");
      console.error("3. Or use WhatsApp Sandbox for testing");
    }

    return false;
  }
}

async function runTwilioTests() {
  console.log("🚀 Starting Twilio verification tests...\n");

  const credentialsValid = await verifyTwilioCredentials();

  if (credentialsValid) {
    await checkWhatsAppCapability();
    const whatsappWorking = await testSimpleWhatsApp();

    console.log("\n" + "=".repeat(50));
    console.log("📊 TWILIO TEST RESULTS");
    console.log("=".repeat(50));
    console.log(`🔐 Credentials: ✅ VALID`);
    console.log(`📱 WhatsApp: ${whatsappWorking ? "✅ WORKING" : "❌ FAILED"}`);

    if (whatsappWorking) {
      console.log("\n✅ SUCCESS: Twilio WhatsApp is fully functional!");
      console.log("📱 Order notifications will work correctly");
    } else {
      console.log("\n❌ ISSUE: WhatsApp messages are failing");
      console.log("📝 Check the error details above for solutions");
    }
  } else {
    console.log("\n❌ CRITICAL: Twilio credentials are invalid");
    console.log("📝 Fix credentials before testing WhatsApp functionality");
  }

  process.exit(0);
}

runTwilioTests().catch(console.error);
