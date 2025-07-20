const asyncHandler = require("express-async-handler");
const Product = require("../models/ProductsModel");
const Order = require("../models/OrderModel");
const validateMongoId = require("../utils/validateMongoId");

// Configure WhatsApp business number here
const WHATSAPP_NUMBER = "923001234567"; // Replace with your business WhatsApp number

/**
 * @desc    Create direct order from product (Buy Now feature)
 * @route   POST /api/orders/direct
 * @access  Private
 */
const createDirectOrder = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, selectedVariant = null } = req.body;
  const userId = req.user._id;

  // Validate product ID
  validateMongoId(productId);

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Check stock availability
  if (product.stock < quantity) {
    res.status(400);
    throw new Error("Not enough stock available");
  }

  // Calculate total amount
  const totalAmount = product.price * quantity;

  // Create order item
  const orderItem = {
    product: product._id,
    name: product.name,
    slug: product.slug,
    quantity: quantity,
    price: product.price,
    selectedVariant: selectedVariant,
    image:
      product.images && product.images.length > 0 ? product.images[0] : null,
  };

  // Generate WhatsApp message text
  let messageText = `*New Order #${Math.floor(
    Date.now() / 1000
  ).toString()}*\n\n`;
  messageText += `*Product:* ${product.name}\n`;
  messageText += `*Quantity:* ${quantity}\n`;

  if (selectedVariant) {
    messageText += `*Variant:* ${selectedVariant}\n`;
  }

  messageText += `*Price:* PKR ${product.price} × ${quantity} = PKR ${totalAmount}\n\n`;
  messageText += `Thank you for your order! Please send payment details or let us know if you have any questions.`;

  // Create order
  const order = new Order({
    user: userId,
    items: [orderItem],
    totalAmount,
    paymentMethod: "WhatsApp",
    directPurchase: true,
    whatsappMessageContent: messageText,
    whatsappPhoneNumber: WHATSAPP_NUMBER,
  });

  // Save order
  await order.save();

  // Generate WhatsApp URL with the saved message
  const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    messageText.replace(/\n/g, "\\n") // Convert newlines to WhatsApp format
  )}`;

  // Update the order with WhatsApp info
  order.whatsappSent = true;
  await order.save();

  res.status(201).json({
    success: true,
    message: "Direct order created successfully",
    order,
    whatsappURL,
  });
});

module.exports = { createDirectOrder };
