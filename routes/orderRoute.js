const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  generateWhatsappLink,
} = require("../controller/orderController");

// User order routes
router.post("/", authMiddleware, createOrder);
router.get("/", authMiddleware, getUserOrders);
router.get("/:id", authMiddleware, getOrderById);
router.get("/:id/whatsapp", authMiddleware, generateWhatsappLink);

// Admin order routes
router.get("/admin/all", authMiddleware, isAdmin, getAllOrders);
router.put("/:id", authMiddleware, isAdmin, updateOrderStatus);

module.exports = router;
