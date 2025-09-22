const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },

    // Hierarchy
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    level: {
      type: Number,
      required: true,
      default: 1, // 1 for main categories, 2 for subcategories
    },

    // Presentation
    description: {
      type: String,
    },
    icon: {
      type: String, // Icon class or URL
    },

    // Products
    featuredProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Products",
      },
    ],
    productCount: {
      type: Number,
      default: 0,
    },

    // Brand Relationships
    popularBrands: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],
    // Header-specific ordering for top brands (array of Brand ObjectIds, max 6)
    headerBrandOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Ordering
    sortOrder: {
      type: Number,
      default: 0,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug
categorySchema.pre("save", function (next) {
  // Slug generation
  if (!this.slug || this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      replacement: "-",
      trim: true,
    });
  }

  // Set level based on parent
  if (this.parentCategory) {
    this.level = 2;
  }

  next();
});

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
});

// Static method to update product count
categorySchema.statics.updateProductCount = async function (categoryId) {
  const Product = mongoose.model("Products");
  const count = await Product.countDocuments({ category: categoryId });
  await this.findByIdAndUpdate(categoryId, { productCount: count });
};

// Static method to update popular brands (based on most products)
categorySchema.statics.updatePopularBrands = async function (categoryId) {
  const Product = mongoose.model("Products");
  const popularBrands = await Product.aggregate([
    { $match: { category: categoryId } },
    { $group: { _id: "$brand", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }, // Top 5 brands
  ]);

  const brandIds = popularBrands.map((b) => b._id);
  await this.findByIdAndUpdate(categoryId, { popularBrands: brandIds });
};

module.exports = mongoose.model("Category", categorySchema);
