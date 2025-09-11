const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      en: { type: String, required: true, trim: true },
      ur: { type: String, trim: true },
      ps: { type: String, trim: true }, // Pashto
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    excerpt: {
      en: { type: String, required: true, maxlength: 500 },
      ur: { type: String, maxlength: 500 },
      ps: { type: String, maxlength: 500 },
    },
    content: {
      en: { type: String, required: true },
      ur: { type: String },
      ps: { type: String },
    },

    // SEO Fields
    seo: {
      metaTitle: {
        en: { type: String, maxlength: 60 },
        ur: { type: String, maxlength: 60 },
        ps: { type: String, maxlength: 60 },
      },
      metaDescription: {
        en: { type: String, maxlength: 160 },
        ur: { type: String, maxlength: 160 },
        ps: { type: String, maxlength: 160 },
      },
      keywords: [{ type: String, trim: true }],
      canonicalUrl: { type: String },
      ogImage: { type: String },
      focusKeyword: { type: String },
    },

    // Media
    featuredImage: {
      url: { type: String, required: true },
      alt: {
        en: { type: String },
        ur: { type: String },
        ps: { type: String },
      },
      caption: {
        en: { type: String },
        ur: { type: String },
        ps: { type: String },
      },
    },
    gallery: [
      {
        url: { type: String, required: true },
        alt: {
          en: { type: String },
          ur: { type: String },
          ps: { type: String },
        },
        caption: {
          en: { type: String },
          ur: { type: String },
          ps: { type: String },
        },
      },
    ],

    // Categories and Tags
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
      required: true,
    },
    tags: [
      {
        en: { type: String, trim: true },
        ur: { type: String, trim: true },
        ps: { type: String, trim: true },
      },
    ],

    // Product/Brand Relations
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Products",
      },
    ],
    relatedBrands: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],
    primaryProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
    },
    primaryBrand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },

    // Author Information
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: { type: String, required: true },
    authorBio: {
      en: { type: String },
      ur: { type: String },
      ps: { type: String },
    },
    authorImage: { type: String },

    // Status and Publishing
    status: {
      type: String,
      enum: ["draft", "published", "scheduled", "archived"],
      default: "draft",
    },
    publishedAt: { type: Date },
    scheduledAt: { type: Date },

    // Language Settings
    primaryLanguage: {
      type: String,
      enum: ["en", "ur", "ps"],
      default: "en",
    },
    availableLanguages: [
      {
        type: String,
        enum: ["en", "ur", "ps"],
      },
    ],

    // Analytics and Engagement
    viewCount: { type: Number, default: 0 },
    readingTime: { type: Number }, // in minutes
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, required: true },
        email: { type: String, required: true },
        content: { type: String, required: true },
        language: { type: String, enum: ["en", "ur", "ps"], default: "en" },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Featured and Priority
    isFeatured: { type: Boolean, default: false },
    isSticky: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },

    // Technical Fields
    isActive: { type: Boolean, default: true },
    allowComments: { type: Boolean, default: true },
    searchableContent: { type: String }, // For search optimization
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create search-optimized content
blogSchema.pre("save", function (next) {
  if (this.isModified("content") || this.isModified("title")) {
    const searchContent = [
      this.title.en,
      this.title.ur,
      this.title.ps,
      this.excerpt.en,
      this.excerpt.ur,
      this.excerpt.ps,
      this.content.en?.replace(/<[^>]*>/g, ""), // Remove HTML tags
      this.content.ur?.replace(/<[^>]*>/g, ""),
      this.content.ps?.replace(/<[^>]*>/g, ""),
    ]
      .filter(Boolean)
      .join(" ");

    this.searchableContent = searchContent;
  }

  // Calculate reading time (assuming 200 words per minute)
  if (this.isModified("content")) {
    const wordCount = (this.content.en || "").split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }

  // Set published date
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  next();
});

// Indexes for performance
blogSchema.index({ slug: 1 }, { unique: true });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ relatedProducts: 1 });
blogSchema.index({ relatedBrands: 1 });
blogSchema.index({ primaryProduct: 1 });
blogSchema.index({ primaryBrand: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ isFeatured: 1, status: 1 });
blogSchema.index({ isActive: 1, status: 1, publishedAt: -1 });
blogSchema.index({ searchableContent: "text" });

// Virtual for URL
blogSchema.virtual("url").get(function () {
  return `/blogs/${this.slug}`;
});

// Virtual for reading time text
blogSchema.virtual("readingTimeText").get(function () {
  return `${this.readingTime} min read`;
});

// Sanitize fields before validation to avoid casting empty strings to ObjectId
blogSchema.pre('validate', function(next) {
  try {
    if (this.primaryProduct === '') this.primaryProduct = undefined;
    if (this.primaryBrand === '') this.primaryBrand = undefined;
    if (Array.isArray(this.relatedProducts)) {
      this.relatedProducts = this.relatedProducts.filter(Boolean);
    }
    if (Array.isArray(this.relatedBrands)) {
      this.relatedBrands = this.relatedBrands.filter(Boolean);
    }
  } catch (e) {
    // ignore
  }
  next();
});

const Blog = mongoose.model("Blog", blogSchema);

module.exports = Blog;
