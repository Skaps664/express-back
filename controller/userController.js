const Product = require("../models/ProductsModel");
const User = require("../models/UserModel");
const { generateToken } = require("../config/jwtToken");
const { generateRefreshToken } = require("../config/refreshToken");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

// CREATE USER
const createUser = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Optimized query with field selection and timeout
  const findUser = await User.findOne({ email })
    .select("_id email")
    .lean()
    .maxTimeMS(5000);

  if (!findUser) {
    const newUser = await User.create(req.body);

    // Generate tokens for immediate authentication after registration
    const refreshToken = await generateRefreshToken(newUser._id);
    await updateUserRefreshToken(newUser._id, refreshToken);

    // Set the same cookie settings as login
    const isProduction = process.env.NODE_ENV === "production";
    const isLocal =
      !isProduction || process.env.FRONTEND_URL?.includes("localhost");

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction && !isLocal,
      sameSite: isLocal ? "lax" : isProduction ? "none" : "lax",
      path: "/",
      domain: isLocal ? undefined : process.env.COOKIE_DOMAIN,
    };

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days
    });

    res.cookie("accessToken", generateToken(newUser._id), {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        isAdmin: newUser.isAdmin,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      token: generateToken(newUser._id),
    });
  } else {
    return res.status(409).json({
      success: false,
      message: "User is already registered",
    });
  }
});

// LOGIN USER
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Optimized query with specific field selection and compound index usage
  const findUser = await User.findOne({
    email: email.toLowerCase().trim(),
    isBlocked: false,
  })
    .select("_id name email mobile password isAdmin createdAt updatedAt")
    .maxTimeMS(8000);

  if (!findUser) {
    return res.status(401).json({
      success: false,
      message: "User not found",
    });
  }

  if (!(await findUser.isPasswordMatched(password))) {
    return res.status(401).json({
      success: false,
      message: "Incorrect password",
    });
  }

  const refreshToken = await generateRefreshToken(findUser._id);

  // Optimized update with specific field selection and error handling
  try {
    const updateResult = await User.findByIdAndUpdate(
      findUser._id,
      { refreshToken: refreshToken },
      { new: false, select: "_id" }
    ).maxTimeMS(5000);

    if (!updateResult) {
      console.error("❌ Failed to update user with refresh token");
      return res.status(500).json({
        success: false,
        message: "Login failed - could not save session",
      });
    }

    console.log(
      "✅ Refresh token stored successfully for user:",
      findUser.email
    );
  } catch (updateError) {
    console.error("❌ Database update error:", updateError.message);
    return res.status(500).json({
      success: false,
      message: "Login failed - database error",
    });
  }

  // Production-friendly cookie settings with local development support
  const isProduction = process.env.NODE_ENV === "production";
  const isLocal =
    !isProduction || process.env.FRONTEND_URL?.includes("localhost");

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction && !isLocal, // Only secure in production, not for localhost
    sameSite: isLocal ? "lax" : isProduction ? "none" : "lax", // Lax for localhost
    path: "/",
    domain: isLocal ? undefined : process.env.COOKIE_DOMAIN, // No domain for localhost
  };

  console.log("🍪 Cookie settings:", { isProduction, isLocal, cookieOptions });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days
  });

  res.cookie("accessToken", generateToken(findUser._id), {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    _id: findUser._id,
    name: findUser.name,
    email: findUser.email,
    mobile: findUser.mobile,
    isAdmin: findUser.isAdmin,
    token: generateToken(findUser._id),
    createdAt: findUser.createdAt,
    updatedAt: findUser.updatedAt,
  });
});

// REFRESH TOKEN
const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  const refreshToken = cookie.refreshToken;

  // Optimized query with field selection and timeout
  const user = await User.findOne({ refreshToken })
    .select("_id name email mobile isAdmin isBlocked")
    .maxTimeMS(5000);

  if (!user) {
    return res.status(403).json({
      success: false,
      message: "Refresh token not found, please login again",
    });
  }

  if (user.isBlocked) {
    return res.status(403).json({
      success: false,
      message: "User account is blocked",
    });
  }

  jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
    if (user._id.toString() !== decoded.id) {
      return res.status(403).json({
        success: false,
        message: "User ID mismatch in refresh token",
      });
    }

    const newAccessToken = generateToken(user._id);

    // Set the new access token cookie with consistent settings
    const isProduction = process.env.NODE_ENV === "production";
    const isLocal =
      !isProduction || process.env.FRONTEND_URL?.includes("localhost");

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProduction && !isLocal,
      sameSite: isLocal ? "lax" : isProduction ? "none" : "lax",
      path: "/",
      domain: isLocal ? undefined : process.env.COOKIE_DOMAIN,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        isAdmin: user.isAdmin,
      },
    });
  });
});

// LOGOUT USER
const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  // Optimized logout with timeout
  await User.findOneAndUpdate(
    { refreshToken },
    { refreshToken: "" },
    { maxTimeMS: 5000 }
  );

  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
  };

  res.clearCookie("refreshToken", cookieOptions);
  res.clearCookie("accessToken", cookieOptions);

  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

// REFRESH ACCESS TOKEN
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);

    const user = await User.findById(decoded.id)
      .select("_id name email mobile isAdmin role isBlocked refreshToken")
      .maxTimeMS(5000);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked",
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(user._id);

    // Set cookie
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
    };

    res.cookie("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        isAdmin: user.isAdmin || user.role === "admin",
        role: user.role || (user.isAdmin ? "admin" : "user"),
      },
      token: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
});

// GET ALL USERS
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  return res.status(200).json({
    success: true,
    data: users,
  });
});

// GET SINGLE USER
const getSingleUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    return res.status(200).json({
      success: true,
      data: user,
    });
  } else {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
});

// DELETE USER
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (user) {
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } else {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
});

// UPDATE USER
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    return res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } else {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
});

// BLOCK USER
const blockUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: true },
    { new: true }
  );
  if (user) {
    return res.status(200).json({
      success: true,
      message: "User blocked successfully",
    });
  } else {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
});

// UNBLOCK USER
const unBlockUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: false },
    { new: true }
  );
  if (user) {
    return res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } else {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
});

// GET CURRENT USER
const getCurrentUser = asyncHandler(async (req, res) => {
  // User is already loaded in authMiddleware, just return it
  if (!req.user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Fetch complete user data including isAdmin status
  const completeUser = await User.findById(req.user._id)
    .select("_id name email mobile isAdmin role isBlocked createdAt updatedAt")
    .maxTimeMS(5000);

  if (!completeUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Ensure isAdmin is properly set based on role for backward compatibility
  const userData = {
    _id: completeUser._id,
    name: completeUser.name,
    email: completeUser.email,
    mobile: completeUser.mobile,
    isAdmin: completeUser.isAdmin || completeUser.role === "admin",
    role: completeUser.role || (completeUser.isAdmin ? "admin" : "user"),
    isBlocked: completeUser.isBlocked,
    createdAt: completeUser.createdAt,
    updatedAt: completeUser.updatedAt,
  };

  res.json({
    success: true,
    user: userData,
  });
});

// GET USER'S CART
const getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: "cart.product",
      select: "name price images slug variants",
    })
    .select("cart")
    .maxTimeMS(8000);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({ success: true, cart: user.cart });
});

// ADD PRODUCT TO CART
const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, quantity = 1, label } = req.body;

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  // Find user
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  // Check if product (with variant) already in cart
  const existing = user.cart.find(
    (item) =>
      item.product.toString() === productId &&
      (label ? item.label === label : true)
  );

  if (existing) {
    // Update quantity
    existing.quantity += quantity;
  } else {
    user.cart.push({ product: productId, quantity, label });
  }

  await user.save();

  // Fetch user again and populate product details
  const populatedUser = await User.findById(userId).populate({
    path: "cart.product",
    select: "name price images slug variants",
  });

  res.json({ success: true, cart: populatedUser.cart });
});

// UPDATE CART ITEM
const updateCartItem = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { cartItemId, quantity, selectedVariant } = req.body;

  const item = user.cart.id(cartItemId);
  if (!item) return res.status(404).json({ message: "Cart item not found" });

  if (quantity !== undefined) item.quantity = quantity;
  if (selectedVariant !== undefined) item.selectedVariant = selectedVariant;

  await user.save();

  // Fetch user again and populate product details
  const populatedUser = await User.findById(req.user._id).populate({
    path: "cart.product",
    select: "name price images slug variants",
  });

  res.json({ success: true, cart: populatedUser.cart });
});

// REMOVE ITEM FROM CART
const removeFromCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { cartItemId } = req.body;

  user.cart = user.cart.filter((item) => item._id.toString() !== cartItemId);
  await user.save();

  // Fetch user again and populate product details
  const populatedUser = await User.findById(req.user._id).populate({
    path: "cart.product",
    select: "name price images slug variants",
  });

  res.json({ success: true, cart: populatedUser.cart });
});

// GET USER STATISTICS
const getUserStats = asyncHandler(async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isBlocked: false });
    const blockedUsers = await User.countDocuments({ isBlocked: true });

    // For flagged users, we'll use users who have no orders or very low activity
    // This is a simple heuristic - you can implement more sophisticated flagging logic
    const recentUsers = await User.find({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
    });

    const flaggedUsers = recentUsers.filter(
      (user) => user.cart.length === 0 && user.wishlist.length === 0
    ).length;

    return res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
        flagged: flaggedUsers,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
});

// GET USERS WITH FILTERING AND PAGINATION
const getUsersAdmin = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query based on status filter
    let query = {};

    if (status === "active") {
      query.isBlocked = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    } else if (status === "flagged") {
      // Simple flagging logic - users with no cart/wishlist items
      const flaggedUserIds = await User.find({
        $and: [
          { "cart.0": { $exists: false } },
          { "wishlist.0": { $exists: false } },
          {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        ],
      }).select("_id");
      query._id = { $in: flaggedUserIds.map((u) => u._id) };
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select("-password -refreshToken")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("wishlist", "name price")
      .populate("cart.product", "name price");

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    // Add computed fields for each user
    const usersWithStats = users.map((user) => {
      const userObj = user.toObject();
      return {
        ...userObj,
        totalOrders: 0, // You'll need to implement order tracking
        totalSpent: 0, // You'll need to implement order tracking
        accountType: user.role === "admin" ? "admin" : "individual",
        status: user.isBlocked ? "blocked" : "active",
        lastLogin: userObj.updatedAt, // Using updatedAt as proxy for last login
        verificationStatus: "verified", // You can implement verification logic
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
});

// GET USER PROFILE WITH DETAILED INFO
const getUserProfile = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -refreshToken")
      .populate("wishlist", "name price images")
      .populate("cart.product", "name price images");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Add computed fields
    const userProfile = {
      ...user.toObject(),
      totalOrders: 0, // You'll need to implement order tracking
      totalSpent: 0, // You'll need to implement order tracking
      accountType: user.role === "admin" ? "admin" : "individual",
      status: user.isBlocked ? "blocked" : "active",
      lastLogin: user.updatedAt,
      verificationStatus: "verified",
      cartValue: user.cart.reduce((total, item) => {
        return total + (item.product?.price || 0) * item.quantity;
      }, 0),
      wishlistValue: user.wishlist.reduce((total, item) => {
        return total + (item.price || 0);
      }, 0),
    };

    return res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching user profile",
      error: error.message,
    });
  }
});

/**
 * Record a purchase in the user's purchase history
 * To be called after successful order processing
 */
const recordPurchase = asyncHandler(async (req, res) => {
  const { orderId, items } = req.body;
  const userId = req.user?._id;

  if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Order ID and items array are required",
    });
  }

  try {
    // Validate that all products exist
    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more products do not exist",
      });
    }

    // Create purchase history entries
    const purchaseHistory = items.map((item) => ({
      product: item.productId,
      purchaseDate: new Date(),
      quantity: item.quantity || 1,
      variant: item.variant || null,
      orderReference: orderId,
      price: item.price,
      hasReviewed: false,
    }));

    // Add to user's purchase history
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: { purchaseHistory: { $each: purchaseHistory } },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Purchase recorded successfully",
    });
  } catch (error) {
    console.error("Error recording purchase:", error);
    res.status(500).json({
      success: false,
      message: "Error recording purchase",
      error: error.message,
    });
  }
});

/**
 * Get user's purchase history
 */
const getPurchaseHistory = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  try {
    const user = await User.findById(userId).populate({
      path: "purchaseHistory.product",
      select: "name slug images price",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      purchaseHistory: user.purchaseHistory,
    });
  } catch (error) {
    console.error("Error fetching purchase history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchase history",
      error: error.message,
    });
  }
});

module.exports = {
  createUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getAllUsers,
  getSingleUser,
  deleteUser,
  updateUser,
  blockUser,
  unBlockUser,
  handleRefreshToken,
  getCurrentUser,
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  getUserStats,
  getUsersAdmin,
  getUserProfile,
  recordPurchase,
  getPurchaseHistory,
};
