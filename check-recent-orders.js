#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");

async function checkRecentOrders() {
  try {
    console.log("🔍 Checking Recent Orders and Notification Status...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Import Order model
    const Order = require("./models/OrderModel");

    // Get the 5 most recent orders
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "orderNumber createdAt customerInfo.fullName totalAmount emailSent adminNotificationSent whatsappSent status"
      );

    console.log("📋 Recent Orders:");
    console.log("================");

    if (recentOrders.length === 0) {
      console.log("No orders found in the database.");
    } else {
      recentOrders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order: ${order.orderNumber || order._id}`);
        console.log(`   Date: ${order.createdAt.toLocaleDateString()}`);
        console.log(`   Customer: ${order.customerInfo?.fullName || "N/A"}`);
        console.log(
          `   Amount: PKR ${order.totalAmount?.toLocaleString() || "N/A"}`
        );
        console.log(`   Status: ${order.status || "N/A"}`);
        console.log(
          `   📧 Email Sent: ${order.emailSent ? "✅ Yes" : "❌ No"}`
        );
        console.log(
          `   📱 WhatsApp Sent: ${order.whatsappSent ? "✅ Yes" : "❌ No"}`
        );
        console.log(
          `   🔔 Admin Notification: ${
            order.adminNotificationSent ? "✅ Yes" : "❌ No"
          }`
        );
      });
    }

    console.log("\n🔧 Environment Variables Status:");
    console.log("================================");
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
    console.log(
      `TWILIO_WHATSAPP_NUMBER: ${
        process.env.TWILIO_WHATSAPP_NUMBER || "❌ Not set"
      }`
    );
    console.log(
      `ADMIN_WHATSAPP: ${process.env.ADMIN_WHATSAPP || "❌ Not set"}`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

checkRecentOrders();
