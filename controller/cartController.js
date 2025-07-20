const asyncHandler = require("express-async-handler");
const User = require("../models/UserModel");
const Product = require("../models/ProductsModel");
const validateMongoId = require("../utils/validateMongoId");

/**
 * @desc    Add item to cart
 * @route   POST /api/cart
 * @access  Private
 */
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, selectedVariant = null } = req.body;
  const userId = req.user._id;

  // Validate product ID
  try {
    validateMongoId(productId);
  } catch (error) {
    res.status(400);
    throw new Error(`Invalid product ID format: ${productId}`);
  }

  // Find the product
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error(`Product not found with ID: ${productId}`);
  }

  // Check stock availability
  if (product.stock < quantity) {
    res.status(400);
    throw new Error("Not enough stock available");
  }

  // Get user with cart populated
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check if product is already in cart
  const cartItemIndex = user.cart.findIndex(
    (item) => item.product.toString() === productId
  );

  if (cartItemIndex > -1) {
    // Update quantity if product exists in cart
    user.cart[cartItemIndex].quantity = quantity;
    user.cart[cartItemIndex].selectedVariant =
      selectedVariant || user.cart[cartItemIndex].selectedVariant;
  } else {
    // Add new item to cart
    user.cart.push({
      product: productId,
      quantity,
      selectedVariant,
      price: product.price,
      name: product.name,
      image:
        product.images && product.images.length > 0 ? product.images[0] : null,
    });
  }

  // Save user with updated cart
  await user.save();

  // Populate product details in cart
  const populatedUser = await User.findById(userId).populate({
    path: "cart.product",
    select: "name price images slug stock brand category warranty",
    populate: {
      path: "brand",
      select: "name slug",
    },
  });

  // Calculate cart total
  let cartTotal = 0;
  populatedUser.cart.forEach((item) => {
    cartTotal += (item.price || item.product.price) * item.quantity;
  });

  res.status(200).json({
    success: true,
    message: "Product added to cart successfully",
    cart: populatedUser.cart,
    cartTotal,
  });
});

/**
 * @desc    Get user cart
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get user with cart populated
  const user = await User.findById(userId).populate({
    path: "cart.product",
    select: "name price images slug stock brand category warranty",
    populate: {
      path: "brand",
      select: "name slug",
    },
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Calculate cart totals
  let cartTotal = 0;
  user.cart.forEach((item) => {
    cartTotal += (item.price || item.product.price) * item.quantity;
  });

  res.status(200).json({
    success: true,
    cart: user.cart,
    cartTotal,
  });
});

/**
 * @desc    Update cart item quantity
 * @route   PUT /api/cart/:itemId
 * @access  Private
 */
const updateCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  const userId = req.user._id;

  // Validate cart item ID
  try {
    validateMongoId(itemId);
  } catch (error) {
    res.status(400);
    throw new Error(`Invalid cart item ID format: ${itemId}`);
  }

  // Validate quantity
  if (!quantity || quantity < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
  }

  // Find user and update cart item
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Find the cart item
  const cartItemIndex = user.cart.findIndex(
    (item) => item._id.toString() === itemId
  );

  if (cartItemIndex === -1) {
    res.status(404);
    throw new Error("Cart item not found");
  }

  // Get product to check stock
  const product = await Product.findById(user.cart[cartItemIndex].product);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Check stock availability
  if (product.stock < quantity) {
    res.status(400);
    throw new Error("Not enough stock available");
  }

  // Update quantity
  user.cart[cartItemIndex].quantity = quantity;

  // Save user with updated cart
  await user.save();

  // Return updated cart
  const updatedUser = await User.findById(userId).populate({
    path: "cart.product",
    select: "name price images slug stock brand category warranty",
    populate: {
      path: "brand",
      select: "name slug",
    },
  });

  // Calculate cart totals
  let cartTotal = 0;
  updatedUser.cart.forEach((item) => {
    cartTotal += (item.price || item.product.price) * item.quantity;
  });

  res.status(200).json({
    success: true,
    message: "Cart updated successfully",
    cart: updatedUser.cart,
    cartTotal,
  });
});

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/:itemId
 * @access  Private
 */
const removeCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id;

  // Validate cart item ID
  try {
    validateMongoId(itemId);
  } catch (error) {
    res.status(400);
    throw new Error(`Invalid cart item ID format: ${itemId}`);
  }

  // Find user and update cart
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Remove item from cart
  user.cart = user.cart.filter((item) => item._id.toString() !== itemId);

  // Save user with updated cart
  await user.save();

  // Return updated cart
  const updatedUser = await User.findById(userId).populate({
    path: "cart.product",
    select: "name price images slug stock brand category warranty",
    populate: {
      path: "brand",
      select: "name slug",
    },
  });

  // Calculate cart totals
  let cartTotal = 0;
  updatedUser.cart.forEach((item) => {
    cartTotal += (item.price || item.product.price) * item.quantity;
  });

  res.status(200).json({
    success: true,
    message: "Item removed from cart successfully",
    cart: updatedUser.cart,
    cartTotal,
  });
});

/**
 * @desc    Clear the entire cart
 * @route   DELETE /api/cart
 * @access  Private
 */
const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find user and clear cart
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.cart = [];
  await user.save();

  res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
    cart: [],
    cartTotal: 0,
  });
});

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
