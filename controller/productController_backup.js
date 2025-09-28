const express = require("express");
const asyncHandler = require("express-async-handler");
const Product = require("../models/ProductsModel");
const Category = require("../models/CategoryModel");
const Brand = require("../models/BrandModel");
const categoryFilters = require("../utils/categoryFilters");
const { cloudinaryUploadImage } = require("../utils/cloudinary");
const validateMongoId = require("../utils/validateMongoId"); // or your inline function

// Helper to escape regex special characters for safe $regex creation
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  console.log("Auth user:", req.user ? { id: req.user._id, role: req.user.role } : "No user");
  console.log("🔍 Incoming filter query params:", JSON.stringify(req.query, null, 2));

  const sort = req.query.sort || "newest";
  const sortObj = getSortObject(sort);
  const isAdmin = req.originalUrl.includes("/admin/all");
  console.log("Is admin request:", isAdmin);

  // For admin routes, show all products. For public routes, only show active ones
  let query = {};

  // If no filters or category are selected, return all products (public)
  const filterKeys = Object.keys(req.query).filter(k => !['sort','page','limit','search','_t'].includes(k));
  if (!req.query.category && filterKeys.length === 0 && !isAdmin) {
    // No category or filters: show all active products
    query = { isActive: { $ne: false } };
  }

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

  // Inverter-specific fields (type/phase/powerRating) are handled later
  // in the category-resolved filtering section so we avoid creating
  // conflicting queries against `specifications.items` when the
  // admin stores values under `categoryFilters`.

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
    const safeSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    // Public site default: show 12 products per page
    limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 12;
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
    const safeSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(safeSearch, "i");
    query.$or = [
      { name: searchRegex },
      { slug: searchRegex },
      { "specifications.items.value": searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
    ];
  }

  // Initialize filters counter for debugging
  let appliedFiltersCount = 0;

  // Apply category-specific filters when category is selected
  if (req.query.category) {
    const specFilters = [];
    
    Object.entries(req.query).forEach(([key, value]) => {
      // Skip standard non-filter params
      const skipKeys = new Set([
        "brand", "isFeatured", "isBestSeller", "isNewArrival",
        "price_min", "price_max", "rating_min", "rating_max", 
        "sort", "category", "page", "limit", "search", "_t"
      ]);
      
      if (skipKeys.has(key) || value === undefined || value === null || value === "") return;

      console.log(`🔍 Processing category filter: ${key} = ${value} (type: ${typeof value})`);

      // Handle range filters (e.g., power_min, power_max)
      if (key.endsWith("_min")) {
        const field = key.replace(/_min$/, "");
        const filter = {
          $or: [
            { [`categoryFilters.${field}`]: { $gte: Number(value) } },
            { "specifications.items": { $elemMatch: { name: field, value: { $gte: Number(value) } } } }
          ]
        };
        specFilters.push(filter);
        console.log(`✅ Added min range filter for ${field}:`, JSON.stringify(filter));
        return;
      }
      
      if (key.endsWith("_max")) {
        const field = key.replace(/_max$/, "");
        const filter = {
          $or: [
            { [`categoryFilters.${field}`]: { $lte: Number(value) } },
            { "specifications.items": { $elemMatch: { name: field, value: { $lte: Number(value) } } } }
          ]
        };
        specFilters.push(filter);
        console.log(`✅ Added max range filter for ${field}:`, JSON.stringify(filter));
        return;
      }
      
      // Handle boolean filters (e.g., Hybrid=true, On-Grid=true, Off-Grid=true)
      if (value === "true" || value === true) {
        const filter = {
          $or: [
            { [`categoryFilters.${key}`]: true },
            { "specifications.items": { $elemMatch: { value: { $regex: new RegExp(`^${escapeRegex(String(key))}$`, 'i') } } } }
          ]
        };
        specFilters.push(filter);
        console.log(`✅ Added boolean filter for ${key}:`, JSON.stringify(filter));
        return;
      }
      
      // Handle string/select filters (e.g., phase="Single-Phase")
      if (typeof value === "string" && value.trim() !== "") {
        const filter = {
          $or: [
            { [`categoryFilters.${key}`]: value },
            { "specifications.items": { $elemMatch: { name: key, value: value } } },
            { "specifications.items": { $elemMatch: { value: value } } }
          ]
        };
        specFilters.push(filter);
        console.log(`✅ Added string filter for ${key}:`, JSON.stringify(filter));
        return;
      }
    });

    // Add all category filters to the main query
    if (specFilters.length > 0) {
      if (!query.$and) query.$and = [];
      query.$and.push(...specFilters);
      appliedFiltersCount = specFilters.length;
      console.log(`🎯 Applied ${specFilters.length} category-specific filters`);
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
  console.log("🟦 Final MongoDB query for products:", JSON.stringify(query, null, 2));
  console.log("Sort config:", JSON.stringify(sortObj, null, 2));
  console.log("Pagination:", { page, limit, skip });
  console.log("🔍 Filter keys from query:", Object.keys(req.query).filter(k => !['sort','page','limit','search','_t'].includes(k)));
  console.log("🔍 Has category filter:", !!req.query.category);
  console.log("🔍 Applied category filters count:", appliedFiltersCount);

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
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // Ensure we only call .sort once. Use sortQuery which may be textScore or computed sortObj
  const [products, total] = await Promise.all([
    Product.find(query, projection)
      .populate("brand", "name slug")
      .populate("category", "name slug")
      .select(
        "name slug price originalPrice discountPercentage stock images specifications isFeatured isBestSeller reviews viewCount variants"
      )
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean(),
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

    // Parse category filter values (defensive)
    let parsedCategoryFilterValues = {};
    try {
      if (categoryFilterValues && categoryFilterValues !== "null") {
        parsedCategoryFilterValues = validateJSON(categoryFilterValues, {});
      } else {
        parsedCategoryFilterValues = {};
      }
    } catch (err) {
      console.warn("Failed to parse categoryFilterValues in createProduct:", err?.message || err);
      parsedCategoryFilterValues = {};
    }
    console.log("Parsed category filter values:", parsedCategoryFilterValues);
    // Merge any individual filter fields that may have been sent directly
    // (e.g., checkbox inputs named like 'Hybrid' or range fields like 'power_min')
    let finalCategoryFilters = { ...(parsedCategoryFilterValues || {}) };
    try {
      // Resolve category key to look up filter definitions
      let resolvedCategoryKey = category;
      if (resolvedCategoryKey && !categoryFilters[resolvedCategoryKey]) {
        if (resolvedCategoryKey !== 'general' && resolvedCategoryKey !== 'brand') {
          const maybeCat = await Category.findOne({
            $or: [{ slug: resolvedCategoryKey }, { name: new RegExp(`^${resolvedCategoryKey}$`, "i") }],
          });
          if (maybeCat && maybeCat.slug) resolvedCategoryKey = maybeCat.slug;
        }
      }

      const resolvedFiltersDef = categoryFilters[resolvedCategoryKey] || categoryFilters['default'] || [];

      resolvedFiltersDef.forEach((def) => {
        const key = def.field;
        if (def.type === 'boolean') {
          if (typeof finalCategoryFilters[key] === 'undefined') {
            const raw = req.body[key];
            if (raw === 'true' || raw === true || raw === 'on' || raw === '1') {
              finalCategoryFilters[key] = true;
            } else if (raw === 'false' || raw === false) {
              finalCategoryFilters[key] = false;
            }
          }
        } else if (def.type === 'range') {
          const minKey = `${key}_min`;
          const maxKey = `${key}_max`;
          if (typeof finalCategoryFilters[minKey] === 'undefined' && typeof req.body[minKey] !== 'undefined' && req.body[minKey] !== '') {
            const n = Number(req.body[minKey]);
            if (!isNaN(n)) finalCategoryFilters[minKey] = n;
          }
          if (typeof finalCategoryFilters[maxKey] === 'undefined' && typeof req.body[maxKey] !== 'undefined' && req.body[maxKey] !== '') {
            const n = Number(req.body[maxKey]);
            if (!isNaN(n)) finalCategoryFilters[maxKey] = n;
          }
        } else {
          // select / string fields
          if (typeof finalCategoryFilters[key] === 'undefined' && typeof req.body[key] !== 'undefined' && req.body[key] !== '') {
            finalCategoryFilters[key] = req.body[key];
          }
        }
      });
    } catch (mergeErr) {
      console.warn('Error merging category filters:', mergeErr?.message || mergeErr);
    }
    console.log('Final category filters to save:', finalCategoryFilters);
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

    console.log('🟧 Saving product with categoryFilters:', JSON.stringify(finalCategoryFilters, null, 2));
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
      categoryFilters: finalCategoryFilters, // Store category-specific filter values
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
    // Accept categoryFilterValues from FormData for edits
    "categoryFilterValues",
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

  // If categoryFilterValues was provided (stringified JSON), move it to categoryFilters
  if (updateData.categoryFilterValues) {
    try {
      const parsed =
        typeof updateData.categoryFilterValues === "string"
          ? JSON.parse(updateData.categoryFilterValues)
          : updateData.categoryFilterValues;
      updateData.categoryFilters = parsed || {};
    } catch (err) {
      console.warn("Failed to parse categoryFilterValues during update:", err.message);
      updateData.categoryFilters = {};
    }
    delete updateData.categoryFilterValues;
  }
  console.log('🟧 Updating product with categoryFilters:', JSON.stringify(updateData.categoryFilters, null, 2));

  // Merge any individual filter fields into updateData.categoryFilters
  try {
    // Resolve category key to look up filter definitions if available
    let resolvedCategoryKey = updateData.category || undefined;
    if (resolvedCategoryKey && !categoryFilters[resolvedCategoryKey]) {
      if (resolvedCategoryKey !== 'general' && resolvedCategoryKey !== 'brand') {
        const maybeCat = await Category.findOne({
          $or: [{ slug: resolvedCategoryKey }, { name: new RegExp(`^${resolvedCategoryKey}$`, "i") }],
        });
        if (maybeCat && maybeCat.slug) resolvedCategoryKey = maybeCat.slug;
      }
    }

    const resolvedFiltersDef = categoryFilters[resolvedCategoryKey] || categoryFilters['default'] || [];

    updateData.categoryFilters = updateData.categoryFilters || {};

    resolvedFiltersDef.forEach((def) => {
      const key = def.field;
      if (def.type === 'boolean') {
        if (typeof updateData.categoryFilters[key] === 'undefined') {
          const raw = req.body[key];
          if (raw === 'true' || raw === true || raw === 'on' || raw === '1') {
            updateData.categoryFilters[key] = true;
          } else if (raw === 'false' || raw === false) {
            updateData.categoryFilters[key] = false;
          }
        }
      } else if (def.type === 'range') {
        const minKey = `${key}_min`;
        const maxKey = `${key}_max`;
        if (typeof updateData.categoryFilters[minKey] === 'undefined' && typeof req.body[minKey] !== 'undefined' && req.body[minKey] !== '') {
          const n = Number(req.body[minKey]);
          if (!isNaN(n)) updateData.categoryFilters[minKey] = n;
        }
        if (typeof updateData.categoryFilters[maxKey] === 'undefined' && typeof req.body[maxKey] !== 'undefined' && req.body[maxKey] !== '') {
          const n = Number(req.body[maxKey]);
          if (!isNaN(n)) updateData.categoryFilters[maxKey] = n;
        }
      } else {
        if (typeof updateData.categoryFilters[key] === 'undefined' && typeof req.body[key] !== 'undefined' && req.body[key] !== '') {
          updateData.categoryFilters[key] = req.body[key];
        }
      }
    });

    console.log('Final category filters for update:', updateData.categoryFilters);
  } catch (mergeErr) {
    console.warn('Error merging category filters during update:', mergeErr?.message || mergeErr);
  }

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
    // For general/brand pages we want to show ALL active brands. For
    // category-specific pages show only brands that have products in that
    // category. Products may store brand as ObjectId or as slug/string in
    // some older records, so handle both cases when resolving Brand docs.
    const distinctBrandValues = await Product.distinct("brand", categoryQuery);

    // Separate ObjectId-like values from string slugs
    const mongoose = require("mongoose");
    const objectIdValues = distinctBrandValues.filter((v) =>
      mongoose.Types.ObjectId.isValid(String(v))
    );
    const stringValues = distinctBrandValues.filter(
      (v) => typeof v === "string" && !mongoose.Types.ObjectId.isValid(v)
    );

    // Build query to find Brand docs matching either _id or slug
    const brandQueryParts = [];
    if (objectIdValues.length > 0) {
      brandQueryParts.push({ _id: { $in: objectIdValues } });
    }
    if (stringValues.length > 0) {
      brandQueryParts.push({ slug: { $in: stringValues } });
    }

    const populatedBrands = brandQueryParts.length
      ? await Brand.find({ $or: brandQueryParts }).select("name slug")
      : [];

    // Update brand filter options
    const brandFilter = filters.find((f) => f.field === "brand");
    if (brandFilter) {
      if (slug === "general" || slug === "brand") {
        // Show all active brands (name + slug) so frontend can render label
        // and use slug as the filter value.
        const allBrands = await Brand.find({ isActive: true }).select(
          "name slug"
        );
        brandFilter.options = allBrands
          .map((b) => ({ name: b.name, slug: b.slug }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } else if (populatedBrands.length > 0) {
        // Category-scoped: show only brands that have products in this category
        brandFilter.options = populatedBrands
          .map((b) => ({ name: b.name, slug: b.slug }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
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
