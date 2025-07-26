const express = require("express");
const router = express.Router();
const {
  sendOrderNotificationEmail,
  sendTestEmail,
} = require("../utils/emailService");
const { sendOrderWhatsAppNotification } = require("../utils/whatsappService");

/**
 * @desc    Test email notification system
 * @route   POST /api/test/email
 * @access  Private (Admin only)
 */
router.post("/email", async (req, res) => {
  try {
    const result = await sendTestEmail();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Test email sent successfully!",
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send test email",
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error.message,
    });
  }
});

/**
 * @desc    Test order notification system
 * @route   POST /api/test/order-notification
 * @access  Private (Admin only)
 */
router.post("/order-notification", async (req, res) => {
  try {
    // Create mock order data for testing
    const mockOrderData = {
      _id: "507f1f77bcf86cd799439011",
      orderNumber: "TEST-" + Date.now(),
      totalAmount: 125000,
      createdAt: new Date(),
      paymentMethod: "WhatsApp",
      orderNotes: "This is a test order for notification system verification",
      customerInfo: {
        fullName: "Test Customer",
        phoneNumber: "03123456789",
        whatsappNumber: "923123456789",
        email: "test@example.com",
        shippingAddress: "Test Address, Karachi, Pakistan",
        specialNotes: "This is a test order - please do not process",
      },
      items: [
        {
          name: "Test Solar Panel 500W",
          quantity: 2,
          price: 50000,
          selectedVariant: "Monocrystalline",
          product: { slug: "test-solar-panel" },
        },
        {
          name: "Test Inverter 1000W",
          quantity: 1,
          price: 25000,
          selectedVariant: "MPPT",
          product: { slug: "test-inverter" },
        },
      ],
    };

    // Test both email and WhatsApp notifications
    const [emailResult, whatsappResult] = await Promise.allSettled([
      sendOrderNotificationEmail(mockOrderData),
      sendOrderWhatsAppNotification(mockOrderData),
    ]);

    res.status(200).json({
      success: true,
      message: "Notification test completed",
      results: {
        email: {
          status: emailResult.status,
          success:
            emailResult.status === "fulfilled"
              ? emailResult.value.success
              : false,
          error:
            emailResult.status === "rejected"
              ? emailResult.reason.message
              : emailResult.status === "fulfilled" && !emailResult.value.success
              ? emailResult.value.error
              : null,
        },
        whatsapp: {
          status: whatsappResult.status,
          success:
            whatsappResult.status === "fulfilled"
              ? whatsappResult.value.success
              : false,
          error:
            whatsappResult.status === "rejected"
              ? whatsappResult.reason.message
              : whatsappResult.status === "fulfilled" &&
                !whatsappResult.value.success
              ? whatsappResult.value.error
              : null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Notification test failed",
      error: error.message,
    });
  }
});

/**
 * @desc    Check notification configuration
 * @route   GET /api/test/config
 * @access  Private (Admin only)
 */
router.get("/config", (req, res) => {
  const config = {
    email: {
      configured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
      user: process.env.EMAIL_USER || "Not configured",
      adminEmail: process.env.ADMIN_EMAIL || "Not configured",
    },
    whatsapp: {
      twilio: {
        configured: !!(
          process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ),
        accountSid: process.env.TWILIO_ACCOUNT_SID
          ? "***configured***"
          : "Not configured",
      },
      callmebot: {
        configured: !!process.env.CALLMEBOT_API_KEY,
        apiKey: process.env.CALLMEBOT_API_KEY
          ? "***configured***"
          : "Not configured",
      },
      adminNumber:
        process.env.ADMIN_WHATSAPP ||
        process.env.WHATSAPP_NUMBER ||
        "Not configured",
    },
    frontend: {
      url: process.env.FRONTEND_URL || "Not configured",
    },
  };

  res.status(200).json({
    success: true,
    message: "Notification configuration status",
    config,
  });
});

module.exports = router;
