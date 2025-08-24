const asyncHandler = require("express-async-handler");
const BlogCategory = require("../models/BlogCategoryModel");
const Blog = require("../models/BlogModel");
const { getFromCache, setCache, cache } = require("../utils/redisCache");

// Utility function to generate slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

// Utility function to clear all blog category caches
const clearBlogCategoryCache = async () => {
  try {
    console.log("🧹 Clearing blog category cache...");
    const languages = ["en", "ur", "ps"];
    const includeInactiveValues = ["false", "true"];

    // Clear all cache variations using proper deletion
    for (const lang of languages) {
      for (const includeInactive of includeInactiveValues) {
        const cacheKey = `blog-categories:${lang}:${includeInactive}`;
        await cache.del(cacheKey);
        console.log(`🗑️ Cleared cache key: ${cacheKey}`);
      }
    }

    // Clear old cache keys for backward compatibility
    await cache.del("blog-categories:all");
    console.log("🗑️ Cleared cache key: blog-categories:all");

    // Clear pattern-based cache if Redis client is available
    if (cache.redisClient) {
      const keys = await cache.redisClient.keys("blog-category:*");
      if (keys.length > 0) {
        await cache.redisClient.del(...keys);
        console.log(`🗑️ Cleared ${keys.length} individual category cache keys`);
      }
    }

    console.log("✅ Blog category cache cleared successfully");
  } catch (error) {
    console.error("❌ Error clearing blog category cache:", error);
  }
};

// Create blog category
const createBlogCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, color, parent, seo, sortOrder } = req.body;

  // Generate slug from English name
  const slug = generateSlug(name.en);

  // Check if slug already exists
  const existingCategory = await BlogCategory.findOne({ slug });
  if (existingCategory) {
    return res.status(400).json({
      success: false,
      message: "Category with this name already exists",
    });
  }

  // Validate parent category if provided
  if (parent) {
    const parentCategory = await BlogCategory.findById(parent);
    if (!parentCategory) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent category",
      });
    }
  }

  const category = new BlogCategory({
    name,
    slug,
    description,
    icon,
    color,
    parent,
    seo,
    sortOrder,
  });

  const savedCategory = await category.save();

  // Clear all blog category caches
  await clearBlogCategoryCache();

  res.status(201).json({
    success: true,
    message: "Blog category created successfully",
    category: savedCategory,
  });
});

// Get all blog categories
const getAllBlogCategories = asyncHandler(async (req, res) => {
  const { language = "en", includeInactive = false } = req.query;

  const cacheKey = `blog-categories:${language}:${includeInactive}`;
  console.log(`🔍 Checking cache for key: ${cacheKey}`);

  const cached = await getFromCache(cacheKey);
  if (cached) {
    console.log(`📦 Returning cached data for: ${cacheKey}`);
    return res.json(cached);
  }

  console.log(`💾 Cache miss for: ${cacheKey}, fetching from database`);

  const query = includeInactive === "true" ? {} : { isActive: true };
  console.log(`🔍 Database query:`, query);

  const categories = await BlogCategory.find(query)
    .populate("parent", "name slug")
    .select(
      `name.${language} name.en slug description.${language} description.en icon color parent sortOrder blogCount isActive`
    )
    .sort({ sortOrder: 1, "name.en": 1 })
    .lean();

  console.log(`📊 Found ${categories.length} categories from database`);
  if (categories.length > 0) {
    console.log("📝 Sample category:", categories[0]);
  }

  // Organize categories hierarchically
  const rootCategories = categories.filter((cat) => !cat.parent);
  const childCategories = categories.filter((cat) => cat.parent);

  const categoriesWithChildren = rootCategories.map((parent) => ({
    ...parent,
    children: childCategories.filter(
      (child) =>
        child.parent && child.parent._id.toString() === parent._id.toString()
    ),
  }));

  const result = {
    success: true,
    categories: categoriesWithChildren,
    flatCategories: categories,
  };

  console.log(
    `📤 Returning ${result.categories.length} root categories, ${result.flatCategories.length} total`
  );

  // Cache for 30 minutes
  await setCache(cacheKey, result, 1800);
  console.log(`💾 Cached result for key: ${cacheKey}`);

  res.json(result);
});

// Get single blog category
const getBlogCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { language = "en" } = req.query;

  const cacheKey = `blog-category:${slug}:${language}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const category = await BlogCategory.findOne({
    slug,
    isActive: true,
  }).populate("parent", "name slug");

  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  // Get subcategories
  const subcategories = await BlogCategory.find({
    parent: category._id,
    isActive: true,
  })
    .select(`name.${language} name.en slug icon color blogCount`)
    .sort({ sortOrder: 1 })
    .lean();

  // Update blog count
  await category.updateBlogCount();

  const result = {
    success: true,
    category,
    subcategories,
  };

  // Cache for 15 minutes
  await setCache(cacheKey, result, 900);

  res.json(result);
});

// Update blog category
const updateBlogCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const category = await BlogCategory.findById(id);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  // If name is updated, regenerate slug
  if (updateData.name?.en && updateData.name.en !== category.name.en) {
    const newSlug = generateSlug(updateData.name.en);
    const existingCategory = await BlogCategory.findOne({
      slug: newSlug,
      _id: { $ne: id },
    });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }
    updateData.slug = newSlug;
  }

  // Validate parent category if being updated
  if (updateData.parent) {
    if (updateData.parent === id) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be its own parent",
      });
    }

    const parentCategory = await BlogCategory.findById(updateData.parent);
    if (!parentCategory) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent category",
      });
    }
  }

  const updatedCategory = await BlogCategory.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  // Clear all blog category caches
  await clearBlogCategoryCache();

  res.json({
    success: true,
    message: "Category updated successfully",
    category: updatedCategory,
  });
});

// Delete blog category
const deleteBlogCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await BlogCategory.findById(id);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  // Check if category has blogs
  const blogCount = await Blog.countDocuments({ category: id, isActive: true });
  if (blogCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete category. It has ${blogCount} blog(s) associated with it.`,
    });
  }

  // Check if category has subcategories
  const subcategoryCount = await BlogCategory.countDocuments({
    parent: id,
    isActive: true,
  });
  if (subcategoryCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete category. It has ${subcategoryCount} subcategory(ies).`,
    });
  }

  await BlogCategory.findByIdAndDelete(id);

  // Clear all blog category caches
  await clearBlogCategoryCache();

  res.json({
    success: true,
    message: "Category deleted successfully",
  });
});

// Get category analytics
const getBlogCategoryAnalytics = asyncHandler(async (req, res) => {
  const analytics = await BlogCategory.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $lookup: {
        from: "blogs",
        localField: "_id",
        foreignField: "category",
        as: "blogs",
      },
    },
    {
      $project: {
        name: "$name.en",
        slug: 1,
        blogCount: { $size: "$blogs" },
        publishedBlogs: {
          $size: {
            $filter: {
              input: "$blogs",
              cond: { $eq: ["$$this.status", "published"] },
            },
          },
        },
        totalViews: { $sum: "$blogs.viewCount" },
        totalLikes: { $sum: "$blogs.likes" },
      },
    },
    {
      $sort: { blogCount: -1 },
    },
  ]);

  res.json({
    success: true,
    analytics,
  });
});

// Clear all blog category caches (for testing/admin use)
const clearBlogCategoryCacheEndpoint = asyncHandler(async (req, res) => {
  await clearBlogCategoryCache();
  res.json({
    success: true,
    message: "Blog category cache cleared successfully",
  });
});

module.exports = {
  createBlogCategory,
  getAllBlogCategories,
  getBlogCategoryBySlug,
  updateBlogCategory,
  deleteBlogCategory,
  getBlogCategoryAnalytics,
  clearBlogCategoryCacheEndpoint,
};
