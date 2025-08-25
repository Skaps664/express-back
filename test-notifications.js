#!/usr/bin/env node

// Standalone notification test - doesn't require MongoDB connection
require("dotenv").config({ path: "./.env" });

const { sendOrderNotificationEmail } = require("./utils/emailService");
const whatsappService = require("./utils/whatsappService");

console.log("🧪 Testing Notification System...\n");

// Check configuration
console.log("📋 Configuration Status:");
console.log("Email User:", process.env.EMAIL_USER || "Not configured");
console.log(
  "Email Password:",
  process.env.EMAIL_APP_PASSWORD ? "✅ Configured" : "❌ Not configured"
);
console.log("Admin Email:", process.env.ADMIN_EMAIL || "Not configured");
console.log(
  "Twilio Account SID:",
  process.env.TWILIO_ACCOUNT_SID ? "✅ Configured" : "❌ Not configured"
);
console.log("Admin WhatsApp:", process.env.ADMIN_WHATSAPP || "Not configured");
console.log("");

// Test data for notifications
const testOrderData = {
  _id: "TEST-ORDER-123",
  orderNumber: "ORD-" + Date.now(),
  customerInfo: {
    name: "John Doe",
    email: "customer@example.com",
    mobile: "+923001234567",
    whatsapp: "+923001234567",
    address: {
      street: "123 Test Street",
      city: "Karachi",
      state: "Sindh",
      country: "Pakistan",
      zipCode: "74000",
    },
  },
  items: [
    {
      productName: "Solar Panel 400W",
      variant: "Monocrystalline",
      quantity: 2,
      price: 25000,
    },
    {
      productName: "Solar Inverter 5KW",
      variant: "Pure Sine Wave",
      quantity: 1,
      price: 45000,
    },
  ],
  totalAmount: 95000,
  specialInstructions:
    "Please deliver before evening. Customer prefers daytime delivery.",
  createdAt: new Date(),
};

async function testNotifications() {
  console.log("🧪 Starting notification tests...\n");

  // Test 1: Email Notification
  console.log("📧 Testing Email Notification...");
  try {
    await sendOrderNotificationEmail(testOrderData);
    console.log("✅ Email notification sent successfully!");
  } catch (error) {
    console.log("❌ Email notification failed:", error.message);
  }
  console.log("");

  // Test 2: WhatsApp Notification
  console.log("📱 Testing WhatsApp Notification...");
  try {
    await whatsappService.sendOrderWhatsAppNotification(testOrderData);
    console.log("✅ WhatsApp notification sent successfully!");
  } catch (error) {
    console.log("❌ WhatsApp notification failed:", error.message);
  }
  console.log("");

  console.log("🎉 Notification tests completed!");
  console.log("📧 Check your email at:", process.env.ADMIN_EMAIL);
  console.log("📱 Check your WhatsApp at:", process.env.ADMIN_WHATSAPP);
}

// Run the tests
testNotifications().catch(console.error);
