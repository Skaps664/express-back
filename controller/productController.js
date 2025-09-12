const express = require("express");
const asyncHandler = require("express-async-handler");
const Product = require("../models/ProductsModel");
const Category = require("../models/CategoryModel");
const Brand = require("../models/BrandModel");
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
  if (req.query.brand) {
    // Handle brand filter - can be brand name, brand slug, or brand ID
    const brandSearch = [];
    brandSearch.push({ name: req.query.brand });
    brandSearch.push({ slug: req.query.brand });
    // Only attempt _id match when the value looks like a Mongo ObjectId
    const mongoose = require("mongoose");
    if (
      typeof req.query.brand === "string" &&
      mongoose.Types.ObjectId.isValid(req.query.brand)
    ) {
      brandSearch.push({ _id: req.query.brand });
    }

    const brandDoc = await Brand.findOne({ $or: brandSearch });
    if (brandDoc) {
      query.brand = brandDoc._id;
    }
  }

  if (req.query.isFeatured) query.isFeatured = req.query.isFeatured === "true";
  if (req.query.isBestSeller)
    query.isBestSeller = req.query.isBestSeller === "true";
  if (req.query.isNewArrival)
    query.isNewArrival = req.query.isNewArrival === "true";

  // Price filters
  if (req.query.price_min || req.query.price_max) {
    query.price = {};
    if (req.query.price_min) query.price.$gte = Number(req.query.price_min);
    if (req.query.price_max) query.price.$lte = Number(req.query.price_max);
  }

  // Handle predefined price ranges
  if (req.query.priceRange) {
    switch (req.query.priceRange) {
      case "Under 10K":
        query.price = { $lt: 10000 };
        break;
      case "10K-50K":
        query.price = { $gte: 10000, $lte: 50000 };
        break;
      case "50K-100K":
        query.price = { $gte: 50000, $lte: 100000 };
        break;
      case "100K-500K":
        query.price = { $gte: 100000, $lte: 500000 };
        break;
      case "500K+":
        query.price = { $gte: 500000 };
        break;
    }
  }

  // Rating filters
  if (req.query.rating_min || req.query.rating_max) {
    query["reviews.rating"] = {};
    if (req.query.rating_min)
      query["reviews.rating"].$gte = Number(req.query.rating_min);
    if (req.query.rating_max)
      query["reviews.rating"].$lte = Number(req.query.rating_max);
  }

  // Category-specific filters for inverters
  if (req.query.inverterType)
    query["specifications.Type"] = req.query.inverterType;
  if (req.query.phase) query["specifications.Phase"] = req.query.phase;

  // New inverter boolean filters
  if (req.query["On-Grid"] === "true") {
    query["specifications.Type"] = "On-Grid";
  }
  if (req.query["Off-Grid"] === "true") {
    query["specifications.Type"] = "Off-Grid";
  }
  if (req.query["Hybrid"] === "true") {
    query["specifications.Type"] = "Hybrid";
  }

  if (req.query.powerRating_min || req.query.powerRating_max) {
    query["specifications.PowerRating"] = {};
    if (req.query.powerRating_min)
      query["specifications.PowerRating"].$gte = Number(
        req.query.powerRating_min
      );
    if (req.query.powerRating_max)
      query["specifications.PowerRating"].$lte = Number(
        req.query.powerRating_max
      );
  }

  // Category-specific filters for solar panels
  if (req.query.panelType) query["specifications.Type"] = req.query.panelType;
  if (req.query.wattage_min || req.query.wattage_max) {
    query["specifications.Wattage"] = {};
    if (req.query.wattage_min)
      query["specifications.Wattage"].$gte = Number(req.query.wattage_min);
    if (req.query.wattage_max)
      query["specifications.Wattage"].$lte = Number(req.query.wattage_max);
  }
  if (req.query.efficiency_min || req.query.efficiency_max) {
    query["specifications.Efficiency"] = {};
    if (req.query.efficiency_min)
      query["specifications.Efficiency"].$gte = Number(
        req.query.efficiency_min
      );
    if (req.query.efficiency_max)
      query["specifications.Efficiency"].$lte = Number(
        req.query.efficiency_max
      );
  }

  // Category-specific filters for batteries
  if (req.query.batteryType)
    query["specifications.Type"] = req.query.batteryType;
  if (req.query.voltage) query["specifications.Voltage"] = req.query.voltage;
  if (req.query.capacity_min || req.query.capacity_max) {
    query["specifications.Capacity"] = {};
    if (req.query.capacity_min)
      query["specifications.Capacity"].$gte = Number(req.query.capacity_min);
    if (req.query.capacity_max)
      query["specifications.Capacity"].$lte = Number(req.query.capacity_max);
  }
  if (req.query.cycleLife_min || req.query.cycleLife_max) {
    query["specifications.CycleLife"] = {};
    if (req.query.cycleLife_min)
      query["specifications.CycleLife"].$gte = Number(req.query.cycleLife_min);
    if (req.query.cycleLife_max)
      query["specifications.CycleLife"].$lte = Number(req.query.cycleLife_max);
  }

  // Category-specific filters for tools
  if (req.query.toolType) query["specifications.Type"] = req.query.toolType;
  if (req.query.toolCategory)
    query["specifications.Category"] = req.query.toolCategory;

  // Category-specific filters for accessories
  if (req.query.accessoryType)
    query["specifications.Type"] = req.query.accessoryType;
  if (req.query.material) query["specifications.Material"] = req.query.material;

  // General filters
  if (req.query.warranty) query["specifications.Warranty"] = req.query.warranty;
  if (req.query.countryOfOrigin)
    query["specifications.CountryOfOrigin"] = req.query.countryOfOrigin;

  // SEARCH FUNCTIONALITY - SIMPLIFIED AND FIXED
  if (
    req.query.search &&
    typeof req.query.search === "string" &&
    req.query.search.trim() !== ""
  ) {
    const safeSearch = req.query.search.replace(
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      "\\$&"
    );
    const searchRegex = new RegExp(safeSearch, "i");
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
    const skipParams = new Set([
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
    ]);

    if (skipParams.has(key) || value === undefined || value === null) return;

    // Handle array values (multiple filters with same key -> req.query[key] becomes an array)
    if (Array.isArray(value)) {
      // For numeric range suffixes, attempt to pick min/max if provided as arrays
      if (key.endsWith("_min") || key.endsWith("_max")) {
        // Convert array values to numbers when possible by taking the first valid numeric entry
        const numericVals = value
          .map((v) => Number(v))
          .filter((n) => !isNaN(n));
        if (numericVals.length === 0) return;
        const field = key.endsWith("_min")
          ? key.replace("_min", "")
          : key.replace("_max", "");
        if (!query[`specifications.${field}`])
          query[`specifications.${field}`] = {};
        if (key.endsWith("_min"))
          query[`specifications.${field}`].$gte = numericVals[0];
        else query[`specifications.${field}`].$lte = numericVals[0];
        return;
      }

      // For general exact matches, use $in
      query[`specifications.${key}`] = { $in: value };
      return;
    }

    // Now value is a single primitive. Only operate on non-empty strings or numbers
    if (typeof value === "string" && value.trim() === "") return;

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
  });

  // Category-specific filters from categoryFilters field
  // Handle filters that were set via the admin panel for this category
  Object.entries(req.query).forEach(([key, value]) => {
    // Skip internal params and already handled filters
    const skipParams = new Set([
      "brand",
      "isFeatured",
      "isBestSeller",
      "isNewArrival",
      "price_min",
      "price_max",
      "rating_min",
      "rating_max",
      "sort",
      "category",
      "page",
      "limit",
      "search",
      "_t",
    ]);

    if (
      skipParams.has(key) ||
      value === undefined ||
      value === null ||
      value === ""
    )
      return;

    // Check if this filter exists in categoryFilters
    if (
      key === "phase" ||
      key === "batteryType" ||
      key === "voltage" ||
      key === "wattage" ||
      key === "On-Grid" ||
      key === "Off-Grid" ||
      key.includes("_min") ||
      key.includes("_max")
    ) {
      if (key.endsWith("_min") || key.endsWith("_max")) {
        // Handle range filters
        const baseField = key.replace(/_min$|_max$/, "");
        const isMin = key.endsWith("_min");

        if (!query[`categoryFilters.${baseField}`]) {
          query[`categoryFilters.${baseField}`] = {};
        }

        if (isMin) {
          query[`categoryFilters.${baseField}`].$gte = Number(value);
        } else {
          query[`categoryFilters.${baseField}`].$lte = Number(value);
        }
      } else if (key === "On-Grid" || key === "Off-Grid") {
        // Handle boolean filters
        if (value === "true" || value === true) {
          query[`categoryFilters.${key}`] = true;
        }
      } else {
        // Handle select filters (exact match)
        query[`categoryFilters.${key}`] = value;
      }
    }
  });

  // Pagination - moved before category filter to fix scoping issue
  // Pagination: allow admin requests to fetch all products by default
  const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
  let limit;
  if (isAdmin) {
    // For admin endpoints, if no explicit limit is provided, return a very large
    // limit so the admin UI receives the full set of products without changing
    // product creation/update logic. If the client provides a limit query param,
    // respect it.
    limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 10000;
  } else {
    limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
  }
  const skip = (page - 1) * limit;

  // Category filter
  if (req.query.category) {
    // Accept category by slug, name, or _id
    const mongoose = require("mongoose");
    const catSearch = [];
    if (typeof req.query.category === "string") {
      catSearch.push({ slug: req.query.category });
      catSearch.push({ name: req.query.category });
    }
    if (
      typeof req.query.category === "string" &&
      mongoose.Types.ObjectId.isValid(req.query.category)
    ) {
      catSearch.push({ _id: req.query.category });
    }

    let categoryDoc = null;
    if (catSearch.length > 0) {
      categoryDoc = await Category.findOne({ $or: catSearch });
    }

    if (categoryDoc) {
      query.category = categoryDoc._id;
    } else {
      // If category not found, return empty result set (do not throw)
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

  // If category is provided, apply specification-style filters similar to getProductsByCategory
  // This ensures brand pages (which call getAllProducts with a brand + category) filter the same
  // as category pages (uses specifications.items $elemMatch).
  if (req.query.category) {
    const specFilters = [];
    Object.entries(req.query).forEach(([key, value]) => {
      // Skip standard non-spec params
      if (
        [
          "brand",
          "isFeatured",
          "isBestSeller",
          "isNewArrival",
          "price_min",
          "price_max",
          "rating_min",
          "rating_max",
          "sort",
          "category",
          "page",
          "limit",
          "search",
          "_t",
        ].includes(key)
      ) {
        return;
      }

      if (key.endsWith("_min")) {
        const field = key.replace(/_min$/, "");
        specFilters.push({
          "specifications.items": {
            $elemMatch: { name: field, value: { $gte: Number(value) } },
          },
        });
      } else if (key.endsWith("_max")) {
        const field = key.replace(/_max$/, "");
        specFilters.push({
          "specifications.items": {
            $elemMatch: { name: field, value: { $lte: Number(value) } },
          },
        });
      } else {
        // exact match (strings / booleans)
        specFilters.push({
          "specifications.items": { $elemMatch: { name: key, value: value } },
        });
      }
    });

    if (specFilters.length > 0) {
      if (!query.$and) query.$and = [];
      query.$and.push(...specFilters);
    }
  }

  // Enable aggressive caching for better performance
  const cacheKey = `products:${JSON.stringify(query)}:${sort}:${page}:${limit}`;
  const { getFromCache, setCache } = require("../utils/redisCache");

  // Decide whether to use cache: skip cache if the request contains dynamic filters
  // beyond brand/sort/page/limit (for example: category, On-Grid, phase, etc.)
  const nonCacheAllowedKeys = ["brand", "sort", "page", "limit"];
  const queryKeys = Object.keys(req.query || {}).filter(
    (k) => req.query[k] !== undefined && req.query[k] !== ""
  );
  const dynamicKeys = queryKeys.filter((k) => !nonCacheAllowedKeys.includes(k));

  if (dynamicKeys.length === 0) {
    // Try cache first (5 minute cache)
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      console.log("🚀 Serving from cache:", cacheKey);
      return res.status(200).json(cachedResult);
    }
  } else {
    console.log("Skipping cache for dynamic query keys:", dynamicKeys);
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
      categoryFilterValues, // New field for category-specific filters
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

    // Parse category filter values
    let parsedCategoryFilterValues = {};
    if (categoryFilterValues) {
      parsedCategoryFilterValues = validateJSON(categoryFilterValues, {});
      console.log("Parsed category filter values:", parsedCategoryFilterValues);
    }
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
      categoryFilters: parsedCategoryFilterValues, // Store category-specific filter values
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

  console.log("Starting product update process...");
  console.log("Request body keys:", Object.keys(req.body));
  console.log("Files received:", {
    images: req.files?.images?.length || 0,
    documents: req.files?.documents?.length || 0,
  });

  // Parse JSON fields that come as strings from FormData
  const jsonFields = [
    "specifications",
    "keyFeatures",
    "tags",
    "videos",
    "relatedProducts",
    "shippingInfo",
    "documentTypes",
  ];

  jsonFields.forEach((field) => {
    if (updateData[field] && typeof updateData[field] === "string") {
      try {
        updateData[field] = JSON.parse(updateData[field]);
        console.log(`Parsed ${field}:`, updateData[field]);
      } catch (error) {
        console.error(`Error parsing ${field}:`, error.message);
        // Set to appropriate default value
        if (field === "specifications") updateData[field] = [];
        else if (field === "shippingInfo")
          updateData[field] = {
            freeShipping: false,
            estimatedDelivery: "",
            returnPolicy: "",
            warrantyService: "",
          };
        else updateData[field] = [];
      }
    }
  });

  // Handle boolean fields that come as strings from FormData
  const booleanFields = ["isFeatured", "isBestSeller", "isNewArrival"];
  booleanFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updateData[field] =
        updateData[field] === "true" || updateData[field] === true;
    }
  });

  // Handle numeric fields that come as strings from FormData
  const numericFields = ["price", "originalPrice", "stock", "viewCount"];
  numericFields.forEach((field) => {
    if (updateData[field] !== undefined && updateData[field] !== "") {
      const numValue = parseFloat(updateData[field]);
      if (!isNaN(numValue)) {
        updateData[field] = numValue;
      }
    }
  });

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
    console.log("Processing document uploads...");
    for (const file of req.files.documents) {
      const uploadRes = await cloudinaryUploadImage(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        "raw"
      );

      // Find document type from documentTypes array
      let docType = "other";
      if (updateData.documentTypes && Array.isArray(updateData.documentTypes)) {
        const typeInfo = updateData.documentTypes.find(
          (dt) => dt.name === file.originalname
        );
        if (typeInfo) docType = typeInfo.type;
      }

      documentObjs.push({
        name: file.originalname,
        type: docType,
        url: uploadRes.url,
        size: Math.round(file.size / 1024),
        uploadedAt: new Date(),
      });
    }
    // Optionally, append or replace documents
    updateData.documents = (updateData.documents || []).concat(documentObjs);
  } else {
    console.log("No documents to upload or documents array is empty");
  }

  // Remove documentTypes from updateData as it's only used for processing
  delete updateData.documentTypes;

  console.log("Final update data keys:", Object.keys(updateData));
  console.log(
    "Specifications structure:",
    JSON.stringify(updateData.specifications, null, 2)
  );

  console.log("🔄 Starting MongoDB update operation for product ID:", id);
  console.log("📊 Update data summary:", {
    name: updateData.name,
    price: updateData.price,
    descriptionLength: updateData.description?.length || 0,
    specsCount: updateData.specifications?.length || 0,
    featuresCount: updateData.keyFeatures?.length || 0,
    documentsCount: updateData.documents?.length || 0,
  });

  const { getFromCache, setCache } = require("../utils/redisCache");

  try {
    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    console.log("✅ MongoDB update completed successfully");

    // Invalidate cache for this product and blog-related caches
    await Promise.all([
      setCache(`product:${updatedProduct.slug}`, null, 0),
      // Clear blog caches since blog-product relationships might have changed
      setCache("blogs:all", null, 0),
      setCache("blogs:featured", null, 0),
    ]);
    console.log(
      "🗑️ Cleared cache for product and related blogs:",
      updatedProduct.slug
    );

    console.log("📋 Updated product summary:", {
      id: updatedProduct._id,
      name: updatedProduct.name,
      price: updatedProduct.price,
      descriptionLength: updatedProduct.description?.length || 0,
      specsCount: updatedProduct.specifications?.length || 0,
      featuresCount: updatedProduct.keyFeatures?.length || 0,
      documentsCount: updatedProduct.documents?.length || 0,
    });

    if (!updatedProduct) {
      console.log("❌ Product not found after update - ID might be invalid");
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, product: updatedProduct });
  } catch (updateError) {
    console.error("💥 MongoDB update failed:", updateError);
    console.error("🔍 Update error details:", {
      message: updateError.message,
      name: updateError.name,
      code: updateError.code,
      stack: updateError.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: updateError.message,
    });
  }
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
  console.log("Received slug:", slug);

  // Get cache instance
  const { getFromCache, setCache } = require("../utils/redisCache");

  // Check cache first
  const cacheKey = `product:${slug}`;
  const cachedProduct = await getFromCache(cacheKey);
  if (cachedProduct) {
    console.log("Serving from cache:", slug);
    return res.json(cachedProduct);
  }

  try {
    const product = await Product.findOne({ slug })
      .populate("brand", "name slug logo")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate({
        path: "relatedBlogs",
        select:
          "title slug excerpt featuredImage status publishedAt description isActive",
        match: { status: "published", isActive: true },
        options: { sort: { publishedAt: -1 } },
      })
      .lean();

    // If no product found, return 404
    if (!product) {
      console.log("Product not found for slug:", slug);
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Filter out any null/undefined blogs and ensure they're active and published
    const validBlogs = (product.relatedBlogs || []).filter(
      (blog) => blog && blog.status === "published" && blog.isActive
    );

    console.log(
      `Found ${validBlogs.length} valid related blogs for product ${slug}`
    );

    // Convert all resources to standardized format
    product.resources = [
      ...(product.documents || []).map((doc) => ({
        type: "document",
        id:
          doc._id?.toString() || doc.id || `doc_${Date.now()}_${Math.random()}`,
        ...doc,
      })),
      ...(product.videos || []).map((video) => ({
        type: "video",
        id:
          video._id?.toString() ||
          video.id ||
          `video_${Date.now()}_${Math.random()}`,
        ...video,
      })),
      ...validBlogs.map((blog) => ({
        type: "blog",
        id: blog._id.toString(),
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        featuredImage: blog.featuredImage,
        publishedAt: blog.publishedAt,
        description: blog.description,
      })),
    ];

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

    const result = { success: true, product };

    // Cache the result for 5 minutes
    await setCache(cacheKey, result, 300);

    console.log("Product found and cached:", slug);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Get available filters for a specific category with dynamic options
const getCategoryFilters = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  console.log(`[DEBUG] getCategoryFilters called with slug: "${slug}"`);

  try {
    // Determine which filter set to use. Accept either slug or human-readable name.
    let filterKey = slug;

    // If no direct key found in categoryFilters, try to resolve via Category model
    if (!categoryFilters[filterKey]) {
      if (slug && slug !== "general" && slug !== "brand") {
        // Try finding category by slug or name (case-insensitive for name)
        const categoryDoc = await Category.findOne({
          $or: [{ slug: slug }, { name: new RegExp(`^${slug}$`, "i") }],
        });
        if (categoryDoc && categoryDoc.slug) {
          filterKey = categoryDoc.slug;
        }
      }
    }

    // Get base filters for the resolved key
    let filters = categoryFilters[filterKey] || categoryFilters["default"];

    console.log(
      `[DEBUG] getCategoryFilters resolved key: "${filterKey}" for param "${slug}"`
    );
    console.log(
      `[DEBUG] Found ${filters.length} filters for key "${filterKey}"`
    );

    // Clone the filters to avoid modifying the original
    filters = JSON.parse(JSON.stringify(filters));

    // Find category to check if it exists (used to scope brand options)
    let categoryQuery = {};
    if (filterKey && filterKey !== "general" && filterKey !== "brand") {
      const categoryDoc = await Category.findOne({ slug: filterKey });
      if (categoryDoc) {
        categoryQuery.category = categoryDoc._id;
      }
    }

    // Dynamically populate brand options
    const brands = await Product.distinct("brand", categoryQuery);
    const populatedBrands = await Brand.find({ _id: { $in: brands } }).select(
      "name"
    );

    // Update brand filter options
    const brandFilter = filters.find((f) => f.field === "brand");
    if (brandFilter && populatedBrands.length > 0) {
      brandFilter.options = populatedBrands.map((b) => b.name).sort();
    }

    // For general store and brand pages, populate category options
    if (slug === "general" || slug === "brand") {
      const categories = await Category.find({ isActive: true }).select(
        "name slug"
      );
      const categoryFilter = filters.find((f) => f.field === "category");
      if (categoryFilter) {
        // Provide both name and slug so frontend can render labels and send slug values
        categoryFilter.options = categories
          .map((c) => ({ name: c.name, slug: c.slug }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    console.log(
      `[DEBUG] Returning ${filters.length} filters for key "${filterKey}"`
    );
    res.json({
      success: true,
      filters,
      categorySlug: filterKey,
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load filters",
      filters: categoryFilters["default"],
    });
  }
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
