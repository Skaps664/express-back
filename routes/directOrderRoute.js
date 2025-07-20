const express = require("express");
const { createDirectOrder } = require("../controller/directOrderController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// Direct order routes
router.post("/direct", authMiddleware, createDirectOrder);

module.exports = router;
