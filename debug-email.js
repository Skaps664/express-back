const nodemailer = require("nodemailer");
require("dotenv").config({ path: "./config/config.env" });

console.log("🔍 Email Configuration Debug");
console.log("============================");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`EMAIL_USER: ${process.env.EMAIL_USER}`);
console.log(
  `EMAIL_APP_PASSWORD: ${
    process.env.EMAIL_APP_PASSWORD ? "✅ Set" : "❌ Not set"
  }`
);
console.log(`ADMIN_EMAIL: ${process.env.ADMIN_EMAIL}`);
console.log(`ADMIN_CC_EMAIL: ${process.env.ADMIN_CC_EMAIL}`);
console.log("");

// Test email configuration
async function testEmailConfig() {
  try {
    console.log("📧 Testing email transporter...");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // Verify transporter
    console.log("🔐 Verifying transporter...");
    await transporter.verify();
    console.log("✅ Transporter verification successful!");

    // Send test email
    console.log("📤 Sending test email...");
    const result = await transporter.sendMail({
      from: `"Solar Express Test" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      cc: process.env.ADMIN_CC_EMAIL,
      subject: "🧪 Email Configuration Test",
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email sent at: ${new Date().toISOString()}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
        <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
        <p><strong>To:</strong> ${process.env.ADMIN_EMAIL}</p>
        <p><strong>CC:</strong> ${process.env.ADMIN_CC_EMAIL}</p>
        <hr>
        <p>If you receive this email, your email configuration is working correctly in production!</p>
      `,
    });

    console.log("✅ Test email sent successfully!");
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log(`📧 Response: ${result.response}`);
  } catch (error) {
    console.error("❌ Email test failed:");
    console.error(`Error type: ${error.constructor.name}`);
    console.error(`Error message: ${error.message}`);
    console.error(`Error code: ${error.code}`);

    if (error.response) {
      console.error(`SMTP Response: ${error.response}`);
    }

    // Specific error suggestions
    if (error.message.includes("Username and Password not accepted")) {
      console.log("\n💡 Possible solutions:");
      console.log("1. Enable 2-Factor Authentication on Gmail");
      console.log("2. Generate an App Password from Google Account settings");
      console.log("3. Use the App Password instead of your regular password");
      console.log(
        "4. Check if EMAIL_APP_PASSWORD is correctly set in production"
      );
    }

    if (error.message.includes("Connection timeout")) {
      console.log("\n💡 Possible solutions:");
      console.log(
        "1. Check if your production server can reach Gmail SMTP (smtp.gmail.com:587)"
      );
      console.log(
        "2. Verify firewall settings allow outbound SMTP connections"
      );
      console.log(
        "3. Try using different SMTP settings (port 465 with secure: true)"
      );
    }
  }
}

// Alternative SMTP configuration test
async function testAlternativeConfig() {
  try {
    console.log("\n📧 Testing alternative SMTP configuration...");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();
    console.log("✅ Alternative configuration works!");
  } catch (error) {
    console.error("❌ Alternative configuration failed:", error.message);
  }
}

// Test with port 465
async function testSecureConfig() {
  try {
    console.log("\n📧 Testing secure SMTP configuration (port 465)...");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true for 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    await transporter.verify();
    console.log("✅ Secure configuration works!");
  } catch (error) {
    console.error("❌ Secure configuration failed:", error.message);
  }
}

// Run all tests
async function runTests() {
  await testEmailConfig();
  await testAlternativeConfig();
  await testSecureConfig();

  console.log("\n🔍 Debug Summary:");
  console.log("================");
  console.log("1. Check the output above for any error messages");
  console.log("2. Verify your Gmail App Password is correct");
  console.log("3. Ensure 2FA is enabled on your Gmail account");
  console.log("4. Check production server firewall settings");
  console.log("5. Verify environment variables are properly set in production");

  process.exit(0);
}

runTests().catch(console.error);
