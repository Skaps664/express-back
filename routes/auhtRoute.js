const express = require("express");
const router = express.Router();

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

const {
  createUser,
  loginUser,
  getAllUsers,
  getSingleUser,
  deleteUser,
  updateUser,
  blockUser,
  unBlockUser,
  logoutUser,
  refreshAccessToken,
  handleRefreshToken,
  getCurrentUser,
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  getUserStats,
  getUsersAdmin,
  getUserProfile,
  createAdminUser,
  recordPurchase,
  getPurchaseHistory,
  changePassword,
  updateUserProfile,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
} = require("../controller/userController");

router.post("/register", createUser);

router.get("/me", authMiddleware, getCurrentUser);
router.get("/profile", authMiddleware, getUserProfile);
router.put("/profile", authMiddleware, updateUser);

router.post("/login", loginUser);
router.post("/logout", authMiddleware, logoutUser);
router.post("/refresh", refreshAccessToken);

router.get("/refresh-token", handleRefreshToken);

router.get("/cart", authMiddleware, getCart);
router.post("/cart/add", authMiddleware, addToCart);
router.put("/cart/update", authMiddleware, updateCartItem);
router.delete("/cart/remove", authMiddleware, removeFromCart);

router.get("/purchase-history", authMiddleware, getPurchaseHistory);
router.post("/record-purchase", authMiddleware, recordPurchase);

router.get("/all", authMiddleware, isAdmin, getAllUsers);

// Admin user management routes
router.get("/admin/stats", authMiddleware, isAdmin, getUserStats);
router.get("/admin/users", authMiddleware, isAdmin, getUsersAdmin);
router.get("/admin/profile/:id", authMiddleware, isAdmin, getUserProfile);

// Create a simple admin user (only current admins can call)
router.post('/admin/create', authMiddleware, isAdmin, createAdminUser);

// Change password route (MUST come before /:id routes)
router.put("/change-password", authMiddleware, changePassword);

// Profile management routes (MUST come before /:id routes)
router.put("/profile", authMiddleware, updateUserProfile);

// Address management routes (MUST come before /:id routes)
router.get("/addresses", authMiddleware, getUserAddresses);
router.post("/addresses", authMiddleware, addUserAddress);
router.put("/addresses/:addressId", authMiddleware, updateUserAddress);
router.delete("/addresses/:addressId", authMiddleware, deleteUserAddress);

// Purchase history routes
router.post("/purchase/record", authMiddleware, recordPurchase);
router.get("/purchase/history", authMiddleware, getPurchaseHistory);

// Generic parameterized routes (MUST come after specific routes)
router.get("/:id", authMiddleware, isAdmin, getSingleUser);
router.delete("/:id", authMiddleware, isAdmin, deleteUser);
router.put("/:id", authMiddleware, isAdmin, updateUser);
router.put("/block/:id", authMiddleware, isAdmin, blockUser);
router.put("/unblock/:id", authMiddleware, isAdmin, unBlockUser);

module.exports = router;
