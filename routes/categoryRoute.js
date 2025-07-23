const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryBySlug,
  getCategories,
  getFeaturedCategories,
  getCategoryProducts,
  getAllCategoriesAdmin,
  getCategoriesWithBrands,
  getBrandsForCategory,
} = require("../controller/categoryController");

// Public routes
router.get("/", getCategories);
router.get("/navigation", getCategoriesWithBrands);
router.get("/featured", getFeaturedCategories);
router.get("/:slug/products", getCategoryProducts);
router.get("/:slug", getCategoryBySlug);
router.get("/:slug/brands", getBrandsForCategory);

// Admin routes
router.get("/admin/all", authMiddleware, isAdmin, getAllCategoriesAdmin);

// Modification routes
router.post("/new/create", authMiddleware, isAdmin, createCategory);
router.put("/update/:id", authMiddleware, isAdmin, updateCategory);
router.delete("/delete/:id", authMiddleware, isAdmin, deleteCategory);
router.delete("/del/:id", authMiddleware, isAdmin, deleteCategory); // Alternative route for compatibility

module.exports = router;
