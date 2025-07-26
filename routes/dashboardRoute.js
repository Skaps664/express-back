const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { isAdmin } = require("../middlewares/authMiddleware");

const {
  getDashboardStats,
  getRecentActivity,
} = require("../controller/dashboardController");

// Dashboard Routes (Admin Only)
router.get("/stats", authMiddleware, isAdmin, getDashboardStats);
router.get("/activity", authMiddleware, isAdmin, getRecentActivity);

module.exports = router;
