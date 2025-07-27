const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const compression = require("compression");

// Load environment variables - Railway will provide them automatically
// For local development, load from .env file in backend directory
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: "./.env" });
} else {
  // In production, if environment variables are not set by Railway, load from .env as fallback
  if (!process.env.MONGODB_URI) {
    console.log("🔧 Loading .env as fallback for production...");
    dotenv.config({ path: "./.env" });
  }
}
const { errorMiddleware } = require("./error/error");
const { trackVisitMiddleware } = require("./middlewares/analyticsMiddleware");
const { rateLimiters, ddosProtection } = require("./middlewares/rateLimiting");
const { initializeRedis } = require("./utils/redisCache");

const cookieParser = require("cookie-parser");

const dbConnect = require("./database/dbConnect");

// Initialize Redis for high-scale caching
initializeRedis();

// Initialize models AFTER dotenv config
require("./models");

//Routers
const homePageRouter = require("./routes/homePageRoute");
const authRouter = require("./routes/auhtRoute");
const productRoute = require("./routes/productRoute");
const brandRoute = require("./routes/brandRoute");
const categoryRoute = require("./routes/categoryRoute");
const reviewRoute = require("./routes/reviewRoute");
const analyticsRoute = require("./routes/analyticsRoute");
const cartRoute = require("./routes/cartRoute");
const orderRoute = require("./routes/orderRoute");
const offerRoute = require("./routes/offerRoute");
const brandPageSettingsRoute = require("./routes/brandPageSettingsRoute");
const entitySearchRoute = require("./routes/entitySearchRoute");
const dashboardRoute = require("./routes/dashboardRoute");
const testRoute = require("./routes/testRoute");

const app = express();

// Enterprise-level middleware for 100k+ users
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
); // Compress all responses

// DDoS protection - must be early in middleware stack
app.use(ddosProtection);

// General rate limiting - applies to all routes
app.use(rateLimiters.general);
app.use(rateLimiters.speedLimiter);

// Advanced security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Disable for API
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    console.log("🔍 CORS Origin check:", origin);

    const allowedOrigins = [
      "https://solarexpress.pk",
      "https://www.solarexpress.pk",
      "http://localhost:3000", // Next.js frontend
      "http://localhost:3001", // Additional frontend port
      "http://127.0.0.1:3000", // Alternative localhost
      "https://express-solar-store.vercel.app", // Vercel frontend
      "https://express-solar-store-git-ui-update-skaps664.vercel.app", // Vercel branch deployment
      "https://express-back-production.up.railway.app", // Railway backend
    ];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) {
      console.log("✅ No origin - allowing request");
      return callback(null, true);
    }

    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      console.log("✅ Origin allowed:", origin);
      return callback(null, true);
    }

    // Allow all Vercel deployments for this project
    if (
      origin &&
      origin.includes("express-solar-store") &&
      origin.includes("vercel.app")
    ) {
      console.log("✅ Vercel deployment allowed:", origin);
      return callback(null, true);
    }

    // Allow any localhost for development
    if (
      origin &&
      (origin.includes("localhost") || origin.includes("127.0.0.1"))
    ) {
      console.log("✅ Localhost allowed:", origin);
      return callback(null, true);
    }

    console.log("❌ Origin blocked:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "Set-Cookie",
    "Access-Control-Allow-Credentials",
    "x-requested-with",
  ],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));

// Optimized body parsing for high traffic
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  express.json({
    limit: "5mb", // Reduced for security
    strict: true,
    type: ["application/json", "application/csp-report"],
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
    parameterLimit: 50, // Limit URL parameters
  })
);
app.use(cookieParser());

// Trust proxy for production deployment (essential for rate limiting)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Request ID for tracking (helpful for 100k+ users)
app.use((req, res, next) => {
  req.id = require("crypto").randomUUID();
  res.set("X-Request-ID", req.id);
  next();
});

// Analytics tracking middleware - optimized for high traffic
app.use(trackVisitMiddleware);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1y", // Cache static files for 1 year
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      if (
        path.endsWith(".jpg") ||
        path.endsWith(".png") ||
        path.endsWith(".webp")
      ) {
        res.set("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

// Route-specific rate limiting for high-scale applications
app.use("/", homePageRouter);
app.use("/api/user/register", rateLimiters.register);
app.use("/api/user/login", rateLimiters.auth);
app.use("/api/user", authRouter);
app.use("/api/products", rateLimiters.products, productRoute);
app.use("/api/brands", rateLimiters.products, brandRoute);
app.use("/api/category", rateLimiters.products, categoryRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/analytics", rateLimiters.admin, analyticsRoute);
app.use("/api/dashboard", rateLimiters.admin, dashboardRoute);
app.use("/api/cart", rateLimiters.cart, cartRoute);
app.use("/api/orders", rateLimiters.orders, orderRoute);
app.use("/api/offers", offerRoute);
app.use("/api/brand-page-settings", brandPageSettingsRoute);
app.use("/api/entity-search", rateLimiters.products, entitySearchRoute);
app.use("/api/test", testRoute);

// Health check endpoint with detailed metrics for monitoring
app.get("/api/health", async (req, res) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV,
    requestId: req.id,
  };

  // Check database connection
  try {
    const mongoose = require("mongoose");
    healthData.database = {
      status:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      readyState: mongoose.connection.readyState,
    };
  } catch (error) {
    healthData.database = { status: "error", error: error.message };
  }

  // Check Redis connection if available
  try {
    const { redisClient } = require("./utils/redisCache");
    if (redisClient) {
      const ping = await redisClient.ping();
      healthData.redis = { status: ping === "PONG" ? "connected" : "error" };
    } else {
      healthData.redis = { status: "not_configured" };
    }
  } catch (error) {
    healthData.redis = { status: "error", error: error.message };
  }

  res.status(200).json(healthData);
});

// Metrics endpoint for monitoring (protected)
app.get("/api/metrics", async (req, res) => {
  // Simple metrics - you might want to add authentication
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  };

  res.status(200).json(metrics);
});

// Root endpoint for Railway health check
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Solar Express API is running",
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

dbConnect();

app.use(errorMiddleware);

module.exports = app;
