const mongoose = require("mongoose");

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true, trim: true },
      ur: { type: String, trim: true },
      ps: { type: String, trim: true },
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      en: { type: String },
      ur: { type: String },
      ps: { type: String },
    },
    icon: { type: String }, // Icon class or image URL
    color: { type: String, default: "#3B82F6" }, // Hex color for category
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
      default: null,
    },
    seo: {
      metaTitle: {
        en: { type: String },
        ur: { type: String },
        ps: { type: String },
      },
      metaDescription: {
        en: { type: String },
        ur: { type: String },
        ps: { type: String },
      },
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    blogCount: { type: Number, default: 0 }, // Virtual count of blogs
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
blogCategorySchema.index({ slug: 1 }, { unique: true });
blogCategorySchema.index({ parent: 1, isActive: 1 });
blogCategorySchema.index({ isActive: 1, sortOrder: 1 });

// Virtual for URL
blogCategorySchema.virtual("url").get(function () {
  return `/blogs/category/${this.slug}`;
});

// Update blog count when blogs are added/removed
blogCategorySchema.methods.updateBlogCount = async function () {
  const Blog = mongoose.model("Blog");
  this.blogCount = await Blog.countDocuments({
    category: this._id,
    status: "published",
    isActive: true,
  });
  await this.save();
};

const BlogCategory = mongoose.model("BlogCategory", blogCategorySchema);

module.exports = BlogCategory;
