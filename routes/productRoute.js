// routes/productRoute.js
const express = require("express");
const router = express.Router();

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  cacheConfigs,
  invalidateCache,
} = require("../middlewares/cacheMiddleware");
const {
  uploadProductFiles,
  uploadToCloudinary,
} = require("../middlewares/uploadProductImage");

const {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  getFeaturedProducts,
  updateProduct,
  deleteProduct,
  debog,
  getCategoryFilters,
  uploadImages,
} = require("../controller/productController");

// Create product route with file upload and cache invalidation
router.post(
  "/create",
  authMiddleware,
  isAdmin,
  uploadProductFiles,
  uploadToCloudinary,
  async (req, res, next) => {
    await createProduct(req, res, next);
    // Invalidate product caches after creation
    await invalidateCache.products();
    await invalidateCache.catalog();
  }
);

// Cached routes for high performance
// GET all products with caching
router.get("/", cacheConfigs.products, getAllProducts);

// Admin endpoint without caching for real-time data
router.get("/admin/all", authMiddleware, isAdmin, getAllProducts);
router.get("/featured", cacheConfigs.products, getFeaturedProducts); // GET featured products with caching
router.get("/debog", debog);
router.get("/filters/:slug", cacheConfigs.categories, getCategoryFilters); // Cache category filters
router.get("/category/:slug", cacheConfigs.products, getProductsByCategory); // Cache category products

// Update product with cache invalidation
router.put(
  "/update/:id",
  authMiddleware,
  isAdmin,
  uploadProductFiles,
  uploadToCloudinary,
  async (req, res, next) => {
    await updateProduct(req, res, next);
    // Invalidate specific product and related caches
    await invalidateCache.products(req.params.id);
    await invalidateCache.catalog();
  }
);

// Delete product with cache invalidation
router.delete(
  "/delete/:id",
  authMiddleware,
  isAdmin,
  async (req, res, next) => {
    await deleteProduct(req, res, next);
    // Invalidate specific product and related caches
    await invalidateCache.products(req.params.id);
    await invalidateCache.catalog();
    // Also invalidate the main products list cache more aggressively
    await invalidateCache.all();
  }
);

// This should be last as it's a catch-all route with a parameter
router.get("/:slug", cacheConfigs.productDetail, getProductBySlug); // GET product by slug with caching

module.exports = router;
