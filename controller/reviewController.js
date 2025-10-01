const Review = require("../models/ReviewModel");
const Product = require("../models/ProductsModel");
const Order = require("../models/OrderModel");
const User = require("../models/UserModel");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const validateMongoId = require("../utils/validateMongoId");

/**
 * Get user's eligible products for review (delivered orders not yet reviewed)
 */
const getEligibleForReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    // Find delivered orders for this user
    const deliveredOrders = await Order.find({
      user: userId,
      status: "Delivered"
    }).populate("items.product", "name slug images");

    const eligibleItems = [];

    for (const order of deliveredOrders) {
      for (const item of order.items) {
        // Check if this item hasn't been reviewed yet
        if (!item.isReviewed && item.product) {
          eligibleItems.push({
            orderItemId: item._id,
            orderId: order._id,
            orderNumber: order.orderNumber,
            product: {
              _id: item.product._id,
              name: item.name, // Use stored name from order
              slug: item.product.slug,
              image: item.image || item.product.images?.[0] || null
            },
            purchaseDate: order.createdAt,
            deliveryDate: order.updatedAt, // Approximate delivery date
            quantity: item.quantity,
            price: item.price
          });
        }
      }
    }

    res.json({
      success: true,
      data: eligibleItems
    });
  } catch (error) {
    console.error("Error fetching eligible items for review:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching eligible items for review",
      error: error.message,
    });
  }
});

/**
 * Get user's reviews
 */
const getUserReviews = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const reviews = await Review.find({ user: userId })
      .populate("product", "name slug images")
      .populate("order", "orderNumber")
      .sort({ createdAt: -1 })
      .lean();

    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      product: {
        _id: review.product._id,
        name: review.product.name,
        slug: review.product.slug,
        image: review.product.images?.[0] || null
      },
      order: {
        orderNumber: review.order.orderNumber
      },
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images || [],
      helpfulVotes: review.likes?.count || 0,
      isVisible: review.isVisible,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    }));

    res.json({
      success: true,
      data: formattedReviews
    });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user reviews",
      error: error.message,
    });
  }
});

/**
 * Create a new review
 * Only users who have purchased and received the product can leave a review
 */
const createReview = asyncHandler(async (req, res) => {
  const { orderItemId, rating, comment, title, images } = req.body;
  const userId = req.user?._id;

  // Validate input
  if (!orderItemId || !rating || !comment || !title) {
    return res.status(400).json({
      success: false,
      message: "Order item ID, rating, title, and comment are required",
    });
  }

  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return res.status(400).json({
      success: false,
      message: "Rating must be an integer between 1 and 5"
    });
  }

  try {
    // Find the order and verify it belongs to the user and is delivered
    const order = await Order.findOne({
      user: userId,
      status: "Delivered",
      "items._id": orderItemId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order item not found or not eligible for review"
      });
    }

    // Find the specific order item
    const orderItem = order.items.find(item => item._id.toString() === orderItemId);

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    if (orderItem.isReviewed) {
      return res.status(400).json({
        success: false,
        message: "This product has already been reviewed"
      });
    }

    // Check if user has already reviewed this product for this order item
    const existingReview = await Review.findOne({
      user: userId,
      product: orderItem.product,
      orderItem: orderItemId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product"
      });
    }

    // Create the review
    const review = new Review({
      user: userId,
      product: orderItem.product,
      order: order._id,
      orderItem: orderItemId,
      rating,
      title: title.trim(),
      comment: comment.trim(),
      images: images || [],
      verified: true // Auto-verified since it's from a delivered order
    });

    await review.save();

    // Update the order item to mark as reviewed
    await Order.updateOne(
      { _id: order._id, "items._id": orderItemId },
      { 
        $set: { 
          "items.$.isReviewed": true,
          "items.$.review": review._id
        }
      }
    );

    // Populate the review data for response
    await review.populate("user", "name");

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: {
        _id: review._id,
        user: {
          name: review.user.name,
          isVerified: true
        },
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        images: review.images,
        verified: review.verified,
        createdAt: review.createdAt
      }
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create review",
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
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case "lowest":
        sortOption = { rating: 1, createdAt: -1 };
        break;
      case "helpful":
        sortOption = { "likes.count": -1, createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { createdAt: -1 }; // newest by default
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get reviews with user details - only show visible reviews
    const reviews = await Review.find({ 
      product: productId,
      isVisible: true 
    })
      .populate("user", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalReviews = await Review.countDocuments({ 
      product: productId,
      isVisible: true 
    });

    // Get product review stats
    const product = await Product.findById(productId).select("reviews");

    // Format reviews for frontend
    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      user: {
        name: review.user?.name || "Anonymous",
        isVerified: review.verified
      },
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images || [],
      helpfulVotes: review.likes?.count || 0,
      createdAt: review.createdAt,
      verified: review.verified
    }));

    res.status(200).json({
      success: true,
      data: {
        reviews: formattedReviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReviews / parseInt(limit)),
          totalReviews,
          hasNext: parseInt(page) < Math.ceil(totalReviews / parseInt(limit)),
          hasPrev: parseInt(page) > 1
        },
        stats: {
          avgRating: product?.reviews?.avgRating || 0,
          totalReviews: product?.reviews?.totalCount || 0,
          distribution: product?.reviews?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        }
      }
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
  const { rating, title, comment, images } = req.body;
  const userId = req.user._id;

  // Validate reviewId
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  try {
    const review = await Review.findOne({ _id: reviewId, user: userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you don't have permission to edit it"
      });
    }

    // Validate input
    if (rating && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5"
      });
    }

    // Update review
    if (rating) review.rating = rating;
    if (title) review.title = title.trim();
    if (comment) review.comment = comment.trim();
    if (images !== undefined) review.images = images;

    await review.save();

    res.json({
      success: true,
      message: "Review updated successfully",
      data: review
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
  const userId = req.user._id;
  const isAdmin = req.user?.role === "admin";

  // Validate reviewId
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  try {
    const review = await Review.findById(reviewId);

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

    // Update order item to mark as not reviewed
    await Order.updateOne(
      { _id: review.order, "items._id": review.orderItem },
      { 
        $set: { 
          "items.$.isReviewed": false 
        },
        $unset: {
          "items.$.review": ""
        }
      }
    );

    await review.remove();

    res.json({
      success: true,
      message: "Review deleted successfully"
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
  const userId = req.user._id;

  // Validate reviewId
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID",
    });
  }

  try {
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const hasLiked = review.likes.users.includes(userId);

    if (hasLiked) {
      // Unlike
      review.likes.users.pull(userId);
      review.likes.count = Math.max(0, review.likes.count - 1);
    } else {
      // Like
      review.likes.users.push(userId);
      review.likes.count += 1;
    }

    await review.save();

    res.json({
      success: true,
      data: {
        liked: !hasLiked,
        likesCount: review.likes.count
      }
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

module.exports = {
  createReview,
  getProductReviews,
  getUserReviews,
  getEligibleForReview,
  updateReview,
  deleteReview,
  toggleReviewLike
};
