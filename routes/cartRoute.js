const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controller/cartController");

// Cart routes (all protected)
router.post("/", authMiddleware, addToCart);
router.get("/", authMiddleware, getCart);
router.put("/:itemId", authMiddleware, updateCartItem);
router.delete("/:itemId", authMiddleware, removeCartItem);
router.delete("/", authMiddleware, clearCart);

module.exports = router;
