require("dotenv").config();
const mongoose = require("mongoose");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");

    // Import Product model
    const Product = require("./models/ProductsModel");

    // Find a product with documents
    Product.findOne({
      documents: { $exists: true, $ne: [] },
    })
      .then((product) => {
        if (product) {
          console.log("📦 Found product with documents:");
          console.log("Product ID:", product._id);
          console.log("Product name:", product.name);
          console.log("Documents:", JSON.stringify(product.documents, null, 2));
        } else {
          console.log("❌ No products with documents found");
        }
        process.exit(0);
      })
      .catch((err) => {
        console.error("❌ Error finding product:", err);
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error("❌ Error connecting to MongoDB:", err);
    process.exit(1);
  });
