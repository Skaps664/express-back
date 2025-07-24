const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  exportOrders,
  generateWhatsappLink,
} = require("../controller/orderController");

// User order routes
router.post("/", authMiddleware, createOrder);
router.get("/user", authMiddleware, getUserOrders);

// Admin order routes (must be before /:id routes)
router.get("/admin/all", authMiddleware, isAdmin, getAllOrders);
router.get("/admin/export", authMiddleware, isAdmin, exportOrders);

// Individual order routes (must be after admin routes)
router.get("/:id", authMiddleware, getOrderById);
router.get("/:id/whatsapp", authMiddleware, generateWhatsappLink);
router.put("/:id", authMiddleware, isAdmin, updateOrderStatus);

module.exports = router;
