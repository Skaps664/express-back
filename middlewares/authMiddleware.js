const User = require("../models/UserModel");
const Brand = require("../models/BrandModel");
const Product = require("../models/ProductsModel");
const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
  let token;

  // Check for token in cookies first
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided, authorization denied",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Not authorized, token expired. Login again.",
    });
  }
};

const isAdmin = async (req, res, next) => {
  const { email } = req.user;
  const user = await User.findOne({ email });
  if (!user || !user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Access denied, admin only",
    });
  }
  next();
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
