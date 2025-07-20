const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema for site visits
const SiteVisitSchema = new Schema(
  {
    visitorId: {
      type: String,
      required: true, // IP or session ID
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    page: {
      type: String,
      required: true,
      index: true,
    },
    referrer: {
      type: String,
    },
    device: {
      type: String,
    },
    browser: {
      type: String,
    },
  },
  { timestamps: true }
);

// Schema for brand analytics
const BrandAnalyticsSchema = new Schema(
  {
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      index: true,
    },
    brandSlug: {
      type: String,
      required: true,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    // Daily stats
    dailyStats: [
      {
        date: {
          type: Date,
          index: true,
        },
        views: {
          type: Number,
          default: 0,
        },
        clicks: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

// Schema for product analytics
const ProductAnalyticsSchema = new Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
      index: true,
    },
    productSlug: {
      type: String,
      required: true,
      index: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    cartAddCount: {
      type: Number,
      default: 0,
    },
    purchaseCount: {
      type: Number,
      default: 0,
    },
    // Daily stats
    dailyStats: [
      {
        date: {
          type: Date,
          index: true,
        },
        views: {
          type: Number,
          default: 0,
        },
        clicks: {
          type: Number,
          default: 0,
        },
        cartAdds: {
          type: Number,
          default: 0,
        },
        purchases: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

// Schema for detailed analytics logs
const AnalyticsLogSchema = new Schema(
  {
    entityType: {
      type: String,
      enum: ["site", "brand", "product", "category"],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    entitySlug: {
      type: String,
      index: true,
    },
    actionType: {
      type: String,
      enum: ["view", "click", "cart_add", "purchase"],
      required: true,
      index: true,
    },
    visitorId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Object, // Any additional data to track
    },
  },
  {
    timestamps: true,
    // Use TTL index to automatically expire detailed logs after a period (e.g., 90 days)
    // while keeping the aggregated data
    expireAfterSeconds: 60 * 60 * 24 * 90, // 90 days
  }
);

// Daily aggregation schema for more efficient querying of historical data
const DailyAggregateSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["site", "brand", "product", "category"],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    entitySlug: {
      type: String,
      index: true,
    },
    metrics: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      cartAdds: { type: Number, default: 0 },
      purchases: { type: Number, default: 0 },
      uniqueVisitors: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Create compound indexes for efficient querying
DailyAggregateSchema.index({ date: 1, entityType: 1 });
DailyAggregateSchema.index({ entityId: 1, date: 1 });
DailyAggregateSchema.index({ entitySlug: 1, date: 1 });

// Create models
const SiteVisit = mongoose.model("SiteVisit", SiteVisitSchema);
const BrandAnalytics = mongoose.model("BrandAnalytics", BrandAnalyticsSchema);
const ProductAnalytics = mongoose.model(
  "ProductAnalytics",
  ProductAnalyticsSchema
);
const AnalyticsLog = mongoose.model("AnalyticsLog", AnalyticsLogSchema);
const DailyAggregate = mongoose.model("DailyAggregate", DailyAggregateSchema);

module.exports = {
  SiteVisit,
  BrandAnalytics,
  ProductAnalytics,
  AnalyticsLog,
  DailyAggregate,
};
