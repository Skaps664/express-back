const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const uploadBlogImage = require("../middlewares/uploadBlogImage");
const {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  getFeaturedBlogs,
  getBlogsByCategory,
  searchBlogs,
  addComment,
  getBlogAnalytics,
  uploadBlogThumbnail,
  uploadBlogContentImage,
} = require("../controller/blogController");

// Public routes
router.get("/", getAllBlogs);
router.get("/featured", getFeaturedBlogs);
router.get("/search", searchBlogs);
router.get("/category/:slug", getBlogsByCategory);
router.get("/:slug", getBlogBySlug);

// Protected routes
router.post("/:id/comments", authMiddleware, addComment);

// Admin only routes
router.post("/", authMiddleware, isAdmin, createBlog);
router.put("/:id", authMiddleware, isAdmin, updateBlog);
router.delete("/:id", authMiddleware, isAdmin, deleteBlog);
router.get("/admin/analytics", authMiddleware, isAdmin, getBlogAnalytics);

// Image upload routes
router.post(
  "/upload/thumbnail",
  authMiddleware,
  isAdmin,
  uploadBlogImage.single("thumbnail"),
  uploadBlogThumbnail
);
router.post(
  "/upload/content-image",
  authMiddleware,
  isAdmin,
  uploadBlogImage.single("image"),
  uploadBlogContentImage
);

module.exports = router;
