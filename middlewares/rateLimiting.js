const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const { cache } = require("../utils/redisCache");

// Advanced rate limiting for high-scale applications
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // Default limit per window
    message = "Too many requests from this IP",
    skipSuccessfulRequests = true,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    skipSuccessfulRequests,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,

    // Custom store using Redis for distributed rate limiting
    store: cache.redisClient
      ? {
          incr: async (key) => {
            const current = await cache.redisClient.incr(key);
            if (current === 1) {
              await cache.redisClient.expire(key, Math.ceil(windowMs / 1000));
            }
            return {
              totalHits: current,
              resetTime: new Date(Date.now() + windowMs),
            };
          },
          decrement: async (key) => {
            const current = await cache.redisClient.decr(key);
            return { totalHits: Math.max(0, current) };
          },
          resetKey: async (key) => {
            await cache.redisClient.del(key);
          },
        }
      : undefined,

    // Skip certain IPs (you can add your monitoring services)
    skip: (req) => {
      const trustedIPs = process.env.TRUSTED_IPS?.split(",") || [];
      return trustedIPs.includes(req.ip);
    },
  });
};

// Progressive speed limiting for sustained high traffic
const createSpeedLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    delayAfter = 50,
    delayMs = 500,
    maxDelayMs = 5000,
  } = options;

  return slowDown({
    windowMs,
    delayAfter,
    delayMs: () => delayMs, // Fixed for express-slow-down v2
    maxDelayMs,
    skipSuccessfulRequests: true,
    skipFailedRequests: true,

    // Disable validation warning
    validate: {
      delayMs: false,
    },

    // Custom store using Redis
    store: cache.redisClient
      ? {
          incr: async (key) => {
            const current = await cache.redisClient.incr(key);
            if (current === 1) {
              await cache.redisClient.expire(key, Math.ceil(windowMs / 1000));
            }
            return {
              totalHits: current,
              resetTime: new Date(Date.now() + windowMs),
            };
          },
          decrement: async (key) => {
            const current = await cache.redisClient.decr(key);
            return { totalHits: Math.max(0, current) };
          },
          resetKey: async (key) => {
            await cache.redisClient.del(key);
          },
        }
      : undefined,
  });
};

// Specific rate limiters for different endpoints
const rateLimiters = {
  // General API rate limiter - 1000 requests per 15 minutes
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Too many API requests, please try again later",
  }),

  // Authentication endpoints - stricter limits
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 login attempts per 15 minutes
    message: "Too many authentication attempts, please try again later",
    skipSuccessfulRequests: false, // Count both successful and failed
  }),

  // Registration - very strict
  register: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Only 5 registrations per hour per IP
    message: "Too many registration attempts, please try again later",
  }),

  // Product search/browsing - higher limits
  products: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 2000, // Higher limit for browsing
    message: "Too many product requests, please slow down",
  }),

  // Cart operations - moderate limits
  cart: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: "Too many cart operations, please try again later",
  }),

  // Order operations - strict but reasonable
  orders: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many order requests, please try again later",
  }),

  // Admin operations - very strict
  admin: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many admin requests, please try again later",
  }),

  // Speed limiters for sustained traffic
  speedLimiter: createSpeedLimiter({
    windowMs: 15 * 60 * 1000,
    delayAfter: 100, // Start slowing down after 100 requests
    delayMs: 250, // Start with 250ms delay
    maxDelayMs: 3000, // Maximum 3 second delay
  }),
};

// DDoS protection middleware
const ddosProtection = (req, res, next) => {
  const userAgent = req.get("User-Agent") || "";
  const suspiciousPatterns = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|php/i,
    /postman/i, // Block Postman in production
  ];

  // Block suspicious user agents in production
  if (process.env.NODE_ENV === "production") {
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }
  }

  // Check for empty or malformed requests
  if (!req.get("Host") || !req.get("Accept")) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
    });
  }

  next();
};

module.exports = {
  rateLimiters,
  ddosProtection,
  createRateLimiter,
  createSpeedLimiter,
};
