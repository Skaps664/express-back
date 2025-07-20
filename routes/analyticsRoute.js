const express = require("express");
const router = express.Router();
const {
  authMiddleware,
  isAdmin,
  isBrandOwner,
} = require("../middlewares/authMiddleware");
const {
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
  getEntityAnalytics,
  getTimeSeriesReport,
} = require("../controller/analyticsController");

// Tracking Routes (Public)
router.post("/track/visit", trackSiteVisit);
router.post("/track/brand/view", trackBrandView);
router.post("/track/brand/click", trackBrandClick);
router.post("/track/product/view", trackProductView);
router.post("/track/product/click", trackProductClick);
router.post("/track/product/cart-add", trackProductCartAdd);

// Tracking Routes (Private)
router.post("/track/product/purchase", authMiddleware, trackProductPurchase);

// Analytics Report Routes (Admin Only)
router.get("/site", authMiddleware, isAdmin, getSiteAnalytics);
router.get("/top/brands", authMiddleware, isAdmin, getTopBrands);
router.get("/top/products", authMiddleware, isAdmin, getTopProducts);
router.get("/entity/:type/:slug", authMiddleware, isAdmin, getEntityAnalytics);

// Analytics Report Routes (Admin or Brand Owner)
router.get("/brand/:brandId", authMiddleware, isBrandOwner, getBrandAnalytics);
router.get(
  "/product/:productId",
  authMiddleware,
  isBrandOwner,
  getProductAnalytics
);
router.get(
  "/report/time-series",
  authMiddleware,
  isBrandOwner,
  getTimeSeriesReport
);

module.exports = router;
