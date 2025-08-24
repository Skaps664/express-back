const mongoose = require("mongoose");
const slugify = require("slugify");

// Create the schema
const productSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },

    // Categories and Branding
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
    },

    // Pricing and Inventory
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },

    // Flexible Specifications (as array of groups)
    specifications: [
      {
        groupName: {
          type: String,
          required: true,
        },
        items: [
          {
            name: String,
            value: mongoose.Schema.Types.Mixed, // Can be String, Number, Boolean
            unit: String, // Optional unit of measurement
            icon: String, // Optional icon class
          },
        ],
      },
    ],

    // Document Attachments
    documents: [
      {
        name: {
          type: String,
          required: true,
        },
        id: String,
        type: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        size: Number, // in KB
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Content and Media
    description: {
      type: String,
      trim: true,
    },
    keyFeatures: [
      {
        type: String,
        trim: true,
      },
    ],
    images: [String],
    videos: [
      {
        id: String,
        title: String,
        description: String,
        url: {
          type: String,
          required: true,
        },
        videoId: String,
        duration: String,
        views: String,
      },
    ],

    // Shipping and Policies
    shippingInfo: {
      freeShipping: Boolean,
      estimatedDelivery: String,
      returnPolicy: String,
      warrantyService: String,
    },

    // Reviews and Ratings
    reviews: {
      avgRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      totalCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      ratingDistribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 },
      },
      reviewItems: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Review",
        },
      ],
    },

    // Marketing Flags
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
      set: (value) => !!value,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
      index: true,
      set: (value) => !!value,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
      index: true,
      set: (value) => !!value,
    },
    tags: {
      type: [String],
      default: [],
    },

    // Relationships
    relatedProducts: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Products",
      default: [],
    },
    relatedBlogs: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Blog",
      default: [],
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true,
  }
);

// Middleware
productSchema.pre("save", async function (next) {
  // Update slug if name changes
  if (!this.slug || this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  // Update discount percentage
  if (this.originalPrice && this.originalPrice > this.price) {
    this.discountPercentage = Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }

  // If this is a new product, update Brand & Category
  if (this.isNew) {
    await Promise.all([
      mongoose.model("Brand").updateProductCount(this.brand),
      mongoose.model("Category").updateProductCount(this.category),
      mongoose.model("Category").updatePopularBrands(this.category),
    ]);
  }

  next();
});

// Update counts when a product is deleted
productSchema.post("remove", async function (doc) {
  await Promise.all([
    mongoose.model("Brand").updateProductCount(doc.brand),
    mongoose.model("Category").updateProductCount(doc.category),
    mongoose.model("Category").updatePopularBrands(doc.category),
  ]);
});

// Enhanced Text Indexes for better search
productSchema.index(
  {
    name: "text",
    slug: "text",
    description: "text",
    "specifications.items.value": "text",
    tags: "text",
    keyFeatures: "text",
  },
  {
    weights: {
      name: 10,
      "specifications.items.value": 5,
      tags: 3,
      description: 2,
      keyFeatures: 2,
    },
    name: "product_search_index",
  }
);

// Regular indexes for filtering
productSchema.index({ isFeatured: 1, isBestSeller: 1, isNewArrival: 1 });
productSchema.index({ brand: 1, category: 1, subCategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ "reviews.rating": 1 });

// Virtual for populated brand name (helps with search)
productSchema.virtual("brandName", {
  ref: "Brand",
  localField: "brand",
  foreignField: "_id",
  justOne: true,
  options: { select: "name" },
});

// Virtual for populated category name
productSchema.virtual("categoryName", {
  ref: "Category",
  localField: "category",
  foreignField: "_id",
  justOne: true,
  options: { select: "name" },
});

// Update Brand references when a product is saved or updated
productSchema.post("save", async function (doc) {
  try {
    // If we have a brand, update the brand's product count
    if (doc.brand) {
      const Brand = mongoose.model("Brand");
      const productCount = await mongoose
        .model("Products")
        .countDocuments({ brand: doc.brand });

      await Brand.findByIdAndUpdate(doc.brand, {
        $set: { allProductCount: productCount },
      });

      console.log(
        `Updated product count for brand ${doc.brand} to ${productCount}`
      );
    }
  } catch (error) {
    console.error("Error updating brand product count:", error);
  }
});

// Create and export the model
const Products = mongoose.model("Products", productSchema);
module.exports = Products;
