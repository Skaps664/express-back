const express = require("express");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  uploadBrandFiles,
  uploadToCloudinary,
} = require("../middlewares/uploadBrandImage");

const {
  getBrandBySlug,
  getAllBrands,
  getAllBrandsAdmin,
  getFeaturedBrands,
  getBrandProducts,
  createBrand,
  updateBrand,
  deleteBrand,
  getProductsByBrandAndCategory,
  searchBrands,
} = require("../controller/brandController");

const router = express.Router();

router.post(
  "/new/create",
  authMiddleware,
  isAdmin,
  uploadBrandFiles,
  uploadToCloudinary,
  createBrand
);
router.put(
  "/update/:slug",
  authMiddleware,
  isAdmin,
  uploadBrandFiles,
  uploadToCloudinary,
  updateBrand
);
router.get("/", getAllBrands);
router.get("/admin/all", authMiddleware, isAdmin, getAllBrandsAdmin);
router.get("/featured", getFeaturedBrands);
router.get("/search", authMiddleware, searchBrands);
// The order of these routes is important - more specific routes should come first
router.get("/:slug/products", getBrandProducts);
router.get("/:brandSlug/:categorySlug", getProductsByBrandAndCategory);
router.get("/:slug", getBrandBySlug);
router.delete("/del/:slug", authMiddleware, isAdmin, deleteBrand);

module.exports = router;

// 683ec87a4025d8111fcfc2d9
