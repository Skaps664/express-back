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

  // Save the order first to get the orderNumber
  await order.save();

  // Generate WhatsApp message text with proper formatting AFTER saving
  let messageText = `🛒 NEW ORDER RECEIVED!\n\n`;
  messageText += `📋 Order Number: ${order.orderNumber || order._id}\n`;
  messageText += `📅 Date: ${new Date().toLocaleDateString()}\n\n`;

  messageText += `👤 CUSTOMER DETAILS:\n`;
  messageText += `• Name: ${customerInfo.fullName}\n`;
  messageText += `• Phone: ${customerInfo.phoneNumber}\n`;
  messageText += `• WhatsApp: ${customerInfo.whatsappNumber}\n`;
  messageText += `• Email: ${customerInfo.email || "Not provided"}\n`;
  messageText += `• Address: ${customerInfo.shippingAddress}\n\n`;

  if (customerInfo.specialNotes) {
    messageText += `📝 SPECIAL NOTES: ${customerInfo.specialNotes}\n\n`;
  }

  messageText += `🛍️ ORDER ITEMS:\n`;
  orderItems.forEach((item, index) => {
    messageText += `${index + 1}. ${item.name}\n`;
    messageText += `   • Quantity: ${item.quantity}\n`;
    messageText += `   • Price: PKR ${item.price.toLocaleString()}\n`;
    if (item.selectedVariant) {
      messageText += `   • Variant: ${item.selectedVariant}\n`;
    }
    messageText += `\n`;
  });

  messageText += `💰 TOTAL AMOUNT: PKR ${totalAmount.toLocaleString()}\n\n`;
  messageText += `Thank you for your order! We will contact you soon to confirm payment and delivery details.\n\n`;
  messageText += `🔗 View details: ${process.env.FRONTEND_URL}/admin/orders`;

  // Store the WhatsApp message content in the order
  order.whatsappMessageContent = messageText;

  // Generate WhatsApp URL
  const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    messageText
  )}`;

  // Mark as WhatsApp message sent and save again with updated message
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
 * @route   GET /api/orders/admin/all
 * @access  Admin
 */
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;

  let query = {};
  if (status && status !== "all") {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "user",
      select: "name email mobile role createdAt",
    })
    .populate({
      path: "items.product",
      select: "name images slug",
    });

  const totalOrders = await Order.countDocuments(query);

  // Get order statistics
  const statusCounts = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = {
    total: totalOrders,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    ...statusCounts.reduce((acc, stat) => {
      acc[stat._id.toLowerCase()] = stat.count;
      return acc;
    }, {}),
  };

  res.status(200).json({
    success: true,
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalOrders,
      pages: Math.ceil(totalOrders / parseInt(limit)),
    },
    stats,
  });
});

/**
 * @desc    Export orders to CSV (admin only)
 * @route   GET /api/orders/admin/export
 * @access  Admin
 */
const exportOrders = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;

  let query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: "user",
      select: "name email mobile",
    })
    .populate({
      path: "items.product",
      select: "name",
    });

  // Convert to CSV format
  const csvHeader = [
    "Order Number",
    "Date",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Customer WhatsApp",
    "Logged User Name",
    "Logged User Email",
    "Items",
    "Total Amount",
    "Status",
    "Payment Status",
    "Shipping Address",
    "Special Notes",
  ].join(",");

  const csvRows = orders.map((order) => {
    const itemsText = order.items
      .map((item) => `${item.name} (${item.quantity}x PKR ${item.price})`)
      .join("; ");

    return [
      order.orderNumber || order._id,
      new Date(order.createdAt).toLocaleDateString(),
      order.customerInfo?.fullName || "",
      order.customerInfo?.email || "",
      order.customerInfo?.phoneNumber || "",
      order.customerInfo?.whatsappNumber || "",
      order.user?.name || "",
      order.user?.email || "",
      `"${itemsText}"`,
      order.totalAmount || 0,
      order.status || "Pending",
      order.paymentStatus || "Pending",
      `"${order.customerInfo?.shippingAddress || ""}"`,
      `"${order.customerInfo?.specialNotes || order.orderNotes || ""}"`,
    ].join(",");
  });

  const csvContent = [csvHeader, ...csvRows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=orders-${new Date().toISOString().split("T")[0]}.csv`
  );
  res.send(csvContent);
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
  exportOrders,
  generateWhatsappLink,
};
