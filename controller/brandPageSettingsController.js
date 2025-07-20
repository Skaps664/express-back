const BrandPageSettings = require("../models/BrandPageSettingsModel");
const Brand = require("../models/BrandModel");
const Products = require("../models/ProductsModel");
const {
  cloudinaryUploadBuffer,
  cloudinaryDeleteFile,
} = require("../utils/cloudinary");

// Get settings for a specific brand
exports.getBrandPageSettings = async (req, res) => {
  try {
    const { brandId } = req.params;

    const settings = await BrandPageSettings.findOne({ brand: brandId })
      .populate("brand", "name slug")
      .populate(
        "featuredProducts",
        "name slug images price originalPrice stock"
      );

    if (!settings) {
      return res.status(200).json({
        success: true,
        message: "No settings found for this brand",
        settings: null,
      });
    }

    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error fetching brand page settings:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching brand page settings",
      error: error.message,
    });
  }
};

// Create or update brand page settings
exports.updateBrandPageSettings = async (req, res) => {
  try {
    const { brandId } = req.params;

    // Verify brand exists
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // Extract data from request body
    const {
      aboutContent,
      whyChooseReasons,
      featuredProducts,
      warrantyInformation,
      technicalSupportInfo,
      faqs,
    } = req.body;

    // Find existing settings or create new one
    let settings = await BrandPageSettings.findOne({ brand: brandId });

    if (!settings) {
      settings = new BrandPageSettings({
        brand: brandId,
      });
    }

    // Update text fields
    if (aboutContent !== undefined) settings.aboutContent = aboutContent;
    if (warrantyInformation !== undefined)
      settings.warrantyInformation = warrantyInformation;
    if (technicalSupportInfo !== undefined)
      settings.technicalSupportInfo = technicalSupportInfo;

    // Update arrays if provided
    try {
      if (whyChooseReasons) {
        const parsedReasons =
          typeof whyChooseReasons === "string"
            ? JSON.parse(whyChooseReasons)
            : whyChooseReasons;
        settings.whyChooseReasons = parsedReasons;
      }

      if (featuredProducts) {
        const parsedProducts =
          typeof featuredProducts === "string"
            ? JSON.parse(featuredProducts)
            : featuredProducts;
        settings.featuredProducts = parsedProducts;
      }

      if (faqs) {
        const parsedFaqs = typeof faqs === "string" ? JSON.parse(faqs) : faqs;
        settings.faqs = parsedFaqs;
      }
    } catch (parseError) {
      console.error("Error parsing JSON data:", parseError);
      return res.status(400).json({
        success: false,
        message: "Invalid JSON data format",
        error: parseError.message,
      });
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Brand page settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Error updating brand page settings:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating brand page settings",
      error: error.message,
    });
  }
};

// Upload warranty document
exports.uploadWarrantyDocument = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { title } = req.body;

    // Log the incoming request data
    console.log("Adding promotion:", {
      brandId,
      title,
      description,
      displayTab,
      startDate,
      endDate,
      fileExists: !!req.file,
    });

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No document file provided",
      });
    }

    // Upload file buffer directly to cloudinary
    const result = await cloudinaryUploadBuffer(
      req.file.buffer,
      "solar_express/brand_documents",
      req.file.mimetype
    );

    // Find or create settings
    let settings = await BrandPageSettings.findOne({ brand: brandId });
    if (!settings) {
      settings = new BrandPageSettings({ brand: brandId });
    }

    // Add new document
    settings.warrantyDocuments.push({
      title,
      documentUrl: result.secure_url,
      documentPublicId: result.public_id,
    });

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Warranty document uploaded successfully",
      document:
        settings.warrantyDocuments[settings.warrantyDocuments.length - 1],
    });
  } catch (error) {
    console.error("Error uploading warranty document:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading warranty document",
      error: error.message,
    });
  }
};

// Delete warranty document
exports.deleteWarrantyDocument = async (req, res) => {
  try {
    const { brandId, documentId } = req.params;

    // Find settings
    const settings = await BrandPageSettings.findOne({ brand: brandId });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Brand page settings not found",
      });
    }

    // Find document
    const docIndex = settings.warrantyDocuments.findIndex(
      (doc) => doc._id.toString() === documentId
    );

    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Delete from cloudinary
    const publicId = settings.warrantyDocuments[docIndex].documentPublicId;
    await cloudinaryDeleteFile(publicId);

    // Remove from array
    settings.warrantyDocuments.splice(docIndex, 1);
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting warranty document:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting warranty document",
      error: error.message,
    });
  }
};

// Upload promotion image
exports.addPromotion = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { title, description, displayTab, startDate, endDate, isActive } =
      req.body;

    console.log("Adding promotion:", {
      brandId,
      title,
      description,
      displayTab,
      startDate,
      endDate,
      fileExists: !!req.file,
    });

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Upload file buffer directly to cloudinary
    console.log("Uploading image to cloudinary...");
    const result = await cloudinaryUploadBuffer(
      req.file.buffer,
      "solar_express/brand_promotions",
      req.file.mimetype
    );
    console.log("Cloudinary upload result:", result);

    // Find or create settings
    let settings = await BrandPageSettings.findOne({ brand: brandId });
    if (!settings) {
      settings = new BrandPageSettings({ brand: brandId });
    }

    // Parse dates if they're strings
    let parsedStartDate = startDate;
    let parsedEndDate = endDate;

    try {
      if (typeof startDate === "string") {
        parsedStartDate = new Date(startDate);
      }

      if (typeof endDate === "string") {
        parsedEndDate = new Date(endDate);
      }
    } catch (dateError) {
      console.error("Error parsing dates:", dateError);
      // Fall back to default dates
      parsedStartDate = new Date();
      parsedEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Add new promotion
    settings.promotions.push({
      title,
      description,
      imageUrl: result.secure_url,
      imagePublicId: result.public_id,
      displayTab: displayTab || "all",
      startDate: parsedStartDate || new Date(),
      endDate: parsedEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      isActive: isActive !== undefined ? isActive : true,
    });

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Promotion added successfully",
      promotion: settings.promotions[settings.promotions.length - 1],
    });
  } catch (error) {
    console.error("Error adding promotion:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding promotion",
      error: error.message,
    });
  }
};

// Delete promotion
exports.deletePromotion = async (req, res) => {
  try {
    const { brandId, promotionId } = req.params;

    // Find settings
    const settings = await BrandPageSettings.findOne({ brand: brandId });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Brand page settings not found",
      });
    }

    // Find promotion
    const promoIndex = settings.promotions.findIndex(
      (promo) => promo._id.toString() === promotionId
    );

    if (promoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    // Delete from cloudinary
    const publicId = settings.promotions[promoIndex].imagePublicId;
    await cloudinaryDeleteFile(publicId);

    // Remove from array
    settings.promotions.splice(promoIndex, 1);
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Promotion deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting promotion",
      error: error.message,
    });
  }
};

// Update promotion status
exports.updatePromotionStatus = async (req, res) => {
  try {
    const { brandId, promotionId } = req.params;
    const { isActive } = req.body;

    // Find settings
    const settings = await BrandPageSettings.findOne({ brand: brandId });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Brand page settings not found",
      });
    }

    // Find promotion
    const promoIndex = settings.promotions.findIndex(
      (promo) => promo._id.toString() === promotionId
    );

    if (promoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found",
      });
    }

    // Update status
    settings.promotions[promoIndex].isActive = isActive;
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Promotion status updated successfully",
    });
  } catch (error) {
    console.error("Error updating promotion status:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating promotion status",
      error: error.message,
    });
  }
};

// Get all products for a brand (for selection in admin panel)
exports.getBrandProducts = async (req, res) => {
  try {
    const { brandId } = req.params;

    const products = await Products.find({ brand: brandId }).select(
      "_id name slug images price"
    );

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error fetching brand products:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching brand products",
      error: error.message,
    });
  }
};
