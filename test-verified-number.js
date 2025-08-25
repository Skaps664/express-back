#!/usr/bin/env node

require("dotenv").config();
const { sendOrderWhatsAppNotification } = require("./utils/whatsappService");

async function testVerifiedNumber() {
  console.log("🧪 Testing WhatsApp with verified number...");
  console.log("Admin WhatsApp from env:", process.env.ADMIN_WHATSAPP);

  const testOrderData = {
    _id: "TEST-VERIFIED-123",
    orderNumber: "TEST-" + Date.now(),
    customerInfo: {
      fullName: "Test Customer Verified",
      phoneNumber: "+923001234567",
      whatsappNumber: "+923001234567",
      shippingAddress: "Test Address, Karachi, Pakistan",
      email: "test@example.com",
    },
    items: [
      {
        name: "Test Solar Panel",
        quantity: 1,
        price: 25000,
      },
    ],
    totalAmount: 25000,
    createdAt: new Date(),
    paymentMethod: "WhatsApp",
  };

  try {
    const result = await sendOrderWhatsAppNotification(testOrderData);
    console.log("✅ Result:", result);

    if (result.success) {
      console.log("🎉 SUCCESS! WhatsApp notifications are now working!");
      console.log(
        `📱 Check WhatsApp on ${process.env.ADMIN_WHATSAPP} for the test message`
      );
    } else {
      console.log("❌ Still failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testVerifiedNumber();
