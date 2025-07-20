// routes/productRoute.js
const express = require("express");
const router = express.Router();

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  uploadProductFiles,
  uploadToCloudinary,
} = require("../middlewares/uploadProductImage");

const {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  debog,
  getCategoryFilters,
  uploadImages,
} = require("../controller/productController");

// Create product route with file upload
router.post(
  "/create",
  authMiddleware,
  isAdmin,
  uploadProductFiles,
  uploadToCloudinary,
  createProduct
);

router.get("/", getAllProducts); // GET all products
router.get("/debog", debog);
router.get("/filters/:slug", getCategoryFilters);
router.get("/category/:slug", getProductsByCategory);
router.put(
  "/update/:id",
  authMiddleware,
  isAdmin,
  uploadProductFiles,
  uploadToCloudinary,
  updateProduct
); // Update product by ID
router.delete("/delete/:id", authMiddleware, isAdmin, deleteProduct); // Delete product by ID
// This should be last as it's a catch-all route with a parameter
router.get("/:slug", getProductBySlug); // GET product by slug

module.exports = router;
