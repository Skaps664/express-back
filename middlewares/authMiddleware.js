const User = require("../models/UserModel");
const Brand = require("../models/BrandModel");
const Product = require("../models/ProductsModel");
const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
  let token;

  // Debug: Log incoming cookies
  console.log("🍪 Cookies received:", Object.keys(req.cookies || {}));

  // Check for token in cookies first (priority for production)
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
    console.log("✅ Access token found in cookies");
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    console.log("✅ Access token found in Authorization header");
  }

  // If no access token, try refresh token immediately
  if (!token) {
    console.log("❌ No access token found");
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      console.log("🔄 Found refresh token, attempting automatic refresh...");
      return await attemptTokenRefresh(req, res, next, refreshToken);
    }

    console.log("❌ No refresh token available");
    return res.status(401).json({
      success: false,
      message: "No token provided, authorization denied",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Optimized user lookup with field selection and timeout
    const user = await User.findById(decoded.id)
      .select("_id name email mobile isAdmin role isBlocked")
      .maxTimeMS(5000);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found, please login again",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked",
      });
    }

    // Set user data with proper admin status for backward compatibility
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      isAdmin: user.isAdmin || user.role === "admin",
      role: user.role || (user.isAdmin ? "admin" : "user"),
      isBlocked: user.isBlocked,
    };

    console.log("✅ User authenticated:", user.email);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.log("⏰ Access token expired, attempting refresh...");
      // Try to refresh token automatically
      const refreshToken = req.cookies?.refreshToken;

      if (refreshToken) {
        return await attemptTokenRefresh(req, res, next, refreshToken);
      }

      return res.status(401).json({
        success: false,
        message: "Token expired, please login again",
        code: "TOKEN_EXPIRED",
      });
    } else if (error.name === "JsonWebTokenError") {
      console.log("❌ Invalid access token");
      return res.status(401).json({
        success: false,
        message: "Invalid token, please login again",
        code: "INVALID_TOKEN",
      });
    } else {
      console.log("❌ Auth error:", error.message);
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }
  }
};

// Separate function to handle token refresh
async function attemptTokenRefresh(req, res, next, refreshToken) {
  try {
    console.log("🔄 Verifying refresh token...");
    console.log(
      "🔍 Refresh token (first 50 chars):",
      refreshToken.substring(0, 50) + "..."
    );

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);
    console.log("✅ JWT verification successful, user ID:", decoded.id);

    const user = await User.findById(decoded.id)
      .select("_id name email mobile isAdmin role isBlocked refreshToken")
      .maxTimeMS(5000);

    if (!user) {
      console.log("❌ User not found in database for ID:", decoded.id);
      return res.status(401).json({
        success: false,
        message: "User not found, please login again",
        code: "USER_NOT_FOUND",
      });
    }

    console.log("👤 User found:", user.email);
    console.log(
      "🔍 Stored refresh token (first 50 chars):",
      user.refreshToken
        ? user.refreshToken.substring(0, 50) + "..."
        : "No token stored"
    );
    console.log("🔍 Token match:", user.refreshToken === refreshToken);

    if (user.refreshToken !== refreshToken) {
      console.log("❌ Refresh token mismatch");
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token, please login again",
        code: "TOKEN_MISMATCH",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked",
      });
    }

    // Generate new access token
    const { generateToken } = require("../config/jwtToken");
    const newAccessToken = generateToken(user._id);

    console.log("✅ Token refresh successful for user:", user.email);

    // Set new access token cookie
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
    };

    res.cookie("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Set user data with proper admin status
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      isAdmin: user.isAdmin || user.role === "admin",
      role: user.role || (user.isAdmin ? "admin" : "user"),
      isBlocked: user.isBlocked,
    };

    return next();
  } catch (refreshError) {
    console.log("❌ Refresh token verification failed:", refreshError.message);
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token, please login again",
      code: "REFRESH_TOKEN_EXPIRED",
    });
  }
}

const isAdmin = async (req, res, next) => {
  try {
    // User is already loaded in authMiddleware with optimized query
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check both isAdmin field and role field for backward compatibility
    const userIsAdmin = req.user.isAdmin || req.user.role === "admin";

    if (!userIsAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin privileges required",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking admin privileges",
    });
  }
};

/**
 * Middleware to check if user is admin or owns the brand
 * For brand analytics, check brand ownership
 * For product analytics, check if user owns the product's brand
 * For time series reports, check ownership based on entityType and entityId
 */
const isBrandOwner = async (req, res, next) => {
  try {
    // If user is admin, allow access
    const { email } = req.user;
    const user = await User.findOne({ email });

    if (user && user.isAdmin) {
      return next();
    }

    // Get the entity ID based on the route
    let entityType, entityId;

    // Check route pattern to determine what we're looking at
    if (req.path.startsWith("/brand/")) {
      // Brand analytics route
      entityType = "brand";
      entityId = req.params.brandId;
    } else if (req.path.startsWith("/product/")) {
      // Product analytics route
      entityType = "product";
      entityId = req.params.productId;

      // Get the product's brand ID
      const product = await Product.findById(entityId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }
      entityId = product.brand;
    } else if (req.path.startsWith("/report/")) {
      // Time series report route
      entityType = req.query.entityType;
      entityId = req.query.entityId;

      // Skip ownership check for site-wide analytics
      if (entityType === "site") {
        return res.status(403).json({
          success: false,
          message: "Access denied, admin only",
        });
      }

      // For product analytics, get the product's brand ID
      if (entityType === "product" && entityId) {
        const product = await Product.findById(entityId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }
        entityId = product.brand;
      }
    }

    // If we have a brand ID, check if the user owns it
    if (entityId) {
      const brand = await Brand.findById(entityId);

      if (!brand) {
        return res.status(404).json({
          success: false,
          message: "Brand not found",
        });
      }

      // Check if user is the brand owner
      if (brand.owner && brand.owner.toString() === user._id.toString()) {
        return next();
      }
    }

    // If we get here, the user doesn't have access
    return res.status(403).json({
      success: false,
      message: "Access denied, not authorized for this brand's data",
    });
  } catch (error) {
    console.error("Error in isBrandOwner middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Server error checking authorization",
    });
  }
};

module.exports = { authMiddleware, isAdmin, isBrandOwner };
