const asyncHandler = require("express-async-handler");
const { default: mongoose } = require("mongoose");
const Product = require("../models/ProductsModel");
const Brand = require("../models/BrandModel");
const AnalyticsService = require("../utils/analyticsService");
const validateMongoId = require("../utils/validateMongoId");

/**
 * @desc    Track site visit
 * @route   POST /api/analytics/track/visit
 * @access  Public
 */
const trackSiteVisit = asyncHandler(async (req, res) => {
  const { visitorId, page, referrer, device, browser } = req.body;

  // Add userId if available from auth
  const userId = req.user ? req.user._id : null;

  // Track the visit
  const visit = await AnalyticsService.trackSiteVisit({
    visitorId,
    userId,
    page,
    referrer,
    device,
    browser,
  });

  res.status(200).json({
    success: true,
    message: "Site visit tracked successfully",
  });
});

/**
 * @desc    Track brand view
 * @route   POST /api/analytics/track/brand/view
 * @access  Public
 */
const trackBrandView = asyncHandler(async (req, res) => {
  const { brandId, brandSlug, visitorId } = req.body;

  // Validate brandId
  validateMongoId(brandId);

  // Add userId if available from auth
  const userId = req.user ? req.user._id : null;

  // Track the brand view
  await AnalyticsService.incrementBrandViewCount({
    brandId,
    brandSlug,
    visitorId,
    userId,
  });

  res.status(200).json({
    success: true,
    message: "Brand view tracked successfully",
  });
});

/**
 * @desc    Track brand click
 * @route   POST /api/analytics/track/brand/click
 * @access  Public
 */
const trackBrandClick = asyncHandler(async (req, res) => {
  const { brandId, brandSlug, visitorId } = req.body;

  // Validate brandId
  validateMongoId(brandId);

  // Add userId if available from auth
  const userId = req.user ? req.user._id : null;

  // Track the brand click
  await AnalyticsService.incrementBrandClickCount({
    brandId,
    brandSlug,
    visitorId,
    userId,
  });

  res.status(200).json({
    success: true,
    message: "Brand click tracked successfully",
  });
});

/**
 * @desc    Track product view
 * @route   POST /api/analytics/track/product/view
 * @access  Public
 */
const trackProductView = asyncHandler(async (req, res) => {
  const { productId, productSlug, brandId, visitorId } = req.body;

  try {
    // Validate IDs if present
    if (productId) {
      try {
        validateMongoId(productId);
      } catch (error) {
        console.warn("Invalid productId format:", productId);
        // Continue without valid productId
      }
    }

    if (brandId) {
      try {
        validateMongoId(brandId);
      } catch (error) {
        console.warn("Invalid brandId format:", brandId);
        // Continue without valid brandId
      }
    }

    // Add userId if available from auth
    const userId = req.user ? req.user._id : null;

    // Only track if we have valid product ID
    if (productId) {
      await AnalyticsService.incrementProductViewCount({
        productId,
        productSlug,
        brandId,
        visitorId,
        userId,
      });
    }

    res.status(200).json({
      success: true,
      message: "Product view tracked successfully",
    });
  } catch (error) {
    console.error("Error tracking product view:", error);
    // Always return 200 for analytics endpoints to prevent breaking user experience
    res.status(200).json({
      success: false,
      message: "Product view tracking failed but continuing",
    });
  }
});

/**
 * @desc    Track product click
 * @route   POST /api/analytics/track/product/click
 * @access  Public
 */
const trackProductClick = asyncHandler(async (req, res) => {
  const { productId, productSlug, brandId, visitorId } = req.body;

  // Validate IDs
  validateMongoId(productId);
  if (brandId) validateMongoId(brandId);

  // Add userId if available from auth
  const userId = req.user ? req.user._id : null;

  // Track the product click
  await AnalyticsService.incrementProductClickCount({
    productId,
    productSlug,
    brandId,
    visitorId,
    userId,
  });

  res.status(200).json({
    success: true,
    message: "Product click tracked successfully",
  });
});

/**
 * @desc    Track product added to cart
 * @route   POST /api/analytics/track/product/cart-add
 * @access  Public
 */
const trackProductCartAdd = asyncHandler(async (req, res) => {
  const { productId, productSlug, brandId, visitorId, quantity } = req.body;

  // Validate IDs
  validateMongoId(productId);
  if (brandId) validateMongoId(brandId);

  // Add userId if available from auth
  const userId = req.user ? req.user._id : null;

  // Track the cart add
  await AnalyticsService.incrementProductCartAddCount({
    productId,
    productSlug,
    brandId,
    visitorId,
    userId,
    quantity: quantity || 1,
  });

  res.status(200).json({
    success: true,
    message: "Product cart add tracked successfully",
  });
});

/**
 * @desc    Track product purchase
 * @route   POST /api/analytics/track/product/purchase
 * @access  Private
 */
const trackProductPurchase = asyncHandler(async (req, res) => {
  const { productId, productSlug, brandId, visitorId, quantity } = req.body;

  // Validate IDs
  validateMongoId(productId);
  if (brandId) validateMongoId(brandId);

  // Add userId if available from auth (should be available as this is a private route)
  const userId = req.user._id;

  // Track the purchase
  await AnalyticsService.trackProductPurchase({
    productId,
    productSlug,
    brandId,
    visitorId,
    userId,
    quantity: quantity || 1,
  });

  res.status(200).json({
    success: true,
    message: "Product purchase tracked successfully",
  });
});

/**
 * @desc    Get site analytics
 * @route   GET /api/analytics/site
 * @access  Admin
 */
const getSiteAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const analytics = await AnalyticsService.getSiteAnalytics(start, end);

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

/**
 * @desc    Get brand analytics
 * @route   GET /api/analytics/brand/:brandId
 * @access  Admin/Brand Owner
 */
const getBrandAnalytics = asyncHandler(async (req, res) => {
  const { brandId } = req.params;
  const { startDate, endDate } = req.query;

  // Validate brandId
  validateMongoId(brandId);

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const analytics = await AnalyticsService.getBrandAnalytics(
    brandId,
    start,
    end
  );

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

/**
 * @desc    Get product analytics
 * @route   GET /api/analytics/product/:productId
 * @access  Admin/Brand Owner
 */
const getProductAnalytics = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { startDate, endDate } = req.query;

  // Validate productId
  validateMongoId(productId);

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const analytics = await AnalyticsService.getProductAnalytics(
    productId,
    start,
    end
  );

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

/**
 * @desc    Get top brands
 * @route   GET /api/analytics/top/brands
 * @access  Admin
 */
const getTopBrands = asyncHandler(async (req, res) => {
  const { metric = "views", startDate, endDate, limit = 10 } = req.query;

  // Validate metric
  const validMetrics = ["views", "clicks"];
  if (!validMetrics.includes(metric)) {
    res.status(400);
    throw new Error(
      `Invalid metric. Valid metrics are: ${validMetrics.join(", ")}`
    );
  }

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const topBrands = await AnalyticsService.getTopEntities(
    "brand",
    metric,
    start,
    end,
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    data: topBrands,
  });
});

/**
 * @desc    Get top products
 * @route   GET /api/analytics/top/products
 * @access  Admin
 */
const getTopProducts = asyncHandler(async (req, res) => {
  const { metric = "views", startDate, endDate, limit = 10 } = req.query;

  // Validate metric
  const validMetrics = ["views", "clicks", "cartAdds", "purchases"];
  if (!validMetrics.includes(metric)) {
    res.status(400);
    throw new Error(
      `Invalid metric. Valid metrics are: ${validMetrics.join(", ")}`
    );
  }

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const topProducts = await AnalyticsService.getTopEntities(
    "product",
    metric,
    start,
    end,
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    data: topProducts,
  });
});

/**
 * @desc    Get time series report
 * @route   GET /api/analytics/report/time-series
 * @access  Admin/Brand Owner
 */
const getTimeSeriesReport = asyncHandler(async (req, res) => {
  const {
    entityType,
    entityId,
    metric,
    startDate,
    endDate,
    interval = "day",
  } = req.query;

  // Validate entity type
  const validEntityTypes = ["site", "brand", "product"];
  if (!validEntityTypes.includes(entityType)) {
    res.status(400);
    throw new Error(
      `Invalid entity type. Valid types are: ${validEntityTypes.join(", ")}`
    );
  }

  // Validate entityId if not site type
  if (entityType !== "site" && entityId) {
    validateMongoId(entityId);
  }

  // Validate metric based on entity type
  let validMetrics;
  if (entityType === "site") {
    validMetrics = ["views"];
  } else if (entityType === "brand") {
    validMetrics = ["views", "clicks"];
  } else {
    validMetrics = ["views", "clicks", "cartAdds", "purchases"];
  }

  if (!validMetrics.includes(metric)) {
    res.status(400);
    throw new Error(
      `Invalid metric for ${entityType}. Valid metrics are: ${validMetrics.join(
        ", "
      )}`
    );
  }

  // Validate interval
  const validIntervals = ["day", "week", "month"];
  if (!validIntervals.includes(interval)) {
    res.status(400);
    throw new Error(
      `Invalid interval. Valid intervals are: ${validIntervals.join(", ")}`
    );
  }

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const report = await AnalyticsService.getTimeSeriesReport(
    entityType,
    entityId,
    metric,
    start,
    end,
    interval
  );

  res.status(200).json({
    success: true,
    data: report,
  });
});

const getEntityAnalytics = asyncHandler(async (req, res) => {
  const { type, slug } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let data;
    if (type === "product") {
      const product = await Product.findOne({ slug });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }
      data = await AnalyticsService.getTimeSeriesData({
        entityType: "product",
        entityId: product._id,
        metric: "views",
        startDate,
        endDate,
      });
    } else if (type === "brand") {
      const brand = await Brand.findOne({ slug });
      if (!brand) {
        return res
          .status(404)
          .json({ success: false, message: "Brand not found" });
      }
      data = await AnalyticsService.getTimeSeriesData({
        entityType: "brand",
        entityId: brand._id,
        metric: "views",
        startDate,
        endDate,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid entity type" });
    }

    res.json({
      success: true,
      data: {
        data: data.map((item) => ({
          date: item._id,
          value: item.count,
        })),
      },
    });
  } catch (error) {
    console.error("Error in getEntityAnalytics:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching entity analytics" });
  }
});

module.exports = {
  trackSiteVisit,
  trackBrandView,
  trackBrandClick,
  trackProductView,
  trackProductClick,
  trackProductCartAdd,
  trackProductPurchase,
  getSiteAnalytics,
  getBrandAnalytics,
  getProductAnalytics,
  getTopBrands,
  getTopProducts,
  getTimeSeriesReport,
  getEntityAnalytics,
};
