const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
dotenv.config({ path: "./config/config.env" });

const { errorMiddleware } = require("./error/error");
const { trackVisitMiddleware } = require("./middlewares/analyticsMiddleware");

const cookieParser = require("cookie-parser");

const dbConnect = require("./database/dbConnect");

// Initialize models
require("./models");

dotenv.config();

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

const app = express();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
); // Security headers with CORS support

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001", // Default to localhost for development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
); // Handle CORS

app.use(morgan("dev")); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// Analytics tracking middleware - place it after cookie parser and before routes
app.use(trackVisitMiddleware);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/", homePageRouter);
app.use("/api/user", authRouter);
app.use("/api/products", productRoute);
app.use("/api/brands", brandRoute);
app.use("/api/category", categoryRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/cart", cartRoute);
app.use("/api/orders", orderRoute);
app.use("/api/offers", offerRoute);
app.use("/api/brand-page-settings", brandPageSettingsRoute);
app.use("/api/entity-search", entitySearchRoute);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "Server is running!" });
});

dbConnect();

app.use(errorMiddleware);

module.exports = app;

module.exports = app;
