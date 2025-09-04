const mongoose = require("mongoose");
require("dotenv").config();

const Category = require("./models/CategoryModel");
const Brand = require("./models/BrandModel");
const Product = require("./models/ProductsModel");

const categories = [
  {
    name: "Solar Inverters",
    slug: "inverter",
    description:
      "Convert DC power from solar panels to AC power for your home or business",
    isActive: true,
    isFeatured: true,
  },
  {
    name: "Solar Panels",
    slug: "solar-panels",
    description:
      "High-efficiency solar panels from leading manufacturers worldwide",
    isActive: true,
    isFeatured: true,
  },
  {
    name: "Solar Batteries",
    slug: "battery",
    description:
      "Energy storage solutions for backup power and energy independence",
    isActive: true,
    isFeatured: true,
  },
  {
    name: "Solar Tools",
    slug: "tools",
    description:
      "Professional installation and testing tools for solar systems",
    isActive: true,
    isFeatured: true,
  },
  {
    name: "Solar Accessories",
    slug: "accessories",
    description: "Mounting systems, cables, connectors and protection devices",
    isActive: true,
    isFeatured: true,
  },
];

const brands = [
  {
    name: "Growatt",
    slug: "growatt",
    description: "Leading solar inverter manufacturer",
    isActive: true,
  },
  {
    name: "Jinko Solar",
    slug: "jinko-solar",
    description: "Premium solar panel manufacturer",
    isActive: true,
  },
  {
    name: "Tesla",
    slug: "tesla",
    description: "Advanced battery technology",
    isActive: true,
  },
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Product.deleteMany({});
    console.log("Cleared existing data");

    // Create categories
    const createdCategories = await Category.insertMany(categories);
    console.log("Created categories:", createdCategories.length);

    // Create brands
    const createdBrands = await Brand.insertMany(brands);
    console.log("Created brands:", createdBrands.length);

    // Create sample products
    const inverterCategory = createdCategories.find(
      (c) => c.slug === "inverter"
    );
    const growattBrand = createdBrands.find((b) => b.slug === "growatt");

    const sampleProducts = [
      {
        name: "Growatt 5kW On-Grid Solar Inverter",
        slug: "growatt-5kw-on-grid-inverter",
        description:
          "High-efficiency 5kW on-grid solar inverter for residential use",
        price: 75000,
        originalPrice: 85000,
        category: inverterCategory._id,
        brand: growattBrand._id,
        images: ["/placeholder-inverter.jpg"],
        stock: 50,
        isActive: true,
        isFeatured: true,
        specifications: {
          Type: "On-Grid",
          Phase: "Single-Phase",
          PowerRating: 5,
          Warranty: "10 Years",
          CountryOfOrigin: "China",
        },
        reviews: {
          rating: 4.5,
          count: 25,
        },
      },
      {
        name: "Growatt 10kW Hybrid Solar Inverter",
        slug: "growatt-10kw-hybrid-inverter",
        description: "Advanced 10kW hybrid solar inverter with battery backup",
        price: 120000,
        originalPrice: 135000,
        category: inverterCategory._id,
        brand: growattBrand._id,
        images: ["/placeholder-inverter.jpg"],
        stock: 30,
        isActive: true,
        isBestSeller: true,
        specifications: {
          Type: "Hybrid",
          Phase: "Single-Phase",
          PowerRating: 10,
          Warranty: "10 Years",
          CountryOfOrigin: "China",
        },
        reviews: {
          rating: 4.7,
          count: 18,
        },
      },
    ];

    const createdProducts = await Product.insertMany(sampleProducts);
    console.log("Created products:", createdProducts.length);

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
