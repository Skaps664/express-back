// routes/productRoute.js
const express = require("express");
const router = express.Router();

const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const {
  cacheConfigs,
  invalidateCache,
} = require("../middlewares/cacheMiddleware");
const {
  uploadProductFiles,
  uploadToCloudinary,
} = require("../middlewares/uploadProductImage");

const {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  getFeaturedProducts,
  getBestSellerProducts,
  getNewArrivalProducts,
  updateProduct,
  deleteProduct,
  debog,
  getCategoryFilters,
  uploadImages,
  searchProducts,
} = require("../controller/productController");

// Create product route with file upload and cache invalidation
router.post(
  "/create",
  authMiddleware,
  isAdmin,
  uploadProductFiles,
  uploadToCloudinary,
  async (req, res, next) => {
    await createProduct(req, res, next);
    // Invalidate product caches after creation
    await invalidateCache.products();
    await invalidateCache.catalog();
  }
);

// Cached routes for high performance
// GET all products with caching
router.get("/", cacheConfigs.products, getAllProducts);

// Admin endpoint without caching for real-time data
router.get("/admin/all", authMiddleware, isAdmin, async (req, res, next) => {
  console.log("Admin products route accessed by:", req.user?.email);
  console.log("User role:", req.user?.role);
  return getAllProducts(req, res, next);
});
router.get("/featured", cacheConfigs.products, getFeaturedProducts); // GET featured products with caching
router.get("/best-sellers", cacheConfigs.products, getBestSellerProducts); // GET best seller products with caching
router.get("/new-arrivals", cacheConfigs.products, getNewArrivalProducts); // GET new arrival products with caching
router.get("/debog", debog);
router.get("/filters/:slug", cacheConfigs.categories, getCategoryFilters); // Cache category filters
router.get("/category/:slug", cacheConfigs.products, getProductsByCategory); // Cache category products

// Update product with cache invalidation
router.put(
  "/update/:id",
  authMiddleware,
  isAdmin,
  uploadProductFiles,
  uploadToCloudinary,
  async (req, res, next) => {
    await updateProduct(req, res, next);
    // Invalidate specific product and related caches
    await invalidateCache.products(req.params.id);
    await invalidateCache.catalog();
  }
);

// Delete product with cache invalidation
router.delete(
  "/delete/:id",
  authMiddleware,
  isAdmin,
  async (req, res, next) => {
    await deleteProduct(req, res, next);
    // Invalidate specific product and related caches
    await invalidateCache.products(req.params.id);
    await invalidateCache.catalog();
    // Also invalidate the main products list cache more aggressively
    await invalidateCache.all();
  }
);

// Search endpoint for analytics
router.get("/search", authMiddleware, searchProducts);

// Test route to verify routing is working
router.get("/test-document", (req, res) => {
  console.log("✅ Test document route accessed!");
  res.json({ success: true, message: "Document route is working!" });
});

// Document serving route - serve documents with proper headers
// Using middleware approach to handle all /document requests
router.use("/document", async (req, res) => {
  try {
    // Extract everything after /document from the original URL
    const fullUrl = req.originalUrl;
    const documentPath = fullUrl.replace("/api/products/document/", "");

    console.log("🔍 Document route accessed!");
    console.log("📁 Document path:", documentPath);
    console.log("🌍 Full request URL:", req.originalUrl);

    // Decode URL encoding
    const decodedPath = decodeURIComponent(documentPath);
    console.log("📝 Decoded path:", decodedPath);

    // First, try to find the document in the database to get the actual URL
    const Product = require("../models/ProductsModel");
    console.log("🔍 Searching for document in database...");

    try {
      const filename = decodedPath.split("/").pop();
      console.log("📄 Looking for filename:", filename);

      const productWithDoc = await Product.findOne({
        "documents.url": { $regex: filename, $options: "i" },
      });

      if (productWithDoc) {
        const document = productWithDoc.documents.find(
          (doc) =>
            doc.url && doc.url.toLowerCase().includes(filename.toLowerCase())
        );

        if (document && document.url) {
          console.log("✅ Found document in database!");
          console.log("📎 Actual document URL:", document.url);

          // If it's already a complete Cloudinary URL, try to fetch it directly
          if (document.url.includes("cloudinary.com")) {
            console.log("🌐 Using direct URL from database");

            const https = require("https");
            const http = require("http");

            const protocol = document.url.startsWith("https") ? https : http;
            const request = protocol.get(document.url, (cloudinaryRes) => {
              console.log(`📊 Direct URL status: ${cloudinaryRes.statusCode}`);

              if (cloudinaryRes.statusCode === 200) {
                const contentType =
                  cloudinaryRes.headers["content-type"] || "application/pdf";
                const filename = decodedPath.split("/").pop() || "document.pdf";

                res.setHeader("Content-Type", contentType);
                res.setHeader(
                  "Content-Disposition",
                  `inline; filename="${filename}"`
                );
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Cache-Control", "public, max-age=31536000");

                cloudinaryRes.pipe(res);
                return;
              } else {
                console.log(
                  "❌ Direct URL failed, trying alternative methods..."
                );
                // Continue to URL generation below
              }
            });

            request.on("error", (err) => {
              console.log("❌ Direct URL error:", err.message);
              // Continue to URL generation below
            });

            request.setTimeout(5000, () => {
              console.log("⏰ Direct URL timeout, trying alternatives...");
              request.destroy();
              // Continue to URL generation below
            });

            // Wait a bit to see if direct URL works
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } else {
        console.log(
          "⚠️  Document not found in database, trying URL generation..."
        );
      }
    } catch (dbError) {
      console.log("⚠️  Database search error:", dbError.message);
    }

    // Try different Cloudinary URL formats to find one that works
    // Include common version patterns and format variations
    const timestamp = Date.now(); // Current timestamp as fallback version
    const commonVersions = [
      "", // No version
      "v1754914983/", // Version from the URL pattern we saw
      "v1753257611/", // Version from the failing document
      `v${timestamp}/`, // Current timestamp version
    ];

    const cloudinaryUrls = [];

    // Generate URLs with different version combinations
    for (const version of commonVersions) {
      cloudinaryUrls.push(
        // Standard raw upload URL
        `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${version}${decodedPath}`,
        // URL with fl_attachment flag
        `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/fl_attachment/${version}${decodedPath}`,
        // Auto upload URL
        `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload/${version}${decodedPath}`,
        // Image upload URL (sometimes works for PDFs)
        `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${version}${decodedPath}`
      );
    }

    console.log(
      "☁️  Trying",
      cloudinaryUrls.length,
      "Cloudinary URL variations..."
    );

    // Import required modules
    const https = require("https");
    const http = require("http");
    const { v2: cloudinary } = require("cloudinary");

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // First, try using Cloudinary SDK to generate a proper URL
    try {
      console.log("🔗 Trying Cloudinary SDK url generation...");

      // Try to generate URL using Cloudinary SDK
      const cloudinarySDKUrl = cloudinary.url(decodedPath, {
        resource_type: "raw",
        type: "upload",
        flags: "attachment",
      });

      console.log("📎 Generated SDK URL:", cloudinarySDKUrl);
      cloudinaryUrls.unshift(cloudinarySDKUrl); // Add to beginning of array
    } catch (sdkError) {
      console.log(
        "⚠️  Cloudinary SDK URL generation failed:",
        sdkError.message
      );
    }

    // Function to try fetching from a URL
    const tryFetchDocument = (url) => {
      return new Promise((resolve, reject) => {
        console.log(`� Attempting to fetch: ${url}`);

        const protocol = url.startsWith("https") ? https : http;
        const request = protocol.get(url, (cloudinaryRes) => {
          console.log(
            `📊 Response status: ${cloudinaryRes.statusCode} for ${url}`
          );

          if (cloudinaryRes.statusCode === 200) {
            // Success! Set headers and pipe the response
            const contentType =
              cloudinaryRes.headers["content-type"] || "application/pdf";
            const filename = decodedPath.split("/").pop() || "document.pdf";

            res.setHeader("Content-Type", contentType);
            res.setHeader(
              "Content-Disposition",
              `inline; filename="${filename}"`
            );
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=31536000");

            cloudinaryRes.pipe(res);
            resolve(true);
          } else {
            reject(new Error(`HTTP ${cloudinaryRes.statusCode}`));
          }
        });

        request.on("error", (err) => {
          console.log(`❌ Error fetching ${url}:`, err.message);
          reject(err);
        });

        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error("Request timeout"));
        });
      });
    };

    // Try each URL until one works
    let success = false;
    for (const url of cloudinaryUrls) {
      try {
        await tryFetchDocument(url);
        success = true;
        break;
      } catch (error) {
        console.log(`⚠️  Failed to fetch from ${url}:`, error.message);
        continue;
      }
    }

    if (!success) {
      console.log("❌ All Cloudinary URLs failed");
      return res.status(404).json({
        success: false,
        message: "Document not found or not accessible",
        path: decodedPath,
      });
    }
  } catch (error) {
    console.error("💥 Error serving document:", error);
    res.status(500).json({
      success: false,
      message: "Error serving document",
      error: error.message,
    });
  }
});

// This should be last as it's a catch-all route with a parameter
router.get("/:slug", cacheConfigs.productDetail, getProductBySlug); // GET product by slug with caching

module.exports = router;
