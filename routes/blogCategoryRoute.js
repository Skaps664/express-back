const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  createBlogCategory,
  getAllBlogCategories,
  getBlogCategoryBySlug,
  updateBlogCategory,
  deleteBlogCategory,
  getBlogCategoryAnalytics,
  clearBlogCategoryCacheEndpoint,
} = require("../controller/blogCategoryController");

// Public routes
router.get("/", getAllBlogCategories);
router.get("/:slug", getBlogCategoryBySlug);

// Admin only routes
router.post("/", authMiddleware, isAdmin, createBlogCategory);
router.put("/:id", authMiddleware, isAdmin, updateBlogCategory);
router.delete("/:id", authMiddleware, isAdmin, deleteBlogCategory);
router.get(
  "/admin/analytics",
  authMiddleware,
  isAdmin,
  getBlogCategoryAnalytics
);
router.post(
  "/admin/clear-cache",
  authMiddleware,
  isAdmin,
  clearBlogCategoryCacheEndpoint
);

module.exports = router;
