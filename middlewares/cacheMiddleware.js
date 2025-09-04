const { cache } = require("../utils/redisCache");

// High-performance caching middleware for 100k+ users
const cacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = (req) => `cache:${req.originalUrl}`,
    condition = () => true,
    skipCache = (req) => req.method !== "GET",
    varyBy = [], // ['user', 'admin'] to vary cache by user properties
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests or when condition is false
    if (skipCache(req) || !condition(req)) {
      return next();
    }

    try {
      // Generate cache key with variations
      let cacheKey = keyGenerator(req);

      // Add variations to cache key
      if (varyBy.length > 0 && req.user) {
        const variations = varyBy.map((field) => req.user[field]).join(":");
        cacheKey += `:${variations}`;
      }

      // Try to get from cache
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        // Add cache hit header
        res.set("X-Cache", "HIT");
        res.set("X-Cache-Key", cacheKey.split(":").pop());
        return res.json(cachedData);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data && data.success !== false) {
          cache.set(cacheKey, data, ttl).catch((err) => {
            console.log("Cache set error:", err.message);
          });
        }

        // Add cache miss header
        res.set("X-Cache", "MISS");
        res.set("X-Cache-TTL", ttl.toString());

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.log("Cache middleware error:", error.message);
      next();
    }
  };
};

// Specific cache configurations for different endpoints
const cacheConfigs = {
  // Product listings - cache for 10 minutes
  products: cacheMiddleware({
    ttl: 600,
    keyGenerator: (req) => {
      const { page = 1, limit = 10, category, brand, search } = req.query;
      return `products:${page}:${limit}:${category || "all"}:${
        brand || "all"
      }:${search || "none"}`;
    },
  }),

  // Individual product - cache for 15 minutes
  productDetail: cacheMiddleware({
    ttl: 900,
    keyGenerator: (req) => `product:${req.params.id || req.params.slug}`,
  }),

  // Categories - cache for 30 minutes
  categories: cacheMiddleware({
    ttl: 1800,
    keyGenerator: (req) => {
      const slug = req.params?.slug || "general";
      return `categories:filters:${slug}`;
    },
  }),

  // Brands - cache for 30 minutes
  brands: cacheMiddleware({
    ttl: 1800,
    keyGenerator: () => "brands:list",
  }),

  // Product reviews - cache for 5 minutes, vary by page
  reviews: cacheMiddleware({
    ttl: 300,
    keyGenerator: (req) => {
      const { page = 1 } = req.query;
      return `reviews:${req.params.productId}:${page}`;
    },
  }),

  // User-specific cart - cache for 2 minutes, vary by user
  cart: cacheMiddleware({
    ttl: 120,
    keyGenerator: (req) => `cart:${req.user._id}`,
    condition: (req) => !!req.user,
    varyBy: ["_id"],
  }),

  // User orders - cache for 5 minutes, vary by user
  orders: cacheMiddleware({
    ttl: 300,
    keyGenerator: (req) => {
      const { page = 1, status = "all" } = req.query;
      return `orders:${req.user._id}:${page}:${status}`;
    },
    condition: (req) => !!req.user,
    varyBy: ["_id"],
  }),

  // Analytics data - cache for 1 hour
  analytics: cacheMiddleware({
    ttl: 3600,
    keyGenerator: (req) => {
      const { startDate, endDate, type } = req.query;
      return `analytics:${type}:${startDate}:${endDate}`;
    },
    condition: (req) => req.user && req.user.isAdmin,
  }),

  // Search results - cache for 10 minutes
  search: cacheMiddleware({
    ttl: 600,
    keyGenerator: (req) => {
      const { q, page = 1, type = "all" } = req.query;
      return `search:${encodeURIComponent(q)}:${page}:${type}`;
    },
    condition: (req) => !!req.query.q,
  }),
};

// Cache invalidation helper
const invalidateCache = {
  // Invalidate product-related caches
  async products(productId = null) {
    const patterns = ["products:", "search:"];
    if (productId) {
      patterns.push(`product:${productId}`, `reviews:${productId}`);
    }

    for (const pattern of patterns) {
      await cache.del(pattern);
    }
  },

  // Invalidate user-specific caches
  async user(userId) {
    const patterns = [`cart:${userId}`, `orders:${userId}`];
    for (const pattern of patterns) {
      await cache.del(pattern);
    }
  },

  // Invalidate category/brand caches
  async catalog() {
    const patterns = ["categories:list", "brands:list", "products:"];
    for (const pattern of patterns) {
      await cache.del(pattern);
    }
  },

  // Invalidate all caches (use sparingly)
  async all() {
    await cache.flush();
  },
};

// Cache warming for frequently accessed data
const warmCache = async () => {
  try {
    console.log("🔥 Warming cache...");

    // You can implement cache warming here
    // For example, pre-load popular products, categories, etc.

    console.log("✅ Cache warmed successfully");
  } catch (error) {
    console.log("❌ Cache warming failed:", error.message);
  }
};

module.exports = {
  cacheMiddleware,
  cacheConfigs,
  invalidateCache,
  warmCache,
};
