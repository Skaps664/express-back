module.exports = {
  // 🔌 Inverters
  inverters: [
    {
      field: "brand",
      type: "select",
      label: "Brand",
      options: [
        "Growatt",
        "SMA",
        "Fronius",
        "Huawei",
        "Solis",
        "ABB",
        "Schneider",
      ],
    },
    { field: "On-Grid", type: "boolean", label: "On-Grid" },
    { field: "Off-Grid", type: "boolean", label: "Off -Grid" },

    {
      field: "phase",
      type: "select",
      label: "Phase",
      options: ["Single-Phase", "Three-Phase"],
    },

    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Seller" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "price",
      type: "range",
      label: "Price (PKR)",
      min: 50000,
      max: 2000000,
      step: 10000,
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // ☀️ Solar Panels
  "solar-panels": [
    {
      field: "brand",
      type: "select",
      label: "Brand",
      options: [
        "Jinko Solar",
        "Canadian Solar",
        "JA Solar",
        "Longi Solar",
        "Trina Solar",
        "First Solar",
        "Risen Energy",
      ],
    },

    {
      field: "wattage",
      type: "range",
      label: "Wattage (W)",
      min: 100,
      max: 600,
      step: 10,
    },

    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Seller" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "price",
      type: "range",
      label: "Price (PKR)",
      min: 10000,
      max: 100000,
      step: 1000,
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // 🔋 Batteries
  batteries: [
    {
      field: "brand",
      type: "select",
      label: "Brand",
      options: [
        "Tesla",
        "Pylontech",
        "BYD",
        "LG Chem",
        "Victron Energy",
        "Trojan",
        "Crown Battery",
      ],
    },
    {
      field: "batteryType",
      type: "select",
      label: "Type",
      options: ["Lithium-ion", "Lead-Acid"],
    },
    {
      field: "voltage",
      type: "select",
      label: "Voltage",
      options: ["12V", "24V", "48V", "96V"],
    },
    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Seller" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "price",
      type: "range",
      label: "Price (PKR)",
      min: 20000,
      max: 500000,
      step: 5000,
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // 🛠 Tools
  tools: [
    {
      field: "brand",
      type: "select",
      label: "Brand",
      options: [
        "Fluke",
        "Klein Tools",
        "Greenlee",
        "Ideal",
        "Wiha",
        "Wera",
        "Milwaukee",
      ],
    },

    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Seller" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "price",
      type: "range",
      label: "Price (PKR)",
      min: 1000,
      max: 200000,
      step: 1000,
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // 🔧 Accessories
  accessories: [
    {
      field: "brand",
      type: "select",
      label: "Brand",
      options: [
        "MC4",
        "Amphenol",
        "Staubli",
        "Tyco",
        "Phoenix Contact",
        "Weidmuller",
      ],
    },

    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Seller" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "price",
      type: "range",
      label: "Price (PKR)",
      min: 500,
      max: 100000,
      step: 500,
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // 🌍 General Store Filters (for all categories)
  general: [
    { field: "brand", type: "select", label: "Brand", options: [] }, // Will be populated dynamically
    {
      field: "category",
      type: "select",
      label: "Category",
      options: [
        "Solar Panels",
        "Inverters",
        "Batteries",
        "Tools",
        "Accessories",
      ],
    },
    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Sellers" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "priceRange",
      type: "select",
      label: "Price Range",
      options: ["Under 10K", "10K-50K", "50K-100K", "100K-500K", "500K+"],
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // Brand Page Filters (for individual brand pages)
  brand: [
    {
      field: "category",
      type: "select",
      label: "Category",
      options: [
        "Solar Panels",
        "Inverters",
        "Batteries",
        "Tools",
        "Accessories",
      ],
    },
    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Sellers" },
    { field: "isNewArrival", type: "boolean", label: "New Arrivals" },
    {
      field: "priceRange",
      type: "select",
      label: "Price Range",
      options: ["Under 10K", "10K-50K", "50K-100K", "100K-500K", "500K+"],
    },
    {
      field: "rating",
      type: "range",
      label: "Customer Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],

  // Default fallback
  default: [
    { field: "brand", type: "select", label: "Brand", options: [] },
    { field: "isFeatured", type: "boolean", label: "Featured" },
    { field: "isBestSeller", type: "boolean", label: "Best Seller" },
    {
      field: "price",
      type: "range",
      label: "Price",
      min: 0,
      max: 1000000,
      step: 1000,
    },
    {
      field: "rating",
      type: "range",
      label: "Rating",
      min: 1,
      max: 5,
      step: 0.5,
    },
  ],
};
