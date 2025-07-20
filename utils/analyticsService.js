const {
  SiteVisit,
  BrandAnalytics,
  ProductAnalytics,
  AnalyticsLog,
  DailyAggregate,
} = require("../models/AnalyticsModel");

/**
 * Analytics Service for handling all tracking operations
 */
class AnalyticsService {
  /**
   * Track a site visit
   * @param {Object} data - Visit data
   * @returns {Promise} - The saved visit
   */
  static async trackSiteVisit(data) {
    try {
      const { visitorId, userId, page, referrer, device, browser } = data;

      // Create site visit record
      const visit = new SiteVisit({
        visitorId,
        userId,
        page,
        referrer,
        device,
        browser,
      });

      // Track in detailed logs
      const log = new AnalyticsLog({
        entityType: "site",
        actionType: "view",
        visitorId,
        userId,
        metadata: { page, referrer, device, browser },
      });

      // Get today's date at midnight for aggregation
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Upsert the daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "site",
        },
        {
          $inc: { "metrics.views": 1 },
          $setOnInsert: { date: today, entityType: "site" },
        },
        {
          upsert: true,
          new: true,
        }
      );

      // Save both records
      await Promise.all([visit.save(), log.save()]);
      return visit;
    } catch (error) {
      console.error("Error tracking site visit:", error);
      // Don't throw - analytics shouldn't break the application
      return null;
    }
  }

  /**
   * Increment brand view count
   * @param {Object} data - Brand data
   * @returns {Promise} - The updated brand analytics
   */
  static async incrementBrandViewCount(data) {
    try {
      const { brandId, brandSlug, visitorId, userId } = data;

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find or create brand analytics document and atomically increment view count
      const brandAnalytics = await BrandAnalytics.findOneAndUpdate(
        { brandId },
        {
          $inc: { viewCount: 1 },
          $setOnInsert: { brandSlug },
          $push: {
            dailyStats: {
              $each: [{ date: today, views: 1 }],
              $sort: { date: -1 },
              $position: 0,
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Log the detailed event
      const log = new AnalyticsLog({
        entityType: "brand",
        entityId: brandId,
        entitySlug: brandSlug,
        actionType: "view",
        visitorId,
        userId,
      });

      // Update daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "brand",
          entityId: brandId,
          entitySlug: brandSlug,
        },
        {
          $inc: { "metrics.views": 1 },
          $setOnInsert: {
            date: today,
            entityType: "brand",
            entityId: brandId,
            entitySlug: brandSlug,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      await log.save();
      return brandAnalytics;
    } catch (error) {
      console.error("Error incrementing brand view count:", error);
      return null;
    }
  }

  /**
   * Increment brand click count
   * @param {Object} data - Brand data
   * @returns {Promise} - The updated brand analytics
   */
  static async incrementBrandClickCount(data) {
    try {
      const { brandId, brandSlug, visitorId, userId } = data;

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Increment click count
      const brandAnalytics = await BrandAnalytics.findOneAndUpdate(
        { brandId },
        {
          $inc: { clickCount: 1 },
          $setOnInsert: { brandSlug },
          $push: {
            dailyStats: {
              $each: [{ date: today, clicks: 1 }],
              $sort: { date: -1 },
              $position: 0,
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Log the detailed event
      const log = new AnalyticsLog({
        entityType: "brand",
        entityId: brandId,
        entitySlug: brandSlug,
        actionType: "click",
        visitorId,
        userId,
      });

      // Update daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "brand",
          entityId: brandId,
          entitySlug: brandSlug,
        },
        {
          $inc: { "metrics.clicks": 1 },
          $setOnInsert: {
            date: today,
            entityType: "brand",
            entityId: brandId,
            entitySlug: brandSlug,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      await log.save();
      return brandAnalytics;
    } catch (error) {
      console.error("Error incrementing brand click count:", error);
      return null;
    }
  }

  /**
   * Increment product view count
   * @param {Object} data - Product data
   * @returns {Promise} - The updated product analytics
   */
  static async incrementProductViewCount(data) {
    try {
      const { productId, productSlug, brandId, visitorId, userId } = data;

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Increment product view count
      const productAnalytics = await ProductAnalytics.findOneAndUpdate(
        { productId },
        {
          $inc: { viewCount: 1 },
          $setOnInsert: {
            productSlug,
            brandId,
          },
          $push: {
            dailyStats: {
              $each: [{ date: today, views: 1 }],
              $sort: { date: -1 },
              $position: 0,
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Log the detailed event
      const log = new AnalyticsLog({
        entityType: "product",
        entityId: productId,
        entitySlug: productSlug,
        actionType: "view",
        visitorId,
        userId,
        metadata: { brandId },
      });

      // Update daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "product",
          entityId: productId,
          entitySlug: productSlug,
        },
        {
          $inc: { "metrics.views": 1 },
          $setOnInsert: {
            date: today,
            entityType: "product",
            entityId: productId,
            entitySlug: productSlug,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      // Also increment the brand view counts when a product is viewed
      if (brandId) {
        await this.incrementBrandViewCount({
          brandId,
          visitorId,
          userId,
        });
      }

      await log.save();
      return productAnalytics;
    } catch (error) {
      console.error("Error incrementing product view count:", error);
      return null;
    }
  }

  /**
   * Increment product click count
   * @param {Object} data - Product data
   * @returns {Promise} - The updated product analytics
   */
  static async incrementProductClickCount(data) {
    try {
      const { productId, productSlug, brandId, visitorId, userId } = data;

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Increment product click count
      const productAnalytics = await ProductAnalytics.findOneAndUpdate(
        { productId },
        {
          $inc: { clickCount: 1 },
          $setOnInsert: {
            productSlug,
            brandId,
          },
          $push: {
            dailyStats: {
              $each: [{ date: today, clicks: 1 }],
              $sort: { date: -1 },
              $position: 0,
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Log the detailed event
      const log = new AnalyticsLog({
        entityType: "product",
        entityId: productId,
        entitySlug: productSlug,
        actionType: "click",
        visitorId,
        userId,
        metadata: { brandId },
      });

      // Update daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "product",
          entityId: productId,
          entitySlug: productSlug,
        },
        {
          $inc: { "metrics.clicks": 1 },
          $setOnInsert: {
            date: today,
            entityType: "product",
            entityId: productId,
            entitySlug: productSlug,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      await log.save();
      return productAnalytics;
    } catch (error) {
      console.error("Error incrementing product click count:", error);
      return null;
    }
  }

  /**
   * Increment product cart add count
   * @param {Object} data - Product data
   * @returns {Promise} - The updated product analytics
   */
  static async incrementProductCartAddCount(data) {
    try {
      const {
        productId,
        productSlug,
        brandId,
        visitorId,
        userId,
        quantity = 1,
      } = data;

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Increment product cart add count
      const productAnalytics = await ProductAnalytics.findOneAndUpdate(
        { productId },
        {
          $inc: { cartAddCount: quantity },
          $setOnInsert: {
            productSlug,
            brandId,
          },
          $push: {
            dailyStats: {
              $each: [{ date: today, cartAdds: quantity }],
              $sort: { date: -1 },
              $position: 0,
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Log the detailed event
      const log = new AnalyticsLog({
        entityType: "product",
        entityId: productId,
        entitySlug: productSlug,
        actionType: "cart_add",
        visitorId,
        userId,
        metadata: { brandId, quantity },
      });

      // Update daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "product",
          entityId: productId,
          entitySlug: productSlug,
        },
        {
          $inc: { "metrics.cartAdds": quantity },
          $setOnInsert: {
            date: today,
            entityType: "product",
            entityId: productId,
            entitySlug: productSlug,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      await log.save();
      return productAnalytics;
    } catch (error) {
      console.error("Error incrementing product cart add count:", error);
      return null;
    }
  }

  /**
   * Track product purchase
   * @param {Object} data - Product purchase data
   * @returns {Promise} - The updated product analytics
   */
  static async trackProductPurchase(data) {
    try {
      const {
        productId,
        productSlug,
        brandId,
        visitorId,
        userId,
        quantity = 1,
      } = data;

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Increment purchase count
      const productAnalytics = await ProductAnalytics.findOneAndUpdate(
        { productId },
        {
          $inc: { purchaseCount: quantity },
          $setOnInsert: {
            productSlug,
            brandId,
          },
          $push: {
            dailyStats: {
              $each: [{ date: today, purchases: quantity }],
              $sort: { date: -1 },
              $position: 0,
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      // Log the detailed event
      const log = new AnalyticsLog({
        entityType: "product",
        entityId: productId,
        entitySlug: productSlug,
        actionType: "purchase",
        visitorId,
        userId,
        metadata: { brandId, quantity },
      });

      // Update daily aggregate
      await DailyAggregate.findOneAndUpdate(
        {
          date: today,
          entityType: "product",
          entityId: productId,
          entitySlug: productSlug,
        },
        {
          $inc: { "metrics.purchases": quantity },
          $setOnInsert: {
            date: today,
            entityType: "product",
            entityId: productId,
            entitySlug: productSlug,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      await log.save();
      return productAnalytics;
    } catch (error) {
      console.error("Error tracking product purchase:", error);
      return null;
    }
  }

  /**
   * Get site analytics for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise} - The site analytics
   */
  static async getSiteAnalytics(startDate, endDate) {
    try {
      // Normalize dates to midnight
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get total visits
      const totalVisits = await SiteVisit.countDocuments({
        timestamp: { $gte: start, $lte: end },
      });

      // Get unique visitors
      const uniqueVisitors = await SiteVisit.distinct("visitorId", {
        timestamp: { $gte: start, $lte: end },
      });

      // Get daily aggregates
      const dailyData = await DailyAggregate.find({
        entityType: "site",
        date: { $gte: start, $lte: end },
      }).sort({ date: 1 });

      // Get page view breakdown
      const pageViews = await SiteVisit.aggregate([
        {
          $match: {
            timestamp: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$page",
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ]);

      return {
        totalVisits,
        uniqueVisitors: uniqueVisitors.length,
        dailyData,
        pageViews,
        dateRange: {
          start,
          end,
        },
      };
    } catch (error) {
      console.error("Error getting site analytics:", error);
      throw error;
    }
  }

  /**
   * Get brand analytics for a specific brand and date range
   * @param {String} brandId - Brand ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise} - The brand analytics
   */
  static async getBrandAnalytics(brandId, startDate, endDate) {
    try {
      // Normalize dates to midnight
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get brand analytics
      const brandAnalytics = await BrandAnalytics.findOne({ brandId });

      // Get daily data for the date range
      const dailyData = await DailyAggregate.find({
        entityType: "brand",
        entityId: brandId,
        date: { $gte: start, $lte: end },
      }).sort({ date: 1 });

      // Get products for this brand with their analytics
      const productAnalytics = await ProductAnalytics.find({ brandId })
        .sort({ viewCount: -1 })
        .limit(20);

      return {
        brandAnalytics,
        dailyData,
        productAnalytics,
        dateRange: {
          start,
          end,
        },
      };
    } catch (error) {
      console.error("Error getting brand analytics:", error);
      throw error;
    }
  }

  /**
   * Get product analytics for a specific product and date range
   * @param {String} productId - Product ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise} - The product analytics
   */
  static async getProductAnalytics(productId, startDate, endDate) {
    try {
      // Normalize dates to midnight
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get product analytics
      const productAnalytics = await ProductAnalytics.findOne({ productId });

      // Get daily data for the date range
      const dailyData = await DailyAggregate.find({
        entityType: "product",
        entityId: productId,
        date: { $gte: start, $lte: end },
      }).sort({ date: 1 });

      return {
        productAnalytics,
        dailyData,
        dateRange: {
          start,
          end,
        },
      };
    } catch (error) {
      console.error("Error getting product analytics:", error);
      throw error;
    }
  }

  /**
   * Get top entities (brands or products) for a date range
   * @param {String} entityType - Entity type ('brand' or 'product')
   * @param {String} metric - Metric to sort by ('views', 'clicks', 'cartAdds', 'purchases')
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Number} limit - Limit results
   * @returns {Promise} - The top entities
   */
  static async getTopEntities(
    entityType,
    metric,
    startDate,
    endDate,
    limit = 10
  ) {
    try {
      // Normalize dates to midnight
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Define the metrics field based on the metric parameter
      const metricsField = `metrics.${metric}`;

      // Aggregate daily data to get top entities
      const topEntities = await DailyAggregate.aggregate([
        {
          $match: {
            entityType,
            date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$entityId",
            entitySlug: { $first: "$entitySlug" },
            total: { $sum: `$${metricsField}` },
          },
        },
        {
          $sort: {
            total: -1,
          },
        },
        {
          $limit: limit,
        },
      ]);

      return topEntities;
    } catch (error) {
      console.error(`Error getting top ${entityType}s:`, error);
      throw error;
    }
  }

  /**
   * Generate a time series report for an entity
   * @param {String} entityType - Entity type ('site', 'brand', or 'product')
   * @param {String} entityId - Entity ID (optional for site)
   * @param {String} metric - Metric to report ('views', 'clicks', etc.)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {String} interval - Interval ('day', 'week', 'month')
   * @returns {Promise} - The time series report
   */
  static async getTimeSeriesReport(
    entityType,
    entityId,
    metric,
    startDate,
    endDate,
    interval = "day"
  ) {
    try {
      // Normalize dates to midnight
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Define the metrics field based on the metric parameter
      const metricsField = `metrics.${metric}`;

      // Prepare match conditions
      const matchConditions = {
        date: { $gte: start, $lte: end },
      };

      // Add entity type and ID conditions if provided
      if (entityType !== "site") {
        matchConditions.entityType = entityType;
      }

      if (entityId) {
        matchConditions.entityId = entityId;
      }

      // Create the aggregation pipeline based on the interval
      let groupBy;

      if (interval === "day") {
        groupBy = {
          year: { $year: "$date" },
          month: { $month: "$date" },
          day: { $dayOfMonth: "$date" },
        };
      } else if (interval === "week") {
        groupBy = {
          year: { $year: "$date" },
          week: { $week: "$date" },
        };
      } else if (interval === "month") {
        groupBy = {
          year: { $year: "$date" },
          month: { $month: "$date" },
        };
      }

      // Aggregate the data
      const timeSeries = await DailyAggregate.aggregate([
        {
          $match: matchConditions,
        },
        {
          $group: {
            _id: groupBy,
            value: { $sum: `$${metricsField}` },
            date: { $min: "$date" }, // Use the first date in the group
          },
        },
        {
          $sort: { date: 1 },
        },
        {
          $project: {
            _id: 0,
            date: 1,
            value: 1,
          },
        },
      ]);

      return {
        entityType,
        entityId,
        metric,
        interval,
        data: timeSeries,
        dateRange: {
          start,
          end,
        },
      };
    } catch (error) {
      console.error("Error generating time series report:", error);
      throw error;
    }
  }

  /**
   * Get time series data for a specific entity
   * @param {Object} params - Query parameters
   * @returns {Promise} - Time series data
   */
  static async getTimeSeriesData({
    entityType,
    entityId,
    metric = "views",
    startDate,
    endDate,
  }) {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const timeSeries = await DailyAggregate.aggregate([
        {
          $match: {
            date: {
              $gte: start,
              $lte: end,
            },
            entityType,
            entityId: mongoose.Types.ObjectId(entityId),
          },
        },
        {
          $group: {
            _id: "$date",
            count: { $sum: `$metrics.${metric}` },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return timeSeries;
    } catch (error) {
      console.error("Error getting time series data:", error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
