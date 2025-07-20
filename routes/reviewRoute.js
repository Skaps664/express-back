const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  toggleReviewLike,
  checkReviewEligibility,
  simulatePurchase,
} = require("../controller/reviewController");

// Public routes
router.get("/product/:productId", getProductReviews);

// Protected routes (auth required)
router.post("/create", authMiddleware, createReview);
router.put("/:reviewId", authMiddleware, updateReview);
router.delete("/:reviewId", authMiddleware, deleteReview);
router.post("/:reviewId/like", authMiddleware, toggleReviewLike);
router.get("/check/:productId", authMiddleware, checkReviewEligibility);

// Development routes
if (process.env.NODE_ENV !== "production") {
  router.post("/simulate-purchase", authMiddleware, simulatePurchase);
}

module.exports = router;
