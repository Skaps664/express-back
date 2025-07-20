const Review = require("../models/ReviewModel");
const Product = require("../models/ProductsModel");
const User = require("../models/UserModel");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const validateMongoId = require("../utils/validateMongoId");

/**
 * Create a new review
 * Only users who have purchased the product can leave a review
 */
const createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment, title } = req.body;
  const userId = req.user?._id;

  // Validate input
  if (!productId || !rating || !comment) {
    return res.status(400).json({
      success: false,
      message: "Product ID, rating, and comment are required",
    });
  }

  // Validate productId is a valid MongoDB ID
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user has purchased this product
    const user = await User.findById(userId);
    const hasPurchased = user.purchaseHistory.some(
      (item) => item.product.toString() === productId
    );

    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        message: "You can only review products you've purchased",
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Create the review
    const review = await Review.create({
      user: userId,
      product: productId,
      rating,
      comment,
      title: title || "",
      verified: true,
    });

    // Update the product with the new review
    const ratingValue = Number(rating);

    // Update rating distribution
    const ratingKey = ratingValue.toString();
    const ratingUpdateQuery = {};
    ratingUpdateQuery["reviews.ratingDistribution." + ratingKey] = 1;

    // Update the product's review stats
    await Product.findByIdAndUpdate(
      productId,
      {
        $push: { "reviews.reviewItems": review._id },
        $inc: {
          "reviews.totalCount": 1,
          ...ratingUpdateQuery,
        },
        $set: {
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    // Recalculate the average rating
    const allReviews = await Review.find({ product: productId });
    const avgRating =
      allReviews.reduce((sum, review) => sum + review.rating, 0) /
      allReviews.length;

    await Product.findByIdAndUpdate(productId, {
      $set: {
        "reviews.avgRating": parseFloat(avgRating.toFixed(1)),
      },
    });

    // Mark the product as reviewed in user's purchase history
    await User.updateOne(
      {
        _id: userId,
        "purchaseHistory.product": productId,
      },
      {
        $set: { "purchaseHistory.$.hasReviewed": true },
      }
    );

    // Return the review with user details
    const populatedReview = await Review.findById(review._id).populate(
      "user",
      "name"
    );

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      review: populatedReview,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({
      success: false,
      message: "Error creating review",
      error: error.message,
    });
  }
});

/**
 * Get reviews for a product
 */
const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { sort = "newest", page = 1, limit = 10 } = req.query;

  // Validate productId
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  try {
    // Define sort options
    let sortOption = {};
    switch (sort) {
      case "highest":
        sortOption = { rating: -1 };
        break;
      case "lowest":
        sortOption = { rating: 1 };
        break;
      case "likes":
        sortOption = { "likes.count": -1 };
        break;
      default:
        sortOption = { createdAt: -1 }; // newest by default
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get reviews with user details
    const reviews = await Review.find({ product: productId })
      .populate("user", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalReviews = await Review.countDocuments({ product: productId });

    // Get product review stats
    const product = await Product.findById(productId).select("reviews");

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        total: totalReviews,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalReviews / parseInt(limit)),
      },
      stats: {
        avgRating: product.reviews.avgRating,
        totalReviews: product.reviews.totalCount,
        distribution: product.reviews.ratingDistribution,
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reviews",
      error: error.message,
    });
  }
});

/**
 * Update a review
 */
const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment, title } = req.body;
  const userId = req.user?._id;

  // Validate reviewId
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  try {
    // Find the review
    const review = await Review.findById(reviewId);

    // Check if review exists
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if the review belongs to the user
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own reviews",
      });
    }

    // Get old rating for updating distribution
    const oldRating = review.rating;

    // Update review fields if provided
    if (rating) review.rating = rating;
    if (comment) review.comment = comment;
    if (title !== undefined) review.title = title;

    await review.save();

    // If rating has changed, update the product's rating stats
    if (rating && oldRating !== rating) {
      // Decrement old rating count
      const oldRatingKey = oldRating.toString();
      const decrementQuery = {};
      decrementQuery["reviews.ratingDistribution." + oldRatingKey] = -1;

      // Increment new rating count
      const newRatingKey = rating.toString();
      const incrementQuery = {};
      incrementQuery["reviews.ratingDistribution." + newRatingKey] = 1;

      await Product.findByIdAndUpdate(review.product, {
        $inc: {
          ...decrementQuery,
          ...incrementQuery,
        },
      });

      // Recalculate average rating
      const allReviews = await Review.find({ product: review.product });
      const avgRating =
        allReviews.reduce((sum, rev) => sum + rev.rating, 0) /
        allReviews.length;

      await Product.findByIdAndUpdate(review.product, {
        $set: {
          "reviews.avgRating": parseFloat(avgRating.toFixed(1)),
          updatedAt: Date.now(),
        },
      });
    }

    // Return the updated review
    const updatedReview = await Review.findById(reviewId).populate(
      "user",
      "name"
    );

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review: updatedReview,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({
      success: false,
      message: "Error updating review",
      error: error.message,
    });
  }
});

/**
 * Delete a review
 */
const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?._id;
  const isAdmin = req.user?.role === "admin";

  // Validate reviewId
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  try {
    // Find the review
    const review = await Review.findById(reviewId);

    // Check if review exists
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check authorization - only the review author or admin can delete
    if (review.user.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reviews",
      });
    }

    const productId = review.product;
    const ratingToRemove = review.rating.toString();

    // Remove the review
    await review.deleteOne();

    // Update product stats
    const decrementQuery = {};
    decrementQuery["reviews.ratingDistribution." + ratingToRemove] = -1;

    await Product.findByIdAndUpdate(productId, {
      $pull: { "reviews.reviewItems": reviewId },
      $inc: {
        "reviews.totalCount": -1,
        ...decrementQuery,
      },
      $set: {
        updatedAt: Date.now(),
      },
    });

    // Recalculate average rating
    const allReviews = await Review.find({ product: productId });
    const avgRating = allReviews.length
      ? allReviews.reduce((sum, rev) => sum + rev.rating, 0) / allReviews.length
      : 0;

    await Product.findByIdAndUpdate(productId, {
      $set: {
        "reviews.avgRating": parseFloat(avgRating.toFixed(1)),
      },
    });

    // Update user's purchase history to show they can review again
    if (!isAdmin) {
      await User.updateOne(
        {
          _id: userId,
          "purchaseHistory.product": productId,
        },
        {
          $set: { "purchaseHistory.$.hasReviewed": false },
        }
      );
    }

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting review",
      error: error.message,
    });
  }
});

/**
 * Like/unlike a review
 */
const toggleReviewLike = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?._id;

  // Validate reviewId
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  try {
    // Find the review
    const review = await Review.findById(reviewId);

    // Check if review exists
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user has already liked this review
    const hasLiked = review.likes.users.includes(userId);

    let updatedReview;

    if (hasLiked) {
      // Unlike the review
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $pull: { "likes.users": userId },
          $inc: { "likes.count": -1 },
        },
        { new: true }
      );
    } else {
      // Like the review
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $addToSet: { "likes.users": userId },
          $inc: { "likes.count": 1 },
        },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: hasLiked ? "Review unliked" : "Review liked",
      likes: updatedReview.likes.count,
      hasLiked: !hasLiked,
    });
  } catch (error) {
    console.error("Error toggling review like:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling review like",
      error: error.message,
    });
  }
});

/**
 * Check if a user can review a product
 */
const checkReviewEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user?._id;

  // Validate productId
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  try {
    // Check if user has purchased this product
    const user = await User.findById(userId);

    const purchaseRecord = user.purchaseHistory.find(
      (item) => item.product.toString() === productId
    );

    const hasPurchased = !!purchaseRecord;

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });

    const hasReviewed = !!existingReview;

    res.status(200).json({
      success: true,
      eligible: hasPurchased && !hasReviewed,
      hasPurchased,
      hasReviewed,
      reviewId: existingReview ? existingReview._id : null,
    });
  } catch (error) {
    console.error("Error checking review eligibility:", error);
    res.status(500).json({
      success: false,
      message: "Error checking review eligibility",
      error: error.message,
    });
  }
});

// Simulate a purchase to test reviews (development only)
const simulatePurchase = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "This endpoint is not available in production",
    });
  }

  const { productId } = req.body;
  const userId = req.user?._id;

  // Validate input
  if (!productId) {
    return res.status(400).json({
      success: false,
      message: "Product ID is required",
    });
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Add product to user's purchase history
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          purchaseHistory: {
            product: productId,
            purchaseDate: new Date(),
            quantity: 1,
            price: product.price,
            orderReference: "SIMULATED-" + Date.now(),
            hasReviewed: false,
          },
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Purchase simulated successfully",
      purchaseHistory: user.purchaseHistory,
    });
  } catch (error) {
    console.error("Error simulating purchase:", error);
    res.status(500).json({
      success: false,
      message: "Error simulating purchase",
      error: error.message,
    });
  }
});

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  toggleReviewLike,
  checkReviewEligibility,
  simulatePurchase,
};
