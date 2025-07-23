const asyncHandler = require("express-async-handler");
const Order = require("../models/OrderModel");
const User = require("../models/UserModel");
const Product = require("../models/ProductsModel");
const validateMongoId = require("../utils/validateMongoId");

// Configure WhatsApp business number here
const WHATSAPP_NUMBER = "923259327819"; // Replace with your business WhatsApp number

/**
 * @desc    Create order and generate WhatsApp link
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
  const { customerInfo, paymentMethod = "WhatsApp", orderNotes } = req.body;
  const userId = req.user._id;

  // Validate customerInfo
  if (
    !customerInfo ||
    !customerInfo.fullName ||
    !customerInfo.phoneNumber ||
    !customerInfo.whatsappNumber ||
    !customerInfo.shippingAddress
  ) {
    res.status(400);
    throw new Error(
      "Customer information is required: Full name, phone number, WhatsApp number, and shipping address"
    );
  }

  // Get user with cart populated
  const user = await User.findById(userId).populate({
    path: "cart.product",
    select: "name price images slug stock",
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check if cart is empty
  if (user.cart.length === 0) {
    res.status(400);
    throw new Error("Your cart is empty");
  }

  // Check stock availability for all items
  for (const item of user.cart) {
    const product = await Product.findById(item.product._id);
    if (!product) {
      res.status(404);
      throw new Error(`Product not found: ${item.name || "Unknown product"}`);
    }

    if (product.stock < item.quantity) {
      res.status(400);
      throw new Error(`Not enough stock available for ${product.name}`);
    }
  }

  // Calculate total amount
  let totalAmount = 0;
  const orderItems = user.cart.map((item) => {
    const price = item.price || item.product.price;
    totalAmount += price * item.quantity;

    return {
      product: item.product._id,
      name: item.name || item.product.name,
      slug: item.product.slug,
      quantity: item.quantity,
      price: price,
      selectedVariant: item.selectedVariant,
      image:
        item.image ||
        (item.product.images && item.product.images.length > 0
          ? item.product.images[0]
          : null),
    };
  });

  // Create order
  const order = new Order({
    user: userId,
    items: orderItems,
    totalAmount,
    customerInfo: {
      fullName: customerInfo.fullName,
      phoneNumber: customerInfo.phoneNumber,
      whatsappNumber: customerInfo.whatsappNumber,
      shippingAddress: customerInfo.shippingAddress,
      email: customerInfo.email || "",
      specialNotes: customerInfo.specialNotes || "",
    },
    paymentMethod: paymentMethod || "WhatsApp",
    orderNotes: orderNotes || customerInfo.specialNotes || "",
    directPurchase: false,
    whatsappPhoneNumber: WHATSAPP_NUMBER,
  });

  // Generate WhatsApp message text
  let messageText = `🛒 *NEW ORDER RECEIVED*\n\n`;
  messageText += `📋 *Order Number:* ${order.orderNumber || "TBD"}\n`;
  messageText += `📅 *Date:* ${new Date().toLocaleDateString()}\n\n`;

  messageText += `👤 *CUSTOMER DETAILS:*\n`;
  messageText += `• Name: ${customerInfo.fullName}\n`;
  messageText += `• Phone: ${customerInfo.phoneNumber}\n`;
  messageText += `• WhatsApp: ${customerInfo.whatsappNumber}\n`;
  messageText += `• Email: ${customerInfo.email || "Not provided"}\n`;
  messageText += `• Address: ${customerInfo.shippingAddress}\n\n`;

  if (customerInfo.specialNotes) {
    messageText += `📝 *SPECIAL NOTES:* ${customerInfo.specialNotes}\n\n`;
  }

  messageText += `🛍️ *ORDER ITEMS:*\n`;
  orderItems.forEach((item, index) => {
    messageText += `${index + 1}. ${item.name}\n`;
    messageText += `   • Quantity: ${item.quantity}\n`;
    messageText += `   • Price: PKR ${item.price.toLocaleString()}\n`;
    if (item.selectedVariant) {
      messageText += `   • Variant: ${item.selectedVariant}\n`;
    }
    messageText += `\n`;
  });

  messageText += `💰 *TOTAL AMOUNT: PKR ${totalAmount.toLocaleString()}*\n\n`;
  messageText += `Thank you for your order! We will contact you soon to confirm payment and delivery details.\n\n`;
  messageText += `🔗 View details: ${process.env.FRONTEND_URL}/admin/orders`;

  // Store the WhatsApp message content in the order
  order.whatsappMessageContent = messageText;

  // Generate WhatsApp URL
  const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    messageText
  )}`;

  // Mark as WhatsApp message sent
  order.whatsappSent = true;
  order.emailSent = false; // We'll implement email later
  await order.save();

  // Clear user's cart
  user.cart = [];
  await user.save();

  res.status(201).json({
    success: true,
    message:
      "Order created successfully! You will be redirected to WhatsApp to complete your order.",
    order: {
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
      customerInfo: order.customerInfo,
    },
    whatsappURL,
    whatsappMessage: messageText,
  });
});

/**
 * @desc    Get user orders
 * @route   GET /api/orders
 * @access  Private
 */
const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "items.product",
      select: "name images slug",
    });

  res.status(200).json({
    success: true,
    orders,
  });
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoId(id);

  const order = await Order.findById(id)
    .populate({
      path: "items.product",
      select: "name images slug",
    })
    .populate({
      path: "user",
      select: "name email mobile",
    });

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if the order belongs to the logged-in user or if the user is an admin
  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("You are not authorized to view this order");
  }

  res.status(200).json({
    success: true,
    order,
  });
});

/**
 * @desc    Update order status (admin only)
 * @route   PUT /api/orders/:id
 * @access  Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus } = req.body;
  validateMongoId(id);

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Update order status
  if (status) {
    order.status = status;

    // If order is confirmed, decrease product stock
    if (status === "Confirmed" && order.status !== "Confirmed") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
      }
    }
  }

  // Update payment status
  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    order,
  });
});

/**
 * @desc    Get all orders (admin only)
 * @route   GET /api/orders/admin
 * @access  Admin
 */
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 }).populate({
    path: "user",
    select: "name email mobile",
  });

  res.status(200).json({
    success: true,
    orders,
  });
});

/**
 * @desc    Generate WhatsApp link for an existing order
 * @route   GET /api/orders/:id/whatsapp
 * @access  Private
 */
const generateWhatsappLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoId(id);

  const order = await Order.findById(id).populate({
    path: "user",
    select: "name email mobile",
  });

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if the order belongs to the logged-in user or if the user is an admin
  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("You are not authorized for this action");
  }

  // Generate WhatsApp message text
  let messageText = `*Order #${order._id}*\n\n`;
  messageText += `*Order Items:*\n`;

  order.items.forEach((item, index) => {
    messageText += `${index + 1}. ${item.name} x ${item.quantity} - PKR ${
      item.price * item.quantity
    }\n`;
    if (item.selectedVariant) {
      messageText += `   Variant: ${item.selectedVariant}\n`;
    }
  });

  messageText += `\n*Total Amount:* PKR ${order.totalAmount}\n\n`;

  if (order.shippingAddress) {
    messageText += `*Shipping Address:*\n`;
    messageText += `${order.shippingAddress.fullName}\n`;
    messageText += `${order.shippingAddress.phoneNumber}\n`;
    messageText += `${order.shippingAddress.street}, ${
      order.shippingAddress.city
    }, ${order.shippingAddress.state || ""} ${
      order.shippingAddress.postalCode
    }\n`;
    messageText += `${order.shippingAddress.country}\n\n`;
  }

  messageText += `*Payment Method:* ${order.paymentMethod}\n`;
  messageText += `*Order Status:* ${order.status}\n\n`;

  if (order.orderNotes) {
    messageText += `*Order Notes:*\n${order.orderNotes}\n\n`;
  }

  messageText += `Thank you for your order! Please send payment details or let us know if you have any questions.`;

  // Generate WhatsApp URL
  const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    messageText
  )}`;

  // Mark as WhatsApp sent
  order.whatsappSent = true;
  await order.save();

  res.status(200).json({
    success: true,
    whatsappURL,
  });
});

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  generateWhatsappLink,
};
