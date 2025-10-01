const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  getEligibleForReview,
  getUserReviews,
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  toggleReviewLike
} = require("../controller/reviewController");

// Public routes
router.get("/product/:productId", getProductReviews); // Get reviews for a product

// Protected routes (auth required)
router.get("/eligible", authMiddleware, getEligibleForReview); // Get user's products eligible for review
router.get("/user", authMiddleware, getUserReviews); // Get user's reviews
router.post("/", authMiddleware, createReview); // Create a new review (using orderItemId)
router.put("/:reviewId", authMiddleware, updateReview); // Update a review
router.delete("/:reviewId", authMiddleware, deleteReview); // Delete a review
router.post("/:reviewId/like", authMiddleware, toggleReviewLike); // Like/unlike a review

module.exports = router;
