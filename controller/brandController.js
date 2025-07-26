const Brand = require("../models/BrandModel");
const asyncHandler = require("express-async-handler");
const Product = require("../models/ProductsModel");
const Category = require("../models/CategoryModel");
const BrandPageSettings = require("../models/BrandPageSettingsModel");
const { cloudinaryUploadImage } = require("../utils/cloudinary");

const createBrand = asyncHandler(async (req, res) => {
  try {
    // Upload logo
    let logoUrl = req.body.logo;
    if (req.files && req.files.logo && req.files.logo[0]) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${
          req.files.logo[0].mimetype
        };base64,${req.files.logo[0].buffer.toString("base64")}`,
        "image"
      );
      logoUrl = uploadRes.url;
    }

    // Upload banner
    let bannerUrl = req.body.banner;
    if (req.files && req.files.banner && req.files.banner[0]) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${
          req.files.banner[0].mimetype
        };base64,${req.files.banner[0].buffer.toString("base64")}`,
        "image"
      );
      bannerUrl = uploadRes.url;
    }

    // Upload thumbnail (optional)
    let thumbnailUrl = req.body.thumbnail;
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${
          req.files.thumbnail[0].mimetype
        };base64,${req.files.thumbnail[0].buffer.toString("base64")}`,
        "image"
      );
      thumbnailUrl = uploadRes.url;
    }

    const {
      name,
      slug,
      tagline,
      description,
      establishedYear,
      headquarters,
      featuredProducts,
      categories, // Changed from productCategories
      isFeatured,
      isActive,
      createdBy,
    } = req.body;

    if (!logoUrl || !bannerUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Logo and banner are required." });
    }
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required.",
      });
    }

    const brandExists = await Brand.findOne({ slug });
    if (brandExists) {
      res.status(400);
      throw new Error("Brand with this slug already exists");
    }

    const brand = await Brand.create({
      name,
      slug,
      tagline,
      description,
      logo: logoUrl,
      banner: bannerUrl,
      thumbnail: thumbnailUrl,
      establishedYear,
      headquarters,
      featuredProducts,
      categories, // Changed from productCategories
      isFeatured: isFeatured === "true" || isFeatured === true,
      isActive: isActive === "true" || isActive === true,
      createdBy,
    });

    res.status(201).json(brand);
  } catch (err) {
    console.error("Brand Creation Error:", err);
    res.status(500).json({ success: false, message: "Brand creation failed" });
  }
});

// @desc    Get brand by slug
// @route   GET /api/brands/:slug
// @access  Public
const getBrandBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const brand = await Brand.findOne({ slug })
    .populate({
      path: "featuredProducts",
      select:
        "name slug price originalPrice discountPercentage images specifications",
      // Only include active products if that field exists
      match:
        typeof Product.schema.paths.isActive !== "undefined"
          ? { isActive: true }
          : {},
    })
    .populate({
      path: "categories",
      select: "name slug",
    });

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Brand not found",
    });
  }

  // Only check isActive if that field exists in the schema
  if (brand.isActive === false) {
    res.status(404);
    throw new Error("Brand is not active");
  }

  // Get all products count for this brand
  const productCount = await Product.countDocuments({
    brand: brand._id,
    ...(typeof Product.schema.paths.isActive !== "undefined"
      ? { isActive: true }
      : {}),
  });

  // Update the product count if different
  if (brand.allProductCount !== productCount) {
    brand.allProductCount = productCount;
    await brand.save();
  }

  // Get best sellers from this brand (optional)
  const bestSellers = await Product.find({
    brand: brand._id,
    isBestSeller: true,
    ...(typeof Product.schema.paths.isActive !== "undefined"
      ? { isActive: true }
      : {}),
  })
    .select("name slug price images")
    .limit(4);

  // Get brand page settings if available
  const brandPageSettings = await BrandPageSettings.findOne({
    brand: brand._id,
  }).populate(
    "featuredProducts",
    "name slug price originalPrice discountPercentage images"
  );

  // Get current active promotions
  let activePromotions = [];
  if (brandPageSettings && brandPageSettings.promotions) {
    const now = new Date();
    activePromotions = brandPageSettings.promotions.filter(
      (promo) =>
        promo.isActive &&
        new Date(promo.startDate) <= now &&
        new Date(promo.endDate) >= now
    );
  }

  res.json({
    ...brand.toObject(),
    bestSellers,
    banner: brand.banner || getDefaultBanner(brand.name),
    pageSettings: brandPageSettings
      ? {
          aboutContent: brandPageSettings.aboutContent,
          whyChooseReasons: brandPageSettings.whyChooseReasons,
          featuredProducts: brandPageSettings.featuredProducts,
          warrantyInformation: brandPageSettings.warrantyInformation,
          technicalSupportInfo: brandPageSettings.technicalSupportInfo,
          faqs: brandPageSettings.faqs,
          activePromotions,
        }
      : null,
  });
});

// @desc    Get all active brands
// @route   GET /api/brands
// @access  Public
const getAllBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({ isActive: true })
    .select("name slug logo thumbnail allProductCount")
    .sort({ name: 1 });

  res.json(brands);
});

// @desc    Get featured brands
// @route   GET /api/brands/featured
// @access  Public
const getFeaturedBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({
    isFeatured: true,
    isActive: true,
  })
    .select("name slug logo thumbnail")
    .limit(8)
    .sort({ name: 1 });

  res.json(brands);
});

// @route   GET /api/brands/:slug/products
// @access  Public
const getBrandProducts = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  console.log("Fetching brand products for slug:", slug);

  // 1. Find brand by slug
  const brand = await Brand.findOne({ slug });
  if (!brand) {
    console.error("Brand not found for slug:", slug);
    return res.status(404).json({ success: false, message: "Brand not found" });
  }

  console.log("Brand found:", brand._id);

  // 2. Build query with a check for isActive field existence
  const hasIsActive = typeof Product.schema.paths.isActive !== "undefined";

  const query = {
    brand: brand._id,
  };

  if (hasIsActive) {
    query.isActive = true;
  }

  console.log("Query for products:", JSON.stringify(query));

  // 3. Fetch all products without pagination
  const products = await Product.find(query)
    .select("name slug price originalPrice discountPercentage images")
    .populate("category", "name slug")
    .sort("-createdAt");

  console.log("Products fetched count:", products.length);

  // 4. Return response
  res.status(200).json({
    success: true,
    products,
    brand: {
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
    },
    total: products.length,
  });
});

// @desc    Update an existing brand
// @route   PUT /api/brands/:slug
// @access  Public
const updateBrand = asyncHandler(async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      name,
      tagline,
      description,
      establishedYear,
      headquarters,
      featuredProducts,
      categories, // Changed from productCategories
      isFeatured,
      isActive,
      updatedBy,
    } = req.body;

    const brand = await Brand.findOne({ slug });
    if (!brand) {
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    }

    // Upload new logo if provided
    if (req.files && req.files.logo && req.files.logo[0]) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${
          req.files.logo[0].mimetype
        };base64,${req.files.logo[0].buffer.toString("base64")}`,
        "image"
      );
      brand.logo = uploadRes.url;
    }

    // Upload new banner if provided
    if (req.files && req.files.banner && req.files.banner[0]) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${
          req.files.banner[0].mimetype
        };base64,${req.files.banner[0].buffer.toString("base64")}`,
        "image"
      );
      brand.banner = uploadRes.url;
    }

    // Upload new thumbnail if provided
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${
          req.files.thumbnail[0].mimetype
        };base64,${req.files.thumbnail[0].buffer.toString("base64")}`,
        "image"
      );
      brand.thumbnail = uploadRes.url;
    }

    // Update other fields if provided in req.body
    brand.name = name || brand.name;
    brand.slug = slug || brand.slug;
    brand.tagline = tagline || brand.tagline;
    brand.description = description || brand.description;
    brand.establishedYear = establishedYear || brand.establishedYear;
    brand.headquarters = headquarters || brand.headquarters;
    brand.featuredProducts = featuredProducts || brand.featuredProducts;
    brand.categories = categories || brand.categories; // Changed from productCategories
    brand.isFeatured =
      isFeatured === "true" || isFeatured === true
        ? true
        : isFeatured === "false" || isFeatured === false
        ? false
        : brand.isFeatured;
    brand.isActive =
      isActive === "true" || isActive === true
        ? true
        : isActive === "false" || isActive === false
        ? false
        : brand.isActive;
    brand.updatedBy = updatedBy || brand.updatedBy;

    const updatedBrand = await brand.save();
    res.json(updatedBrand);
  } catch (err) {
    console.error("Brand Update Error:", err);
    res.status(500).json({ success: false, message: "Brand update failed" });
  }
});

// Helper function for default banner
const getDefaultBanner = (brandName) => {
  // Implement your default banner logic or use a placeholder
  return `/images/default-banners/${brandName
    .toLowerCase()
    .replace(/\s+/g, "-")}.jpg`;
};

const deleteBrand = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const brand = await Brand.findOne({ slug });
  if (!brand) {
    res.status(404);
    throw new Error("Brand not found");
  }
  await Brand.deleteOne({ _id: brand._id });
  res.json({ success: true, message: "Brand deleted successfully" });
});

// @desc    Get all brands for admin
// @route   GET /api/brands/admin/all
// @access  Private/Admin
const getAllBrandsAdmin = asyncHandler(async (req, res) => {
  const brands = await Brand.find({})
    .select(
      "name slug logo banner thumbnail description tagline establishedYear headquarters allProductCount isFeatured isActive categories createdAt updatedAt"
    )
    .populate({ path: "categories", select: "_id name" })
    .sort({ createdAt: -1 });

  // Update product counts for all brands
  for (const brand of brands) {
    await Brand.updateProductCount(brand._id);
  }

  // Fetch updated brands with correct product counts
  const updatedBrands = await Brand.find({})
    .select(
      "name slug logo banner thumbnail description tagline establishedYear headquarters allProductCount isFeatured isActive categories createdAt updatedAt"
    )
    .populate({ path: "categories", select: "_id name" })
    .sort({ createdAt: -1 });

  res.json(updatedBrands);
});

const getProductsByBrandAndCategory = asyncHandler(async (req, res) => {
  const { brandSlug, categorySlug } = req.params;

  console.log("Fetching brand and category:", { brandSlug, categorySlug });

  const brand = await Brand.findOne({ slug: brandSlug });
  if (!brand) {
    console.error("Brand not found:", brandSlug);
    return res.status(404).json({ success: false, message: "Brand not found" });
  }

  const category = await Category.findOne({ slug: categorySlug });
  if (!category) {
    console.error("Category not found:", categorySlug);
    return res
      .status(404)
      .json({ success: false, message: "Category not found" });
  }

  console.log("Found brand and category:", {
    brand: brand._id,
    brandName: brand.name,
    category: category._id,
    categoryName: category.name,
  });

  // Check if isActive field exists in the schema and add to query conditionally
  const hasIsActive = typeof Product.schema.paths.isActive !== "undefined";

  const query = {
    brand: brand._id,
    category: category._id,
  };

  if (hasIsActive) {
    query.isActive = true;
  }

  console.log("Product query:", JSON.stringify(query));

  const products = await Product.find(query)
    .select("name slug price originalPrice discountPercentage images")
    .lean();

  console.log(
    `Fetched ${products.length} products for brand ${brand.name} and category ${category.name}`
  );

  // Return products array
  res.json(products);
});

// Search brands for analytics
const searchBrands = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.json({ success: true, data: [] });
  }

  try {
    const searchRegex = new RegExp(
      q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),
      "i"
    );

    const brands = await Brand.find({
      $or: [
        { name: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
        { tagline: searchRegex },
      ],
    })
      .select("name slug")
      .limit(20);

    res.json({
      success: true,
      data: brands,
    });
  } catch (error) {
    console.error("Brand search error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching brands",
    });
  }
});

module.exports = {
  createBrand,
  getBrandBySlug,
  updateBrand,
  deleteBrand,
  getAllBrands,
  getFeaturedBrands,
  getProductsByBrandAndCategory,
  getAllBrandsAdmin,
  getBrandProducts,
  searchBrands,
};
