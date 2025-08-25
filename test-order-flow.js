#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");

async function testOrderFlow() {
  try {
    console.log("🧪 Testing Order Flow with Notifications...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Import required models and services
    const Order = require("./models/OrderModel");
    const { sendOrderNotificationEmail } = require("./utils/emailService");
    const {
      sendOrderWhatsAppNotification,
    } = require("./utils/whatsappService");

    // Create a test order data similar to what the controller creates
    const testOrderData = {
      user: new mongoose.Types.ObjectId(),
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          name: "Test Solar Panel 400W",
          slug: "test-solar-panel-400w",
          quantity: 2,
          price: 25000,
          selectedVariant: "Monocrystalline",
        },
      ],
      totalAmount: 50000,
      customerInfo: {
        fullName: "Test Customer",
        phoneNumber: "+923001234567",
        whatsappNumber: "+923001234567",
        shippingAddress: "123 Test Street, Karachi, Pakistan",
        email: "test@example.com",
        specialNotes: "This is a test order for debugging",
      },
      paymentMethod: "WhatsApp",
      orderNotes: "Test order for notification debugging",
      directPurchase: false,
      whatsappPhoneNumber: "923259327819",
    };

    // Create and save the order
    const order = new Order(testOrderData);
    await order.save();
    console.log("✅ Test order created:", order.orderNumber || order._id);

    // Test the exact same notification flow as in the controller
    console.log("\n📧 Testing email notification...");
    try {
      const emailResult = await sendOrderNotificationEmail({
        ...order.toObject(),
        customerInfo: testOrderData.customerInfo,
        items: testOrderData.items,
        totalAmount: testOrderData.totalAmount,
        orderNumber: order.orderNumber || order._id,
        createdAt: order.createdAt,
      });
      console.log("Email result:", emailResult);
    } catch (emailError) {
      console.error("❌ Email error:", emailError.message);
    }

    console.log("\n📱 Testing WhatsApp notification...");
    try {
      const whatsappResult = await sendOrderWhatsAppNotification({
        ...order.toObject(),
        customerInfo: testOrderData.customerInfo,
        items: testOrderData.items,
        totalAmount: testOrderData.totalAmount,
        orderNumber: order.orderNumber || order._id,
        createdAt: order.createdAt,
      });
      console.log("WhatsApp result:", whatsappResult);
    } catch (whatsappError) {
      console.error("❌ WhatsApp error:", whatsappError.message);
    }

    // Clean up - delete the test order
    await Order.deleteOne({ _id: order._id });
    console.log("\n🧹 Test order cleaned up");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

testOrderFlow();
