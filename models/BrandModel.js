const mongoose = require("mongoose");
const slugify = require("slugify"); // 👈 Add this at the top

const brandSchema = new mongoose.Schema(
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

    // Brand Presentation
    tagline: {
      type: String,
      default: "Distributor",
    },
    description: {
      type: String,
      required: true,
    },

    // Visual Assets
    logo: {
      type: String, // URL to logo image (PNG recommended)
      required: true,
    },
    banner: {
      type: String, // URL to banner image (PNG/GIF)
      required: true,
    },
    thumbnail: {
      type: String, // Optional smaller version for listings
    },

    // Brand Information
    establishedYear: {
      type: Number,
    },
    headquarters: {
      type: String,
    },

    // Products Section
    featuredProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Products",
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    allProductCount: {
      type: Number,
      default: 0,
    },

    // Blog References
    relatedBlogs: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Blog",
      default: [],
    },

    // Status Flags
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Administration
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);
// Add this pre-save hook to maintain slug consistency
brandSchema.pre("save", function (next) {
  if (!this.slug || this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Static method to update product count when a product is added/removed
brandSchema.statics.updateProductCount = async function (brandId) {
  const Product = mongoose.model("Products");
  const count = await Product.countDocuments({ brand: brandId });
  await this.findByIdAndUpdate(brandId, { allProductCount: count });
};

// Add an index on the categories field for faster querying
brandSchema.index({ categories: 1 });

module.exports = mongoose.model("Brand", brandSchema);
