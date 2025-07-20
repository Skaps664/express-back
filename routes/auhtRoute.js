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
} = require("../controller/userController");

router.post("/register", createUser);

router.get("/me", authMiddleware, getCurrentUser);

router.post("/login", loginUser);
router.post("/logout", authMiddleware, logoutUser);

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

router.get("/:id", authMiddleware, isAdmin, getSingleUser);

router.delete("/:id", authMiddleware, isAdmin, deleteUser);

router.put("/:id", authMiddleware, isAdmin, updateUser);

router.put("/block/:id", authMiddleware, isAdmin, blockUser);
router.put("/unblock/:id", authMiddleware, isAdmin, unBlockUser);

// Purchase history routes
router.post("/purchase/record", authMiddleware, recordPurchase);
router.get("/purchase/history", authMiddleware, getPurchaseHistory);

module.exports = router;
