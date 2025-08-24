const express = require("express");
const asyncHandler = require("express-async-handler");
const Product = require("../models/ProductsModel");
const Category = require("../models/CategoryModel");
const categoryFilters = require("../utils/categoryFilters");
const { cloudinaryUploadImage } = require("../utils/cloudinary");
const validateMongoId = require("../utils/validateMongoId"); // or your inline function

// Helper to get sort object from query
function getSortObject(sort) {
  switch (sort) {
    case "price_asc":
      return { price: 1 };
    case "price_desc":
      return { price: -1 };
    case "popularity":
      return { viewCount: -1 }; // or use reviews.count if you prefer
    case "top_selling":
      return { "variants.sold": -1 }; // assumes you track sold in variants
    case "newest":
      return { createdAt: -1 };
    default:
      return { createdAt: -1 };
  }
}

// Get all products with sorting and pagination
const getAllProducts = asyncHandler(async (req, res) => {
  console.log("Request URL:", req.originalUrl);
  console.log(
    "Auth user:",
    req.user ? { id: req.user._id, role: req.user.role } : "No user"
  );

  const sort = req.query.sort || "newest";
  const sortObj = getSortObject(sort);
  const isAdmin = req.originalUrl.includes("/admin/all");
  console.log("Is admin request:", isAdmin);

  // For admin routes, show all products. For public routes, only show active ones
  let query = {};

  // Basic validation
  try {
    const totalProducts = await Product.countDocuments({});
    console.log("Total products in database:", totalProducts);
  } catch (error) {
    console.error("Error counting products:", error);
  }

  // Universal filters
  if (req.query.brand) query.brand = req.query.brand;
  if (req.query.isFeatured) query.isFeatured = req.query.isFeatured === "true";
  if (req.query.isBestSeller)
    query.isBestSeller = req.query.isBestSeller === "true";
  if (req.query.price_min || req.query.price_max) {
    query.price = {};
    if (req.query.price_min) query.price.$gte = Number(req.query.price_min);
    if (req.query.price_max) query.price.$lte = Number(req.query.price_max);
  }
  if (req.query.rating_min || req.query.rating_max) {
    query["reviews.rating"] = {};
    if (req.query.rating_min)
      query["reviews.rating"].$gte = Number(req.query.rating_min);
    if (req.query.rating_max)
      query["reviews.rating"].$lte = Number(req.query.rating_max);
  }

  // SEARCH FUNCTIONALITY - SIMPLIFIED AND FIXED
  if (req.query.search && req.query.search.trim() !== "") {
    const searchRegex = new RegExp(
      req.query.search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),
      "i"
    );
    query.$or = [
      { name: searchRegex },
      { slug: searchRegex },
      { "specifications.items.value": searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
    ];
  }

  // Dynamic specification filters - simplified
  Object.entries(req.query).forEach(([key, value]) => {
    // Skip internal query params and empty values
    const skipParams = [
      "brand",
      "isFeatured",
      "isBestSeller",
      "price_min",
      "price_max",
      "rating_min",
      "rating_max",
      "sort",
      "category",
      "page",
      "limit",
      "search",
      "_t", // Skip timestamp parameter
    ];

    if (!skipParams.includes(key) && value && value.trim() !== "") {
      const specFilter = {};
      if (key.endsWith("_min")) {
        const field = key.replace("_min", "");
        specFilter[`specifications.${field}.min`] = Number(value);
      } else if (key.endsWith("_max")) {
        const field = key.replace("_max", "");
        specFilter[`specifications.${field}.max`] = Number(value);
      } else {
        // For exact matches
        specFilter[`specifications.${key}`] = value;
      }
      Object.assign(query, specFilter);
    }
  });

  // Pagination - moved before category filter to fix scoping issue
  const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
  const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
  const skip = (page - 1) * limit;

  // Category filter
  if (req.query.category) {
    const categoryDoc = await Category.findOne({ slug: req.query.category });
    if (categoryDoc) {
      query.category = categoryDoc._id;
    } else {
      // If category not found by slug, return empty results
      // This prevents ObjectId cast errors
      return res.json({
        success: true,
        products: [],
        pagination: {
          page: 1,
          limit: limit,
          total: 0,
          pages: 0,
        },
        message: `Category '${req.query.category}' not found`,
      });
    }
  }

  // Enable aggressive caching for better performance
  const cacheKey = `products:${JSON.stringify(query)}:${sort}:${page}:${limit}`;
  const { getFromCache, setCache } = require("../utils/redisCache");

  // Try cache first (5 minute cache)
  const cachedResult = await getFromCache(cacheKey);
  if (cachedResult) {
    console.log("🚀 Serving from cache:", cacheKey);
    return res.status(200).json(cachedResult);
  }

  // Set appropriate cache headers (cache for 5 minutes)
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.setHeader("ETag", `"${Date.now()}"`);

  // Detailed debug logging
  console.log("Final query:", JSON.stringify(query, null, 2));
  console.log("Sort config:", JSON.stringify(sortObj, null, 2));
  console.log("Pagination:", { page, limit, skip });

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("brand", "name slug logo")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .select(
        "name slug price originalPrice discountPercentage stock images specifications isFeatured isBestSeller isNewArrival isActive reviews viewCount variants tags keyFeatures videos shippingInfo createdAt updatedAt"
      )
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(), // Add lean() for 2-3x faster queries
    Product.countDocuments(query),
  ]);

  console.log("Found products:", products.length);
  console.log("Total products:", total);

  const result = {
    success: true,
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };

  // Cache the result for 5 minutes
  await setCache(cacheKey, result, 300);

  res.json(result);
});

// Get products by category with sorting and pagination
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const sort = req.query.sort || "newest";
  const sortObj = getSortObject(sort);

  // Find category
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  let query = { category: category._id };

  // Universal filters
  if (req.query.brand) query.brand = req.query.brand;
  if (req.query.isFeatured) query.isFeatured = req.query.isFeatured === "true";
  if (req.query.isBestSeller)
    query.isBestSeller = req.query.isBestSeller === "true";
  if (req.query.price_min || req.query.price_max) {
    query.price = {};
    if (req.query.price_min) query.price.$gte = Number(req.query.price_min);
    if (req.query.price_max) query.price.$lte = Number(req.query.price_max);
  }
  if (req.query.rating_min || req.query.rating_max) {
    query["reviews.rating"] = {};
    if (req.query.rating_min)
      query["reviews.rating"].$gte = Number(req.query.rating_min);
    if (req.query.rating_max)
      query["reviews.rating"].$lte = Number(req.query.rating_max);
  }

  if (req.query.search) {
    const searchRegex = new RegExp(escapeRegex(req.query.search), "i");
    const searchConditions = [
      { name: searchRegex },
      { slug: searchRegex },
      { "specifications.items.value": searchRegex },
      { "brand.name": searchRegex }, // This requires proper population
      { "category.name": searchRegex }, // This requires proper population
      { description: searchRegex },
      { tags: searchRegex },
    ];

    // If there are other filters, combine with $and, otherwise use $or directly
    if (Object.keys(query).length > 0) {
      query.$and = query.$and || [];
      query.$and.push({ $or: searchConditions });
    } else {
      query.$or = searchConditions;
    }
  }

  // Helper function to escape regex special characters
  function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }

  // Dynamic specification filters
  const specFilters = [];
  Object.entries(req.query).forEach(([key, value]) => {
    if (
      ![
        "brand",
        "isFeatured",
        "isBestSeller",
        "price_min",
        "price_max",
        "rating_min",
        "rating_max",
        "sort",
        "page",
        "limit",
      ].includes(key)
    ) {
      if (key.endsWith("_min")) {
        const field = key.replace("_min", "");
        specFilters.push({
          "specifications.items": {
            $elemMatch: { name: field, value: { $gte: Number(value) } },
          },
        });
      } else if (key.endsWith("_max")) {
        const field = key.replace("_max", "");
        specFilters.push({
          "specifications.items": {
            $elemMatch: { name: field, value: { $lte: Number(value) } },
          },
        });
      } else {
        specFilters.push({
          "specifications.items": { $elemMatch: { name: key, value: value } },
        });
      }
    }
  });
  // Combine all $and conditions (search and specFilters)
  if (specFilters.length > 0) {
    if (!query.$and) query.$and = [];
    query.$and.push(...specFilters);
  }

  // Pagination logic
  const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
  const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
  const skip = (page - 1) * limit;

  let projection = {};
  let sortQuery = sortObj;

  if (query.$text) {
    projection = { score: { $meta: "textScore" } };
    sortQuery = { score: { $meta: "textScore" } };
  }

  const [products, total] = await Promise.all([
    Product.find(query, projection)
      .sort(sortQuery)
      .populate("brand", "name slug") // Already correct
      .populate("category", "name slug") // Already correct
      .select(
        "name slug price originalPrice discountPercentage stock images specifications isFeatured isBestSeller reviews viewCount variants"
      )
      .sort(sortObj)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(query),
  ]);

  res.json({
    success: true,
    category: {
      name: category.name,
      slug: category.slug,
      image: category.image,
    },
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
});

// Create product
const createProduct = asyncHandler(async (req, res) => {
  try {
    console.log("==== Product Creation Debug ====");
    console.log("Files in request:", req.files);
    console.log("Full request body:", req.body);
    console.log("Documents in request:", req.body.documents);
    console.log("Document types in request:", req.body.documentTypes);
    const {
      name,
      slug,
      brand,
      category,
      subCategory,
      price,
      originalPrice,
      stock,
      description,
      keyFeatures,
      specifications,
      tags,
      shippingInfo,
      isFeatured,
      isBestSeller,
      isNewArrival,
      createdBy,
      viewCount,
      relatedProducts,
      videos,
      documents,
    } = req.body;

    // Parse JSON fields with error handling
    let parsedKeyFeatures,
      parsedSpecifications,
      parsedTags,
      parsedShippingInfo,
      parsedRelatedProducts,
      parsedVideos;

    const validateJSON = (jsonString, defaultValue) => {
      try {
        return JSON.parse(jsonString);
      } catch {
        return defaultValue;
      }
    };

    parsedKeyFeatures = validateJSON(keyFeatures, []);
    parsedSpecifications = validateJSON(specifications, []);
    parsedTags = validateJSON(tags, []);
    parsedShippingInfo = validateJSON(shippingInfo, {});
    parsedRelatedProducts = validateJSON(relatedProducts, []);

    // Process videos - convert simple URLs to structured objects
    parsedVideos = Array.isArray(videos) ? videos : validateJSON(videos, []);
    parsedVideos = parsedVideos.map((video, index) => {
      if (typeof video === "string") {
        // Convert simple URL string to structured object
        const getVideoId = (url) => {
          if (!url) return "";
          try {
            if (url.includes("youtube.com/watch")) {
              return new URL(url).searchParams.get("v") || "";
            }
            if (url.includes("youtu.be/")) {
              return url.split("youtu.be/")[1]?.split("?")[0] || "";
            }
            return "";
          } catch {
            return "";
          }
        };

        return {
          id: `video_${Date.now()}_${index}`,
          title: `Product Video ${index + 1}`,
          description: "",
          url: video,
          videoId: getVideoId(video),
          duration: "",
          views: "",
        };
      }
      // If already an object, ensure it has required fields
      return {
        id: video.id || `video_${Date.now()}_${index}`,
        title: video.title || `Product Video ${index + 1}`,
        description: video.description || "",
        url: video.url || video,
        videoId: video.videoId || "",
        duration: video.duration || "",
        views: video.views || "",
      };
    });

    // Handle file uploads (middleware already uploaded to Cloudinary)
    let imageUrls = [];
    if (req.body.images && Array.isArray(req.body.images)) {
      imageUrls = req.body.images;
      console.log("Using images from middleware:", imageUrls);
    }

    let documentObjs = [];

    // Check if documents were processed by middleware (uploaded files)
    if (req.body.documents && Array.isArray(req.body.documents)) {
      // Documents already processed by middleware
      documentObjs = req.body.documents;
      console.log("Using documents from middleware:", documentObjs);
    } else if (req.body.documents) {
      // Handle JSON string format (for existing/manual document URLs)
      try {
        documentObjs = Array.isArray(req.body.documents)
          ? req.body.documents
          : JSON.parse(req.body.documents);

        console.log("Incoming documents before processing:", documentObjs);

        // Validate and ensure each document has required fields
        documentObjs = documentObjs
          .filter((doc) => {
            if (!doc.url) {
              console.error("Document missing required URL:", doc);
              return false;
            }
            return true;
          })
          .map((doc) => ({
            id:
              doc.id ||
              `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: doc.name || "Untitled Document",
            type: doc.type || "other",
            url: doc.url,
            size: doc.size || 0,
            uploadedAt: doc.uploadedAt || new Date(),
          }));

        console.log("Processed documents:", documentObjs);
      } catch (error) {
        console.error("Error processing documents:", error);
        console.log("Raw documents data:", req.body.documents);
      }
    }

    console.log("Final documents array for saving:", documentObjs);

    const newProduct = new Product({
      name,
      slug,
      brand,
      category,
      subCategory,
      price,
      originalPrice,
      stock,
      description,
      keyFeatures: parsedKeyFeatures,
      specifications: parsedSpecifications,
      tags: parsedTags,
      shippingInfo: parsedShippingInfo,
      images: imageUrls,
      documents: documentObjs, // Add documents to the product
      isFeatured: isFeatured === "true",
      isBestSeller: isBestSeller === "true",
      isNewArrival: isNewArrival === "true",
      createdBy,
      viewCount: Number(viewCount) || 0,
      relatedProducts: parsedRelatedProducts,
      videos: parsedVideos,
      documents: documentObjs,
    });

    await newProduct.save();
    res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    console.error("Product creation error:", err);
    res.status(500).json({
      success: false,
      message: "Product creation failed",
      error: err.message,
    });
  }
});

// Update product
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let updateData = { ...req.body };

  // 1. Handle images
  let imageUrls = [];
  if (req.files && req.files.images) {
    for (const file of req.files.images) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        "image"
      );
      imageUrls.push(uploadRes.url);
    }
    // Optionally, append or replace images
    updateData.images = (updateData.images || []).concat(imageUrls);
  }

  // 2. Handle documents (PDFs)
  let documentObjs = [];
  if (req.files && req.files.documents) {
    for (const file of req.files.documents) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        "raw"
      );
      documentObjs.push({
        name: file.originalname,
        type: req.body[`documentType_${file.originalname}`] || "other",
        url: uploadRes.url,
        size: Math.round(file.size / 1024),
        uploadedAt: new Date(),
      });
    }
    // Optionally, append or replace documents
    updateData.documents = (updateData.documents || []).concat(documentObjs);
  }

  const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updatedProduct) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  res.status(200).json({ success: true, product: updatedProduct });
});

// Delete product
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log("🗑️ Attempting to delete product with ID:", id);

  // Validate ObjectId format
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    console.log("❌ Invalid product ID format:", id);
    return res.status(400).json({
      success: false,
      message: "Invalid product ID format",
    });
  }

  try {
    // First check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      console.log("❌ Product not found for ID:", id);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log(
      "✅ Product found, proceeding with deletion:",
      existingProduct.name
    );

    // Delete the product
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      console.log("❌ Failed to delete product with ID:", id);
      return res.status(500).json({
        success: false,
        message: "Failed to delete product",
      });
    }

    console.log("✅ Product deleted successfully:", deletedProduct.name);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      deletedProduct: {
        id: deletedProduct._id,
        name: deletedProduct.name,
        slug: deletedProduct.slug,
      },
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product",
      error: error.message,
    });
  }
});

// Get product by slug
const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  console.log("Received slug:", slug); // Log the slug received

  try {
    const product = await Product.findOne({ slug })
      .populate("brand", "name slug logo")
      .populate("category", "name slug")
      .populate("subCategory", "name slug");

    if (!product) {
      console.log("Product not found for slug:", slug); // Log if no product is found
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Add a check for brand - this helps debug issues with brand associations
    if (!product.brand) {
      console.log(
        "Warning: Product found but has no brand association:",
        product._id
      );
    }

    console.log("Product found:", product); // Log the product found
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Error fetching product by slug:", error); // Log any errors
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Get available filters for a specific category
const getCategoryFilters = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const filters = categoryFilters[slug] || categoryFilters["default"];
  res.json({ success: true, filters });
});

// Debug endpoint
const debog = asyncHandler(async (req, res) => {
  try {
    const allProducts = await Product.find({}).limit(10);
    res.json({
      rawProducts: allProducts,
      count: allProducts.length,
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({ error: error.message });
  }
});

const uploadImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoId(id);

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Handle images
    let imageUrls = [];
    if (req.files && req.files.images) {
      for (const file of req.files.images) {
        // Upload to Cloudinary as image
        const uploadRes = await cloudinaryUploadImage(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          "image"
        );
        imageUrls.push(uploadRes.url);
      }
      // Add to product images array
      product.images = product.images.concat(imageUrls);
    }

    // Handle documents (PDFs)
    let documentObjs = [];
    if (req.files && req.files.documents) {
      for (const file of req.files.documents) {
        // Upload to Cloudinary as raw
        const uploadRes = await cloudinaryUploadImage(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          "raw"
        );
        documentObjs.push({
          name: file.originalname,
          type: file.mimetype,
          url: uploadRes.url,
          size: Math.round(file.size / 1024),
          uploadedAt: new Date(),
        });
      }
      // Add to product documents array
      product.documents = product.documents.concat(documentObjs);
    }

    await product.save();

    res.json({
      success: true,
      images: imageUrls,
      documents: documentObjs,
      product,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({ success: false, message: "Image upload failed" });
  }
});

// Get Featured Products
const getFeaturedProducts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 12;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ isFeatured: true })
        .populate("brand", "name slug logo")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select(
          "name slug price originalPrice discountPercentage stock images specifications isFeatured isBestSeller isNewArrival isActive reviews viewCount variants tags keyFeatures videos shippingInfo createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ isFeatured: true }),
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured products",
    });
  }
});

// Get Best Seller Products
const getBestSellerProducts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 12;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ isBestSeller: true })
        .populate("brand", "name slug logo")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select(
          "name slug price originalPrice discountPercentage stock images specifications isFeatured isBestSeller isNewArrival isActive reviews viewCount variants tags keyFeatures videos shippingInfo createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ isBestSeller: true }),
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching best seller products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch best seller products",
    });
  }
});

// Get New Arrival Products
const getNewArrivalProducts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 12;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ isNewArrival: true })
        .populate("brand", "name slug logo")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select(
          "name slug price originalPrice discountPercentage stock images specifications isFeatured isBestSeller isNewArrival isActive reviews viewCount variants tags keyFeatures videos shippingInfo createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ isNewArrival: true }),
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching new arrival products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch new arrival products",
    });
  }
});

// Search products for analytics
const searchProducts = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.json({ success: true, data: [] });
  }

  try {
    const searchRegex = new RegExp(
      q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),
      "i"
    );

    const products = await Product.find({
      $or: [
        { name: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { "specifications.items.value": searchRegex },
      ],
    })
      .select("name slug")
      .limit(20);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Product search error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching products",
    });
  }
});

// Parse helper function
function parseIfString(val) {
  try {
    return typeof val === "string" ? JSON.parse(val) : val;
  } catch {
    return val;
  }
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  getFeaturedProducts,
  getBestSellerProducts,
  getNewArrivalProducts,
  getCategoryFilters,
  debog,
  uploadImages,
  searchProducts,
};
