const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // References
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: true, // Reference to the specific order item being reviewed
    },

    // Review Content
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5"
      }
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    
    // Review Images (optional)
    images: [{
      url: String,
      caption: String,
    }],

    // Review Status
    verified: {
      type: Boolean,
      default: true, // Auto-verified since only delivered orders can review
    },
    isVisible: {
      type: Boolean,
      default: true, // For moderation purposes
    },
    
    // Helpful votes (renamed from likes for clarity)
    likes: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },

    // Admin notes
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index to prevent duplicate reviews for same product by same user in same order
reviewSchema.index({ user: 1, product: 1, orderItem: 1 }, { unique: true });

// Index for efficient querying
reviewSchema.index({ product: 1, isVisible: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

// Virtual for user name
reviewSchema.virtual("userName", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
  options: { select: "name" },
});

// Update product review statistics when review is saved
reviewSchema.post("save", async function(doc) {
  await updateProductReviewStats(doc.product);
});

// Update product review statistics when review is removed
reviewSchema.post("remove", async function(doc) {
  await updateProductReviewStats(doc.product);
});

// Helper function to update product review statistics
async function updateProductReviewStats(productId) {
  try {
    const Product = mongoose.model("Products");
    const Review = mongoose.model("Review");

    // Get all visible reviews for this product
    const reviews = await Review.find({ 
      product: productId, 
      isVisible: true 
    }).select("rating");

    const totalCount = reviews.length;
    
    if (totalCount === 0) {
      // No reviews - reset to defaults
      await Product.findByIdAndUpdate(productId, {
        $set: {
          "reviews.avgRating": 0,
          "reviews.totalCount": 0,
          "reviews.ratingDistribution.1": 0,
          "reviews.ratingDistribution.2": 0,
          "reviews.ratingDistribution.3": 0,
          "reviews.ratingDistribution.4": 0,
          "reviews.ratingDistribution.5": 0,
        }
      });
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = Math.round((totalRating / totalCount) * 10) / 10; // Round to 1 decimal

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(review => {
      distribution[review.rating]++;
    });

    // Update product
    await Product.findByIdAndUpdate(productId, {
      $set: {
        "reviews.avgRating": avgRating,
        "reviews.totalCount": totalCount,
        "reviews.ratingDistribution.1": distribution[1],
        "reviews.ratingDistribution.2": distribution[2],
        "reviews.ratingDistribution.3": distribution[3],
        "reviews.ratingDistribution.4": distribution[4],
        "reviews.ratingDistribution.5": distribution[5],
      }
    });

    console.log(`Updated review stats for product ${productId}: avg=${avgRating}, count=${totalCount}`);
  } catch (error) {
    console.error("Error updating product review stats:", error);
  }
}

module.exports = mongoose.model("Review", reviewSchema);
