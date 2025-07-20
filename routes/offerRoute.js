const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  getAllOffers,
  getProductOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require("../controller/offerController");

// Public routes
router.get("/", getAllOffers);
router.get("/product/:id", getProductOffers);

// Protected routes - requires authentication
router.post("/create", authMiddleware, isAdmin, createOffer);
router.put("/update/:id", authMiddleware, isAdmin, updateOffer);
router.delete("/delete/:id", authMiddleware, isAdmin, deleteOffer);

module.exports = router;
