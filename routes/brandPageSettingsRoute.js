const express = require("express");
const router = express.Router();
const { uploadBrandDocuments } = require("../middlewares/uploadBrandImage");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  getBrandPageSettings,
  updateBrandPageSettings,
  uploadWarrantyDocument,
  deleteWarrantyDocument,
  addPromotion,
  deletePromotion,
  updatePromotionStatus,
  getBrandProducts,
} = require("../controller/brandPageSettingsController");

// Get settings for a brand
router.get("/:brandId", authMiddleware, isAdmin, getBrandPageSettings);

// Update brand page settings
router.put("/:brandId", authMiddleware, isAdmin, updateBrandPageSettings);

// Get all products for a brand (for selection in admin)
router.get("/:brandId/products", authMiddleware, isAdmin, getBrandProducts);

// Upload warranty document
router.post(
  "/:brandId/warranty-document",
  authMiddleware,
  isAdmin,
  uploadBrandDocuments.single("document"),
  uploadWarrantyDocument
);

// Delete warranty document
router.delete(
  "/:brandId/warranty-document/:documentId",
  authMiddleware,
  isAdmin,
  deleteWarrantyDocument
);

// Add promotion
router.post(
  "/:brandId/promotion",
  authMiddleware,
  isAdmin,
  uploadBrandDocuments.single("image"),
  addPromotion
);

// Delete promotion
router.delete(
  "/:brandId/promotion/:promotionId",
  authMiddleware,
  isAdmin,
  deletePromotion
);

// Update promotion status
router.patch(
  "/:brandId/promotion/:promotionId",
  authMiddleware,
  isAdmin,
  updatePromotionStatus
);

module.exports = router;
