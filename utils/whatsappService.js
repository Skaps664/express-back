const axios = require("axios");

/**
 * Send WhatsApp notification to admin using Twilio WhatsApp API
 * @param {Object} orderData - Order details
 */
const sendWhatsAppNotification = async (orderData) => {
  try {
    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log(
        "⚠️ Twilio credentials not configured, skipping WhatsApp notification"
      );
      return { success: false, error: "Twilio credentials not configured" };
    }

    const message = generateWhatsAppMessage(orderData);
    const adminWhatsApp =
      process.env.ADMIN_WHATSAPP ||
      process.env.WHATSAPP_NUMBER ||
      "923259327819";

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      new URLSearchParams({
        From: `whatsapp:${
          process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886"
        }`, // Twilio WhatsApp number
        To: `whatsapp:+${adminWhatsApp.replace(/[^0-9]/g, "")}`, // Your business WhatsApp
        Body: message,
      }),
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log(
      "✅ WhatsApp notification sent successfully:",
      response.data.sid
    );
    return { success: true, sid: response.data.sid };
  } catch (error) {
    console.error(
      "❌ Error sending WhatsApp notification:",
      error.response?.data || error.message
    );
    return { success: false, error: error.response?.data || error.message };
  }
};

/**
 * Generate WhatsApp message content for order notification
 * @param {Object} orderData - Order details
 */
const generateWhatsAppMessage = (orderData) => {
  const {
    customerInfo,
    items,
    totalAmount,
    orderNumber,
    createdAt,
    paymentMethod,
    orderNotes,
  } = orderData;

  let message = `🚨 *NEW ORDER ALERT* 🚨\n\n`;
  message += `📋 *Order #${orderNumber}*\n`;
  message += `📅 ${new Date(createdAt).toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}\n\n`;

  message += `👤 *CUSTOMER DETAILS:*\n`;
  message += `• Name: ${customerInfo.name || customerInfo.fullName}\n`;
  message += `• Phone: ${customerInfo.mobile || customerInfo.phoneNumber}\n`;
  message += `• WhatsApp: ${
    customerInfo.whatsapp || customerInfo.whatsappNumber || customerInfo.mobile
  }\n`;
  if (customerInfo.email) {
    message += `• Email: ${customerInfo.email}\n`;
  }
  message += `• Address: ${customerInfo.shippingAddress}\n\n`;

  if (customerInfo.specialNotes) {
    message += `📝 *Special Notes:* ${customerInfo.specialNotes}\n\n`;
  }

  message += `🛍️ *ORDER ITEMS (${items.length} item${
    items.length > 1 ? "s" : ""
  }):*\n`;
  items.forEach((item, index) => {
    message += `${index + 1}. *${item.name}*\n`;
    message += `   • Qty: ${item.quantity}\n`;
    message += `   • Price: PKR ${item.price.toLocaleString()}\n`;
    if (item.selectedVariant) {
      message += `   • Variant: ${item.selectedVariant}\n`;
    }
    message += `   • Subtotal: PKR ${(
      item.price * item.quantity
    ).toLocaleString()}\n\n`;
  });

  message += `💰 *TOTAL: PKR ${totalAmount.toLocaleString()}*\n`;
  message += `💳 Payment: ${paymentMethod || "WhatsApp"}\n\n`;

  if (orderNotes) {
    message += `📋 *Order Notes:* ${orderNotes}\n\n`;
  }

  message += `⚡ *ACTIONS NEEDED:*\n`;
  message += `✅ Confirm stock\n`;
  message += `📞 Contact customer\n`;
  message += `📦 Prepare items\n`;
  message += `🚚 Arrange delivery\n\n`;

  message += `🔗 View: ${process.env.FRONTEND_URL}/admin/orders/${orderData._id}\n\n`;
  message += `_Generated by Solar Express System_`;

  return message;
};

/**
 * Alternative method using CallMeBot API (No registration required)
 * @param {Object} orderData - Order details
 */
const sendWhatsAppViaCallMeBot = async (orderData) => {
  try {
    // This requires you to add the CallMeBot number to your WhatsApp contacts first
    // Send "I allow callmebot to send me messages" to +34 644 84 71 89

    if (!process.env.CALLMEBOT_API_KEY) {
      console.log("⚠️ CallMeBot API key not configured");
      return { success: false, error: "CallMeBot API key not configured" };
    }

    const message = generateWhatsAppMessage(orderData);
    const adminPhone = process.env.ADMIN_WHATSAPP || "923259327819";

    const response = await axios.get(`https://api.callmebot.com/whatsapp.php`, {
      params: {
        phone: adminPhone.replace(/[^0-9]/g, ""),
        text: message,
        apikey: process.env.CALLMEBOT_API_KEY,
      },
    });

    console.log("✅ WhatsApp sent via CallMeBot:", response.data);
    return { success: true, response: response.data };
  } catch (error) {
    console.error("❌ CallMeBot WhatsApp error:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send WhatsApp notification with fallback methods
 * @param {Object} orderData - Order details
 */
const sendOrderWhatsAppNotification = async (orderData) => {
  // Try Twilio first (most reliable)
  const twilioResult = await sendWhatsAppNotification(orderData);

  if (twilioResult.success) {
    return twilioResult;
  }

  // Fallback to CallMeBot if Twilio fails
  console.log("Trying CallMeBot as fallback...");
  return await sendWhatsAppViaCallMeBot(orderData);
};

module.exports = {
  sendOrderWhatsAppNotification,
  sendWhatsAppNotification,
  sendWhatsAppViaCallMeBot,
  generateWhatsAppMessage,
};
