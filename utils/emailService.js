const nodemailer = require("nodemailer");

// Create transporter for email notifications
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

// Send order notification email to admin
const sendOrderNotificationEmail = async (orderData) => {
  try {
    const transporter = createTransporter();

    const subject = `🚨 New Order Alert - ${orderData.orderNumber}`;
    const htmlContent = generateOrderEmailHTML(orderData);

    const mailOptions = {
      from: `"Solar Express Orders" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      cc: process.env.ADMIN_CC_EMAIL,
      subject: subject,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(
      "✅ Order notification email sent successfully:",
      result.messageId
    );

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending order notification email:", error);
    return { success: false, error: error.message };
  }
};

// Generate HTML template for order notification email
const generateOrderEmailHTML = (orderData) => {
  const { customerInfo, items, totalAmount, orderNumber, createdAt } =
    orderData;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const generateItemsList = () => {
    return items
      .map(
        (item) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">
              <strong>${item.productName || item.name}</strong>
              ${
                item.variant
                  ? `<br><small>Variant: ${item.variant}</small>`
                  : ""
              }
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
              ${item.quantity}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
              ${formatCurrency(item.price)}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
              <strong>${formatCurrency(item.price * item.quantity)}</strong>
            </td>
          </tr>
        `
      )
      .join("");
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #1a5ca4; color: white; padding: 20px; text-align: center; }
        .section { background: #f8f9fa; margin: 20px 0; padding: 20px; border-radius: 8px; }
        .btn { 
          display: inline-block; 
          padding: 12px 20px; 
          background: #f26522; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 5px 0;
        }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #1a5ca4; color: white; padding: 10px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .alert { background: #ffe6e6; border-left: 4px solid #ff4444; padding: 15px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>🚨 NEW ORDER ALERT</h1>
          <p>Order #${orderNumber}</p>
          <p>${new Date(createdAt).toLocaleDateString("en-PK", {
            timeZone: "Asia/Karachi",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}</p>
        </div>

        <!-- Order Summary -->
        <div class="section">
          <h2>📋 Order Summary</h2>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Total Amount:</strong> <span style="color: #f26522; font-size: 1.2em;">${formatCurrency(
            totalAmount
          )}</span></p>
          <p><strong>Status:</strong> <span style="color: #f26522;">Pending Confirmation</span></p>
        </div>

        <!-- Customer Information -->
        <div class="section">
          <h2>👤 Customer Information</h2>
          <p><strong>Name:</strong> ${
            customerInfo.fullName || customerInfo.name
          }</p>
          <p><strong>Phone:</strong> <a href="tel:${
            customerInfo.phoneNumber || customerInfo.mobile
          }">${customerInfo.phoneNumber || customerInfo.mobile}</a></p>
          <p><strong>WhatsApp:</strong> <a href="https://wa.me/${(
            customerInfo.whatsappNumber ||
            customerInfo.whatsapp ||
            customerInfo.mobile
          ).replace(/[^0-9]/g, "")}" target="_blank">${
    customerInfo.whatsappNumber || customerInfo.whatsapp || customerInfo.mobile
  }</a></p>
          ${
            customerInfo.email
              ? `<p><strong>Email:</strong> <a href="mailto:${customerInfo.email}">${customerInfo.email}</a></p>`
              : ""
          }
          <p><strong>Address:</strong><br>${
            customerInfo.shippingAddress || "Address not provided"
          }</p>
          ${
            orderData.orderNotes || orderData.specialInstructions
              ? `
            <div style="background: #fff; padding: 15px; border-radius: 6px; margin-top: 15px;">
              <strong>📝 Special Instructions:</strong><br>
              <em>${orderData.orderNotes || orderData.specialInstructions}</em>
            </div>
          `
              : ""
          }
        </div>

        <!-- Order Items -->
        <div class="section">
          <h2>🛍️ Order Items</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${generateItemsList()}
            </tbody>
            <tfoot>
              <tr style="background: #f8f9fa;">
                <td colspan="3" style="text-align: right; font-weight: bold; padding: 15px;">
                  Grand Total:
                </td>
                <td style="text-align: right; font-weight: bold; font-size: 1.2em; color: #f26522; padding: 15px;">
                  ${formatCurrency(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Action Items -->
        <div class="alert">
          <h3>⚡ Immediate Action Required</h3>
          <ol>
            <li>Confirm product availability</li>
            <li>Contact customer within 2 hours</li>
            <li>Process payment confirmation</li>
            <li>Schedule delivery/pickup</li>
            <li>Update order status in admin panel</li>
          </ol>
        </div>

        <!-- Action Buttons -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/orders/${
    orderData._id
  }" class="btn">
            🔗 View Order in Admin Panel
          </a>
          <br>
          <a href="https://wa.me/${(
            customerInfo.whatsappNumber ||
            customerInfo.whatsapp ||
            customerInfo.mobile
          ).replace(
            /[^0-9]/g,
            ""
          )}" class="btn" style="background: #25d366; margin-left: 10px;">
            💬 Contact Customer on WhatsApp
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #666; border-top: 1px solid #eee;">
          <p>This is an automated notification from Solar Express Order System</p>
          <p>For support, contact: ${process.env.EMAIL_USER}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendOrderNotificationEmail,
};
