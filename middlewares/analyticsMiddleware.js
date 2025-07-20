const AnalyticsService = require("../utils/analyticsService");

/**
 * Middleware to track site visits
 * This middleware will track a site visit based on the request data
 * It's designed to not block the response
 */
const trackVisitMiddleware = (req, res, next) => {
  // Skip tracking for API routes and non-GET requests
  if (req.path.startsWith("/api/") || req.method !== "GET") {
    return next();
  }

  // Extract visitor data from request
  const visitorId =
    req.cookies?.visitorId || req.headers["x-visitor-id"] || req.ip;
  const page = req.originalUrl || req.url;
  const referrer = req.headers.referer || "";
  const userAgent = req.headers["user-agent"] || "";

  // Basic device and browser detection from user agent
  const device = getDeviceType(userAgent);
  const browser = getBrowserInfo(userAgent);

  // Get user ID if authenticated
  const userId = req.user ? req.user._id : null;

  // Track the visit without waiting for it to complete
  AnalyticsService.trackSiteVisit({
    visitorId,
    userId,
    page,
    referrer,
    device,
    browser,
  }).catch((err) => {
    // Just log errors, don't affect the user experience
    console.error("Error tracking visit:", err);
  });

  // Continue with the request
  next();
};

/**
 * Helper function to determine device type from user agent
 * @param {String} userAgent - The user agent string
 * @returns {String} - The device type
 */
function getDeviceType(userAgent) {
  if (!userAgent) return "unknown";

  userAgent = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
    return "tablet";
  }

  if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      userAgent
    )
  ) {
    return "mobile";
  }

  return "desktop";
}

/**
 * Helper function to determine browser from user agent
 * @param {String} userAgent - The user agent string
 * @returns {String} - The browser name
 */
function getBrowserInfo(userAgent) {
  if (!userAgent) return "unknown";

  userAgent = userAgent.toLowerCase();

  if (userAgent.includes("firefox")) {
    return "firefox";
  } else if (userAgent.includes("edg")) {
    return "edge";
  } else if (userAgent.includes("chrome")) {
    return "chrome";
  } else if (userAgent.includes("safari")) {
    return "safari";
  } else if (userAgent.includes("opr") || userAgent.includes("opera")) {
    return "opera";
  } else if (userAgent.includes("msie") || userAgent.includes("trident")) {
    return "ie";
  } else {
    return "unknown";
  }
}

module.exports = { trackVisitMiddleware };
