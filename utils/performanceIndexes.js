// Database indexes for lightning-fast queries
const mongoose = require("mongoose");

const createPerformanceIndexes = async () => {
  try {
    console.log("🔧 Creating performance indexes...");

    // Get all collections
    const Product = mongoose.model("Products");
    const Brand = mongoose.model("Brand");
    const Category = mongoose.model("Category");

    // Product indexes for common queries
    await Product.collection.createIndexes([
      // For product listing with sorting
      { key: { isActive: 1, createdAt: -1 } },
      { key: { isActive: 1, isFeatured: 1, createdAt: -1 } },
      { key: { isActive: 1, category: 1, createdAt: -1 } },
      { key: { isActive: 1, brand: 1, createdAt: -1 } },

      // For search functionality
      { key: { name: "text", tags: "text", keyFeatures: "text" } },

      // For price filtering
      { key: { isActive: 1, price: 1 } },
      { key: { isActive: 1, originalPrice: 1 } },

      // Compound indexes for complex queries
      { key: { isActive: 1, category: 1, price: 1 } },
      { key: { isActive: 1, brand: 1, price: 1 } },

      // For stock management
      { key: { isActive: 1, stock: 1 } },

      // For analytics
      { key: { viewCount: -1 } },
      { key: { createdAt: -1 } },
    ]);

    // Brand indexes
    await Brand.collection.createIndexes([
      { key: { isActive: 1, name: 1 } },
      { key: { slug: 1 }, unique: true },
    ]);

    // Category indexes
    await Category.collection.createIndexes([
      { key: { isActive: 1, name: 1 } },
      { key: { slug: 1 }, unique: true },
      { key: { parent: 1 } },
    ]);

    console.log("✅ Performance indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
  }
};

module.exports = { createPerformanceIndexes };
